/**
 * POST /api/content/report — «Энэ асуулт буруу байна» (Бүлэг 6.2, 6.3)
 *
 * 🔴 Бүлэг 6.3-ын эмпирик засвар (Lee, Yi, Kim 2020 — IEEE Access):
 * геймификаци нийцлийн каппаг 0.93 → 0.34 УНАГАСАН. Тиймээс:
 *
 *   1. Баталгаажуулалтын үйлдэлд XP, оноо, чансаа ОГТ ОЛГОХГҮЙ
 *   3. Чөлөөт бичвэрийн оронд БҮТЭЦЛЭГДСЭН ангиллын сонголт
 *
 * «Геймификацийг МЭДЛЭГ ОЛЖ АВАХ үйлдэлд хэрэглэнэ,
 *  МЭДЛЭГ БАТАЛГААЖУУЛАХ үйлдэлд хэрэглэхгүй.»
 */
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { ContentReportRequestSchema } from '@nomad/contracts';
import { contentReviews, questions } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, requireAuth, route } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const parsed = await parseBody(req, ContentReportRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { questionId, reason, note } = parsed.data;

  const [question] = await db
    .select({ id: questions.id, isGolden: questions.isGoldenStandard })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);
  if (!question) return apiError('QUESTION_NOT_FOUND', 'Асуулт олдсонгүй', 404);

  await db.insert(contentReviews).values({
    questionId,
    reviewerId: userId,
    verdict: 'report',
    // Бүтэцлэгдсэн шалтгаан + сонголтот тайлбар
    note: note ? `${reason}: ${note}` : reason,
  });

  // ⚠ XP ОЛГОХГҮЙ. Энэ бол шагнал биш, ҮҮРЭГ (Бүлэг 6.3 засвар №2).
  return NextResponse.json({ queued: true, xpAwarded: 0 as const });
});
