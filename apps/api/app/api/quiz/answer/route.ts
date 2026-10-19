/**
 * POST /api/quiz/answer — Алхам 2+3 (Бүлэг 6.1)
 *
 * Клиент зөвхөн сонголтоо буцаана. Сервер:
 *   token шалгах → хугацаа (СЕРВЕРИЙН цагаар) → давхар хариулт биш эсэх
 *   → rate limit → оноолох → attempts-д бичих
 *
 * Давхар хариултаас ӨС-ийн UNIQUE(session_id, question_id) хамгаална —
 * програмын шалгалт бүтэлгүйтсэн ч ӨС барина.
 */
import { NextResponse } from 'next/server';
import {
  applyEraBonus,
  computeAnswerXp,
  DAILY_EASY_LIMIT,
  serverResponseMs,
  todayInUlaanbaatar,
  ubDateToUtcMs,
  type Difficulty,
} from '@nomad/core';
import { SubmitAnswerRequestSchema } from '@nomad/contracts';
import { and, eq, gte, sql } from 'drizzle-orm';
import { attempts, questions } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, requireAuth, route } from '@/lib/api';
import { verifySession } from '@/lib/session';
import { checkRateLimit } from '@/lib/redis';
import { isUniqueViolation } from '@/lib/pgError';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(req, SubmitAnswerRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { token, questionId, selectedIndex, confidenceLevel } = parsed.data;

  // ─── Token шалгалт ───
  const verified = verifySession(token);
  if (!verified.ok) {
    if (verified.error === 'EXPIRED') {
      // Алдааны засвар №3: клиент энэ кодыг таньж шинэ сесс эхлүүлнэ
      return apiError(
        'SESSION_EXPIRED',
        'Сессийн хугацаа дууссан. Шинэ сорил эхлүүлнэ үү.',
        410,
        true
      );
    }
    return apiError('INVALID_TOKEN', 'Хүчингүй session token', 401);
  }
  const s = verified.payload;

  if (s.userId !== auth.user.userId) {
    return apiError('TOKEN_USER_MISMATCH', 'Token өөр хэрэглэгчийнх байна', 403);
  }
  if (!s.questionIds.includes(questionId)) {
    return apiError('QUESTION_NOT_IN_SESSION', 'Асуулт энэ сесст байхгүй', 400);
  }

  // ─── Rate limit (Бүлэг 6.1: цагт 120) ───
  const rl = await checkRateLimit(auth.user.userId);
  if (!rl.allowed) {
    return apiError(
      'RATE_LIMITED',
      'Хэт олон хариулт илгээлээ. Түр хүлээнэ үү.',
      429,
      true
    );
  }

  // ─── Асуулт ───
  const [question] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  if (!question) {
    return apiError('QUESTION_NOT_FOUND', 'Асуулт олдсонгүй', 404);
  }

  // ─── Оноолт (СЕРВЕРИЙН цагаар) ───
  const servedAt = s.servedAt[String(questionId)] ?? s.issuedAt;
  const responseMs = serverResponseMs(servedAt, Date.now());

  const isCorrect = selectedIndex === question.correctIndex;

  const { xp: rawXp, timeBonusApplied } = computeAnswerXp({
    difficulty: question.difficulty as Difficulty,
    isCorrect,
    responseMs,
  });

  // ─── G1 · Бүлэг 3.6: «Зөв хариулт (амархан) — хязгаар өдөрт 20 асуулт» ───
  // Өдрийн хязгаараас хэтэрсэн амархан асуултад XP олгохгүй (хариулт нь
  // бүртгэгдсээр байна — зөвхөн оноо тасарна).
  let baseXp = rawXp;
  let dailyLimitReached = false;

  if (isCorrect && question.difficulty === 'easy') {
    const dayStart = new Date(ubDateToUtcMs(todayInUlaanbaatar()));
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(attempts)
      .innerJoin(questions, eq(attempts.questionId, questions.id))
      .where(
        and(
          eq(attempts.userId, auth.user.userId),
          eq(attempts.isCorrect, true),
          eq(questions.difficulty, 'easy'),
          gte(attempts.createdAt, dayStart)
        )
      );

    if ((row?.n ?? 0) >= DAILY_EASY_LIMIT) {
      baseXp = 0;
      dailyLimitReached = true;
    }
  }

  // Perk 4: эриний бонус ×1.5 (Бүлэг 3.2)
  const xpWithEra = applyEraBonus(
    baseXp,
    s.heroEraId,
    question.eraId,
    s.eraBonusMultiplier !== null
      ? { eraBonusMultiplier: s.eraBonusMultiplier }
      : {}
  );
  const eraBonusApplied = xpWithEra !== baseXp;

  // ─── attempts-д бичих; давхар хариулт бол UNIQUE зөрчил гарна ───
  try {
    await db.insert(attempts).values({
      userId: auth.user.userId,
      questionId,
      sessionId: s.sessionId,
      isCorrect,
      responseMs,
      confidenceLevel: confidenceLevel ?? null,
      xpAwarded: xpWithEra,
    });
  } catch (err) {
    // ⚠ Мессежээр БИШ, SQLSTATE-ээр шалгана. Drizzle 0.45 алдааг
    // `DrizzleQueryError` дотор боодог тул мессежид хязгаарлалтын нэр
    // байхаа больсон — мессежээр шалгавал 409-ийн оронд 500 буцаана.
    if (isUniqueViolation(err, 'attempts_session_question_uq')) {
      return apiError(
        'ALREADY_ANSWERED',
        'Энэ асуултад аль хэдийн хариулсан байна',
        409
      );
    }
    throw err;
  }

  return NextResponse.json({
    questionId,
    isCorrect,
    correctIndex: question.correctIndex, // зөвхөн ОДОО буцна
    xpAwarded: xpWithEra,
    timeBonusApplied,
    eraBonusApplied,
    dailyLimitReached,
    responseMs,
    explanation: question.explanation,
    sourceRef: question.sourceRef,
  });
});
