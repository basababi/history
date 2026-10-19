/**
 * GET /api/offline/pack — маргаашийн quiz багц (Бүлэг 6.6)
 *
 * «Орон нутгийн интернэт холболт тогтворгүй, цахилгааны тасалдал байдаг
 *  нөхцөлийг архитектурт тусгана. Энэ нь техникийн шаардлага төдийгүй
 *  бодит ялгарах давуу тал.» — SDG 4-ийн шууд хувь нэмэр.
 *
 * ⚠ correctIndex ЭНД Ч ЯВАХГҮЙ. Офлайн хариултыг sync үед сервер оноолно.
 */
import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { todayInUlaanbaatar } from '@nomad/core';
import { questions } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, requireAuth, route } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Офлайн багцын хэмжээ — 2 өдрийн сорилд хүрэлцэнэ */
const PACK_SIZE = 25;

export const GET = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const pool = await db
    .select({
      id: questions.id,
      eraId: questions.eraId,
      difficulty: questions.difficulty,
      body: questions.body,
      options: questions.options,
    })
    .from(questions)
    .where(eq(questions.status, 'published'))
    .orderBy(sql`random()`)
    .limit(PACK_SIZE);

  if (pool.length === 0) {
    return apiError('NO_QUESTIONS', 'Нийтлэгдсэн асуулт олдсонгүй', 503, true);
  }

  const now = Date.now();

  return NextResponse.json({
    packDate: todayInUlaanbaatar(now),
    // Багц 48 цаг хүчинтэй — sync-ийн 24 цагийн хязгаартай нийцнэ
    expiresAt: now + 48 * 60 * 60 * 1000,
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
