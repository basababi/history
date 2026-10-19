/**
 * POST /api/battle/round — PvP тойрог (Бүлэг 7.3)
 *
 * ⚠ ХЯЗГААР: бодит real-time PvP (Ably/Socket.io) хараахан холбогдоогүй.
 * Өрсөлдөгч нь СЕРВЕРИЙН талд ажиллах бот. Гэхдээ оноолт нь бүрэн
 * server-authoritative — клиент зөв хариултыг ХЭЗЭЭ Ч мэдэхгүй (Бүлэг 6.1).
 *
 * Бодит хүн нэмэгдэхэд энэ endpoint-ийн гэрээ өөрчлөгдөхгүй.
 */
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  botAccuracy,
  botResponseMs,
  resolveRound,
  serverResponseMs,
} from '@nomad/core';
import { profiles, questions } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, requireAuth, route } from '@/lib/api';
import { verifySession } from '@/lib/session';
import { checkRateLimit } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BattleRoundSchema = z.object({
  token: z.string().min(16),
  questionId: z.number().int(),
  selectedIndex: z.number().int().min(-1).max(9),
});

export const POST = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const parsed = await parseBody(req, BattleRoundSchema);
  if (!parsed.ok) return parsed.response;
  const { token, questionId, selectedIndex } = parsed.data;

  const verified = verifySession(token);
  if (!verified.ok) {
    return verified.error === 'EXPIRED'
      ? apiError('SESSION_EXPIRED', 'Тулааны хугацаа дууслаа', 410, true)
      : apiError('INVALID_TOKEN', 'Хүчингүй session token', 401);
  }
  const s = verified.payload;
  if (s.userId !== userId) {
    return apiError('TOKEN_USER_MISMATCH', 'Token өөр хэрэглэгчийнх', 403);
  }
  if (!s.questionIds.includes(questionId)) {
    return apiError('QUESTION_NOT_IN_SESSION', 'Асуулт энэ тулаанд байхгүй', 400);
  }

  const rl = await checkRateLimit(userId);
  if (!rl.allowed) {
    return apiError('RATE_LIMITED', 'Хэт олон хүсэлт', 429, true);
  }

  const [question] = await db
    .select({ correctIndex: questions.correctIndex, explanation: questions.explanation })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);
  if (!question) return apiError('QUESTION_NOT_FOUND', 'Асуулт олдсонгүй', 404);

  const [profile] = await db
    .select({ xp: profiles.xp })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  const servedAt = s.servedAt[String(questionId)] ?? s.issuedAt;
  const playerMs = serverResponseMs(servedAt, Date.now());

  const accuracy = botAccuracy(profile?.xp ?? 0);
  const opponentCorrect = Math.random() < accuracy;
  const opponentMs = botResponseMs();

  const outcome = resolveRound({
    playerCorrect: selectedIndex === question.correctIndex,
    opponentCorrect,
    playerMs,
    opponentMs,
  });

  return NextResponse.json({
    ...outcome,
    correctIndex: question.correctIndex,
    explanation: question.explanation,
    opponentIsBot: true,
  });
});
