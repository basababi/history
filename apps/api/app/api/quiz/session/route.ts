/**
 * POST /api/quiz/session — Алхам 1 (Бүлэг 6.1)
 *
 * Сервер асуулт + HMAC-SHA256 гарын үсэгтэй token илгээнэ.
 * ❌ correctIndex ХЭЗЭЭ Ч клиент рүү ЯВАХГҮЙ.
 *
 * ADR-004: Токио бүс (hnd1) — vercel.json-д. Латенц 200–300мс → 50–80мс
 */
import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { todayInUlaanbaatar } from '@nomad/core';
import { CreateSessionRequestSchema } from '@nomad/contracts';
import { heroes, profiles, questions, quizSessions } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, requireAuth, route } from '@/lib/api';
import { makeExpiry, signSession } from '@/lib/session';

// ADR-004: Токио бүс (hnd1) — vercel.json-д тохируулагдсан
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const parsed = await parseBody(req, CreateSessionRequestSchema);
  if (!parsed.ok) return parsed.response;
  // zod `.default()` нь оролтын төрөлд optional боловч гаралтад заавал байна
  const questionCount = parsed.data.questionCount ?? 10;
  const mode = parsed.data.mode ?? 'daily';
  const { eraId } = parsed.data;

  // Профайл + идэвхтэй баатрын perk (эриний бонус, нэмэлт секунд, 50/50)
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (!profile) {
    return apiError('NO_PROFILE', 'Профайл олдсонгүй', 404);
  }

  let heroEraId: number | null = null;
  let eraBonusMultiplier: number | null = null;
  let extraSeconds = 0;
  let heroHasFiftyFifty = false;

  if (profile.activeHeroId !== null) {
    const [hero] = await db
      .select()
      .from(heroes)
      .where(eq(heroes.id, profile.activeHeroId))
      .limit(1);
    if (hero) {
      const perk = hero.perk as {
        extraSeconds?: number;
        fiftyFifty?: boolean;
        eraBonusMultiplier?: number;
      };
      heroEraId = hero.eraId;
      eraBonusMultiplier = perk.eraBonusMultiplier ?? null;
      extraSeconds = perk.extraSeconds ?? 0;
      heroHasFiftyFifty = perk.fiftyFifty === true;
    }
  }

  // Зөвхөн published асуулт — partial index ашиглана (Бүлэг 5.2)
  const pool = await db
    .select({
      id: questions.id,
      eraId: questions.eraId,
      difficulty: questions.difficulty,
      body: questions.body,
      options: questions.options,
    })
    .from(questions)
    .where(
      eraId
        ? and(eq(questions.status, 'published'), eq(questions.eraId, eraId))
        : eq(questions.status, 'published')
    )
    .orderBy(sql`random()`)
    .limit(questionCount);

  if (pool.length === 0) {
    return apiError('NO_QUESTIONS', 'Нийтлэгдсэн асуулт олдсонгүй', 503, true);
  }

  const { issuedAt, expiresAt } = makeExpiry(pool.length);

  // Сессийг ӨС-д бүртгэнэ — attempts.session_id-ийн FK шаардлагатай
  const nonce = crypto.randomUUID();
  const [session] = await db
    .insert(quizSessions)
    .values({
      userId,
      issuedAt: new Date(issuedAt),
      expiresAt: new Date(expiresAt),
      questionIds: pool.map((q) => q.id),
      serverNonce: nonce,
      mode,
    })
    .returning({ id: quizSessions.id });

  if (!session) {
    return apiError('SESSION_CREATE_FAILED', 'Сесс үүсгэж чадсангүй', 500, true);
  }

  // Алдааны засвар №4: асуулт ТУС БҮРИЙН servedAt.
  // MVP-д бүх асуулт нэг зэрэг үйлчлэгдэнэ; клиент асуулт харуулах бүрд
  // /api/quiz/answer руу илгээх хүртэлх хугацааг сервер тооцно.
  const servedAt: Record<string, number> = {};
  const now = Date.now();
  for (const q of pool) servedAt[String(q.id)] = now;

  const token = signSession({
    sessionId: session.id,
    userId,
    questionIds: pool.map((q) => q.id),
    servedAt,
    issuedAt,
    expiresAt,
    mode,
    heroEraId,
    eraBonusMultiplier,
  });

  const fiftyFiftyAvailable =
    heroHasFiftyFifty && profile.fiftyFiftyUsedDate !== todayInUlaanbaatar();

  return NextResponse.json({
    sessionId: session.id,
    token,
    expiresAt,
    mode,
    extraSecondsPerQuestion: extraSeconds,
    fiftyFiftyAvailable,
    questions: pool.map((q) => ({
      id: q.id,
      eraId: q.eraId,
      difficulty: q.difficulty as 'easy' | 'medium' | 'hard',
      body: q.body,
      options: q.options as string[],
      servedAt: now,
    })),
  });
});
