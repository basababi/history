/**
 * GET  /api/story — нийтлэгдсэн өгүүлэмжийн жагсаалт ба граф
 * POST /api/story — өгүүлэмж дуусгасныг бүртгэж XP олгох
 *
 * ROADMAP C2 · СУДАЛГААНЫ ҮНДЭСЛЭЛ: Khan-ы тоймд өгүүлэмж хамгийн олон
 * давтагдсан элемент. López-Enríquez нарын ангиллаар «Structural» →
 * «Narrative» шилжилт — дипломын шинэлэг талын гол хэсэг.
 *
 * ⚠ ЗӨВХӨН `published` ӨГҮҮЛЭМЖ ГАРНА (Бүлэг 6.2). Түүхч батлаагүй
 *   контент хүүхдэд харагдахгүй — асуулттай ижил засаглал.
 *
 * ⚠ ОНООГ СЕРВЕР ШАЛГАНА (Бүлэг 6.1): клиент явсан замаа илгээх ба
 *   сервер тэр замыг ГРАФ ДЭЭР ДАХИН АЛХАЖ баталгаажуулна. Хуурамч зам
 *   илгээж XP авах боломжгүй.
 */
import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { STORY_XP, walkStoryPath, type StoryChoice, type StoryNode } from '@nomad/core';
import { StoryCompleteRequestSchema } from '@nomad/contracts';
import { profiles, stories, storyCompletions, storyNodes } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, requireAuth, route } from '@/lib/api';
import { isUniqueViolation } from '@/lib/pgError';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** ӨС-ийн jsonb-ийг төрөлжсөн сонголт болгоно */
function toChoices(raw: unknown): StoryChoice[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is StoryChoice =>
      typeof c === 'object' &&
      c !== null &&
      typeof (c as StoryChoice).label === 'string' &&
      typeof (c as StoryChoice).nextKey === 'string'
  );
}

async function loadNodes(storyId: number): Promise<StoryNode[]> {
  const rows = await db
    .select()
    .from(storyNodes)
    .where(eq(storyNodes.storyId, storyId))
    .orderBy(asc(storyNodes.id));

  return rows.map((r) => ({
    key: r.key,
    body: r.body,
    choices: toChoices(r.choices),
    ...(r.endingLabel ? { endingLabel: r.endingLabel } : {}),
  }));
}

export const GET = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  // ⚠ Зөвхөн published — түүхчийн хяналт (Бүлэг 6.2)
  const rows = await db
    .select()
    .from(stories)
    .where(eq(stories.status, 'published'))
    .orderBy(asc(stories.id));

  const done = await db
    .select({ storyId: storyCompletions.storyId, endingKey: storyCompletions.endingKey })
    .from(storyCompletions)
    .where(eq(storyCompletions.userId, userId));
  const doneMap = new Map(done.map((d) => [d.storyId, d.endingKey]));

  const out = [];
  for (const s of rows) {
    out.push({
      id: s.id,
      eraId: s.eraId,
      title: s.title,
      summary: s.summary,
      sourceRef: s.sourceRef,
      xpReward: s.xpReward,
      completedEnding: doneMap.get(s.id) ?? null,
      nodes: await loadNodes(s.id),
    });
  }

  return NextResponse.json({ stories: out });
});

export const POST = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const parsed = await parseBody(req, StoryCompleteRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { storyId, path } = parsed.data;

  const [story] = await db
    .select()
    .from(stories)
    .where(and(eq(stories.id, storyId), eq(stories.status, 'published')))
    .limit(1);

  if (!story) {
    return apiError('STORY_NOT_FOUND', 'Ийм өгүүлэмж олдсонгүй', 404);
  }

  // ─── Замыг СЕРВЕР дахин алхаж шалгана ───
  const nodes = await loadNodes(storyId);
  const walk = walkStoryPath(nodes, path);

  if (!walk.valid || !walk.endingKey) {
    return apiError(
      'INVALID_PATH',
      'Өгүүлэмжийн зам буруу байна — дуусгаад дахин оролдоно уу',
      400
    );
  }

  const xpReward = story.xpReward > 0 ? story.xpReward : STORY_XP;

  // ─── XP нэг өгүүлэмжид НЭГ УДАА ───
  // Дахин тоглож өөр төгсгөл үзэж болно, гэхдээ XP давхардахгүй.
  let xpAwarded = 0;
  let alreadyCompleted = false;

  try {
    await db.insert(storyCompletions).values({
      userId,
      storyId,
      endingKey: walk.endingKey,
      xpAwarded: xpReward,
    });
    xpAwarded = xpReward;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    alreadyCompleted = true;
    // Хүрсэн төгсгөлийг шинэчилнэ — сүүлд үзсэн төгсгөл харагдана
    await db
      .update(storyCompletions)
      .set({ endingKey: walk.endingKey })
      .where(
        and(eq(storyCompletions.userId, userId), eq(storyCompletions.storyId, storyId))
      );
  }

  if (xpAwarded > 0) {
    const [profile] = await db
      .select({ xp: profiles.xp })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    if (profile) {
      await db
        .update(profiles)
        .set({ xp: profile.xp + xpAwarded })
        .where(eq(profiles.userId, userId));
    }
  }

  return NextResponse.json({
    endingKey: walk.endingKey,
    xpAwarded,
    alreadyCompleted,
  });
});
