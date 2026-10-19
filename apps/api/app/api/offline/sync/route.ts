/**
 * POST /api/offline/sync — офлайн хариултын дараалал (Бүлэг 6.6)
 *
 * «Sync хийхдээ СЕРВЕРИЙН цагаар дахин баталгаажуулна — офлайн байдлыг
 *  ашиглан хууран мэхлэхээс сэргийлнэ (хамгийн ихдээ 24 цагийн хоцрогдол).»
 *
 * Хамгаалалт:
 *   - clientAnsweredAt ирээдүйд байвал татгалзана (цаг хуурсан)
 *   - 24 цагаас хэтэрсэн бол татгалзана
 *   - offline_sync_log-ийн UNIQUE давхардлыг барина
 *   - Оноог сервер дахин тооцоолно; клиентийн XP-д итгэхгүй
 */
import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import {
  acceptOfflineAttempt,
  computeAnswerXp,
  todayInUlaanbaatar,
  type Difficulty,
} from '@nomad/core';
import { OfflineSyncRequestSchema } from '@nomad/contracts';
import { offlineSyncLog, profiles, questions, quizSessions } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, requireAuth, route } from '@/lib/api';
import { checkRateLimit } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const parsed = await parseBody(req, OfflineSyncRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { attempts: incoming } = parsed.data;

  if (incoming.length === 0) {
    return NextResponse.json({ accepted: 0, rejected: [], xpAwarded: 0 });
  }

  const rl = await checkRateLimit(userId);
  if (!rl.allowed) {
    return apiError('RATE_LIMITED', 'Хэт олон хүсэлт. Түр хүлээнэ үү.', 429, true);
  }

  const serverNow = Date.now();
  const rejected: Array<{ questionId: number; reason: string }> = [];

  // ─── Асуултуудыг нэг удаа татна ───
  const ids = [...new Set(incoming.map((a) => a.questionId))];
  const qRows = await db
    .select({
      id: questions.id,
      difficulty: questions.difficulty,
      correctIndex: questions.correctIndex,
      status: questions.status,
    })
    .from(questions)
    .where(inArray(questions.id, ids));
  const qMap = new Map(qRows.map((q) => [q.id, q]));

  // ─── Офлайн сесс үүсгэнэ (attempts.session_id-ийн FK) ───
  const [session] = await db
    .insert(quizSessions)
    .values({
      userId,
      issuedAt: new Date(serverNow),
      expiresAt: new Date(serverNow),
      questionIds: ids,
      serverNonce: `offline-${crypto.randomUUID()}`,
      mode: 'free',
    })
    .returning({ id: quizSessions.id });

  if (!session) {
    return apiError('SESSION_CREATE_FAILED', 'Sync сесс үүсгэж чадсангүй', 500, true);
  }

  let xpAwarded = 0;
  let accepted = 0;

  for (const item of incoming) {
    // 1) Цагийн шалгалт — СЕРВЕРИЙН цагаар
    const timeCheck = acceptOfflineAttempt({
      clientAnsweredAt: item.answeredAt,
      serverNow,
    });
    if (!timeCheck.accepted) {
      rejected.push({ questionId: item.questionId, reason: timeCheck.reason ?? 'REJECTED' });
      continue;
    }

    // 2) Асуулт хүчинтэй эсэх
    const q = qMap.get(item.questionId);
    if (!q || q.status !== 'published') {
      rejected.push({ questionId: item.questionId, reason: 'QUESTION_NOT_FOUND' });
      continue;
    }

    // 3) Давхардлын хамгаалалт — UNIQUE(userId, questionId, answeredAt)
    const logged = await db
      .insert(offlineSyncLog)
      .values({
        userId,
        questionId: item.questionId,
        answeredAt: new Date(item.answeredAt),
      })
      .onConflictDoNothing()
      .returning({ id: offlineSyncLog.id });

    if (logged.length === 0) {
      rejected.push({ questionId: item.questionId, reason: 'DUPLICATE' });
      continue;
    }

    // 4) Оноог СЕРВЕР тооцоолно — клиентийн XP-д итгэхгүй
    const isCorrect = item.selectedIndex === q.correctIndex;
    const { xp } = computeAnswerXp({
      difficulty: q.difficulty as Difficulty,
      isCorrect,
      responseMs: item.responseMs,
    });

    xpAwarded += xp;
    accepted += 1;
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
        .set({
          xp: profile.xp + xpAwarded,
          lastActiveDate: todayInUlaanbaatar(serverNow),
        })
        .where(eq(profiles.userId, userId));
    }
  }

  return NextResponse.json({ accepted, rejected, xpAwarded });
});
