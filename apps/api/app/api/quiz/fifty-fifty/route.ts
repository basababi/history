/**
 * POST /api/quiz/fifty-fifty — Perk 2 (Бүлэг 3.2)
 *
 * «Хагас хасах (50/50): Өдөрт нэг удаа буруу хариултын хагасыг арилгах.»
 *
 * ЗААВАЛ СЕРВЕРЭЭС: зөв хариултын индексийг мэдэх шаардлагатай тул
 * клиент дээр хийвэл correctIndex-ийг задруулна (Бүлэг 6.1 зөрчил).
 * Алдааны засвар №7 — өмнө нь энэ perk огт хэрэгжээгүй байсан.
 */
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { applyFiftyFifty, todayInUlaanbaatar } from '@nomad/core';
import { FiftyFiftyRequestSchema } from '@nomad/contracts';
import { heroes, profiles, questions } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, requireAuth, route } from '@/lib/api';
import { verifySession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const parsed = await parseBody(req, FiftyFiftyRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { token, questionId } = parsed.data;

  const verified = verifySession(token);
  if (!verified.ok) {
    return verified.error === 'EXPIRED'
      ? apiError('SESSION_EXPIRED', 'Сессийн хугацаа дууссан', 410, true)
      : apiError('INVALID_TOKEN', 'Хүчингүй session token', 401);
  }
  const s = verified.payload;
  if (s.userId !== userId) {
    return apiError('TOKEN_USER_MISMATCH', 'Token өөр хэрэглэгчийнх', 403);
  }
  if (!s.questionIds.includes(questionId)) {
    return apiError('QUESTION_NOT_IN_SESSION', 'Асуулт энэ сесст байхгүй', 400);
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile) return apiError('NO_PROFILE', 'Профайл олдсонгүй', 404);

  // Идэвхтэй баатарт perk байгаа эсэх
  if (profile.activeHeroId === null) {
    return apiError('NO_PERK', 'Идэвхтэй баатар сонгоогүй байна', 403);
  }
  const [hero] = await db
    .select({ perk: heroes.perk })
    .from(heroes)
    .where(eq(heroes.id, profile.activeHeroId))
    .limit(1);
  if ((hero?.perk as { fiftyFifty?: boolean })?.fiftyFifty !== true) {
    return apiError(
      'NO_PERK',
      'Энэ баатарт 50/50 чадвар байхгүй',
      403
    );
  }

  const today = todayInUlaanbaatar();
  const usedToday = profile.fiftyFiftyUsedDate === today;

  const [question] = await db
    .select({ options: questions.options, correctIndex: questions.correctIndex })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);
  if (!question) return apiError('QUESTION_NOT_FOUND', 'Асуулт олдсонгүй', 404);

  const result = applyFiftyFifty(
    (question.options as string[]).length,
    question.correctIndex,
    usedToday
  );

  if (!result.allowed) {
    return apiError(
      'PERK_USED_TODAY',
      'Өнөөдөр 50/50-г аль хэдийн ашигласан байна',
      429
    );
  }

  // Ашигласныг тэмдэглэнэ — өдөрт 1 удаа
  await db
    .update(profiles)
    .set({ fiftyFiftyUsedDate: today })
    .where(eq(profiles.userId, userId));

  return NextResponse.json({
    hiddenIndexes: result.hiddenIndexes,
    remainingToday: 0,
  });
});
