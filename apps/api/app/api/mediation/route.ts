/**
 * POST /api/mediation — «дүү нартаа тайлбарла» (ROADMAP C1)
 *
 * СУДАЛГААНЫ ҮНДЭСЛЭЛ: López-Enríquez нарын тоймд орсон 105 баримтын нэг
 * нь ч CEFR-ийн зуучлалыг хэмжээгүй. Энэ маршрут нь дипломын шинэлэг
 * талын гол нотолгоо — «өвийн хэлний нөхцөлд зуучлалыг геймификацитай
 * орчинд хэмжсэн анхны судалгаа».
 *
 * ⚠ ОНООГ ЗӨВХӨН СЕРВЕР ТООЦООЛНО (Бүлэг 6.1). Клиентээс ирсэн ямар ч
 *   оноонд итгэхгүй — зөвхөн түүхий текстийг авна.
 *
 * ⚠ НУУЦЛАЛ: бичсэн текст өөр хэрэглэгчид ХЭЗЭЭ Ч харагдахгүй. Тиймээс
 *   Бүлэг 6.5-ын чөлөөт бичвэрийн модерацийн эрсдэл үүсэхгүй.
 *
 * ⚠ ХИЙ ҮЗЭГДЭЛГҮЙ: оноолт нь детерминист (`scoreMediation`), LLM
 *   шаардахгүй. Түлхүүр нэмэгдвэл LLM зөвхөн чанарын сэтгэгдэл нэмнэ.
 */
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { mediationXp, scoreMediation, type MediationKind } from '@nomad/core';
import { MediationRequestSchema } from '@nomad/contracts';
import { mediationAttempts, profiles, questions } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, requireAuth, route } from '@/lib/api';
import { isUniqueViolation } from '@/lib/pgError';
import { checkRateLimit } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const parsed = await parseBody(req, MediationRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { questionId, userText } = parsed.data;
  /** zod default нь оролтын төрөлд undefined үлдээдэг тул энд бататгана */
  const kind: MediationKind = parsed.data.kind ?? 'explain_simple';

  const rl = await checkRateLimit(userId);
  if (!rl.allowed) {
    return apiError('RATE_LIMITED', 'Хэт олон хүсэлт. Түр хүлээнэ үү.', 429, true);
  }

  // ─── Жишиг эх — асуултын албан ёсны тайлбар ───
  const [q] = await db
    .select({
      explanation: questions.explanation,
      status: questions.status,
    })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  if (!q || q.status !== 'published') {
    return apiError('QUESTION_NOT_FOUND', 'Ийм асуулт олдсонгүй', 404);
  }

  // ─── Оноолт — цэвэр функц, сервер дээр ───
  const result = scoreMediation({
    userText,
    referenceText: q.explanation,
    kind,
  });

  const potentialXp = mediationXp(result);

  // ─── XP нэг асуултад НЭГ УДАА ───
  // Дахин бичих боломжтой (сурах үйл явц) ч XP давхардахгүй.
  let alreadyRewarded = false;
  let xpAwarded = 0;

  try {
    await db.insert(mediationAttempts).values({
      userId,
      questionId,
      kind,
      userText,
      score: result.score,
      passed: result.passed,
      xpAwarded: potentialXp,
    });
    xpAwarded = potentialXp;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;

    // Өмнө нь оролдсон — оноог шинэчилнэ, гэхдээ XP дахин олгохгүй
    alreadyRewarded = true;
    await db
      .update(mediationAttempts)
      .set({ userText, score: result.score, passed: result.passed })
      .where(
        and(
          eq(mediationAttempts.userId, userId),
          eq(mediationAttempts.questionId, questionId),
          eq(mediationAttempts.kind, kind)
        )
      );
  }

  // ─── Профайлд XP нэмнэ ───
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
    score: result.score,
    coverageScore: result.coverageScore,
    originalityScore: result.originalityScore,
    lengthScore: result.lengthScore,
    passed: result.passed,
    copied: result.copied,
    matchedTerms: result.matchedTerms,
    missedTerms: result.missedTerms,
    feedback: result.feedback,
    xpAwarded,
    alreadyRewarded,
  });
});
