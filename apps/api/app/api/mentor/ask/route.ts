/**
 * POST /api/mentor/ask — AI түүхэн зөвлөх (Бүлэг 3.3, 6.4, ADR-007)
 *
 * Хамгаалалтын давхаргууд:
 *   - RAG заавал; корпусаас гадуур контекст байхгүй
 *   - Хатуу system prompt: «контекстэд байхгүй бол мэдэхгүй гэж хэл»
 *   - Эх сурвалж заавал харуулна
 *   - Өдөрт 10 мессежийн лимит (СЕРВЕРТ — алдааны засвар №11)
 *   - Түгээмэл асуултын кэш
 *   - AI унасан үед graceful degradation (модуль хаагдана, бусад ажиллана)
 */
import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { todayInUlaanbaatar } from '@nomad/core';
import { MentorAskRequestSchema } from '@nomad/contracts';
import { heroes, mentorCache, userHeroes } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, requireAuth, route } from '@/lib/api';
import { consumeMentorQuota, peekMentorQuota } from '@/lib/redis';
import {
  buildSystemPrompt,
  GREETING_REPLY,
  isGreeting,
  OUT_OF_SCOPE_REPLY,
  queryHash,
  retrieve,
} from '@/lib/rag';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const parsed = await parseBody(req, MentorAskRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { personaId, query } = parsed.data;

  const today = todayInUlaanbaatar();

  // ─── Persona нээгдсэн эсэх ───
  const [hero] = await db
    .select({ id: heroes.id, name: heroes.name })
    .from(heroes)
    .where(eq(heroes.id, personaId))
    .limit(1);
  if (!hero) return apiError('PERSONA_NOT_FOUND', 'Ийм баатар байхгүй', 404);

  const [owned] = await db
    .select({ heroId: userHeroes.heroId })
    .from(userHeroes)
    .where(and(eq(userHeroes.userId, userId), eq(userHeroes.heroId, personaId)))
    .limit(1);
  if (!owned) {
    return apiError('HERO_LOCKED', 'Энэ баатар хараахан нээгдээгүй байна', 403);
  }

  // ─── Мэндчилгээ — лимит зарцуулахгүй (алдааны засвар №14) ───
  if (isGreeting(query)) {
    return NextResponse.json({
      text: GREETING_REPLY,
      sources: [],
      outOfScope: false,
      remainingMessages: await peekMentorQuota(userId, today),
    });
  }

  // ─── Кэш — лимит зарцуулахгүй (Бүлэг 6.4 зардлын хяналт) ───
  const hash = queryHash(query);
  const [cached] = await db
    .select()
    .from(mentorCache)
    .where(and(eq(mentorCache.personaHeroId, personaId), eq(mentorCache.queryHash, hash)))
    .limit(1);

  if (cached) {
    await db
      .update(mentorCache)
      .set({ hits: sql`${mentorCache.hits} + 1` })
      .where(eq(mentorCache.id, cached.id));
    return NextResponse.json({
      text: cached.answer,
      sources: cached.sources as string[],
      outOfScope: false,
      remainingMessages: await peekMentorQuota(userId, today),
    });
  }

  // ─── Өдрийн лимит (Бүлэг 6.4: 10 мессеж) ───
  const quota = await consumeMentorQuota(userId, today);
  if (!quota.allowed) {
    return apiError(
      'DAILY_LIMIT_REACHED',
      'Өнөөдрийн 10 мессежийн лимит дууслаа. Маргааш дахин уулзъя!',
      429
    );
  }

  // ─── RAG retrieval (persona ХАТУУ тусгаарлалттай) ───
  const context = await retrieve(personaId, query);

  if (context.length === 0) {
    // ❌ Хий үзэгдэл гаргахгүй — LLM руу ч явуулахгүй
    return NextResponse.json({
      text: OUT_OF_SCOPE_REPLY,
      sources: [],
      outOfScope: true,
      remainingMessages: quota.remaining,
    });
  }

  const sources = [...new Set(context.map((c) => c.sourceRef))];

  // ─── LLM дуудлага ───
  const apiKey = process.env.LLM_API_KEY;
  const apiUrl = process.env.LLM_API_URL;

  if (!apiKey || !apiUrl) {
    // LLM тохируулагдаагүй — корпусын текстийг ШУУД буцаана.
    // Хий үзэгдэл гарахгүй; хэв маяг л арай хуурай.
    return NextResponse.json({
      text: context.map((c) => c.text).join('\n\n'),
      sources,
      outOfScope: false,
      remainingMessages: quota.remaining,
    });
  }

  let answer: string;
  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 512,
        system: buildSystemPrompt(hero.name, context),
        messages: [{ role: 'user', content: query }],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) throw new Error(`LLM ${res.status}`);

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    answer =
      data.content
        ?.filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('')
        .trim() ?? '';

    if (answer.length === 0) throw new Error('LLM хоосон хариу');
  } catch (err) {
    console.error('[mentor] LLM алдаа:', err);
    // Graceful degradation — корпусын текстээр нөхнө (Бүлэг 6.4)
    return NextResponse.json({
      text: context.map((c) => c.text).join('\n\n'),
      sources,
      outOfScope: false,
      remainingMessages: quota.remaining,
    });
  }

  // ─── Кэшлэх ───
  await db
    .insert(mentorCache)
    .values({ personaHeroId: personaId, queryHash: hash, answer, sources })
    .onConflictDoNothing();

  return NextResponse.json({
    text: answer,
    sources,
    outOfScope: false,
    remainingMessages: quota.remaining,
  });
});
