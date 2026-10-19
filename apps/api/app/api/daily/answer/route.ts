/**
 * POST /api/daily/answer — хариулт (Бүлэг 6.1: сервер оноолно)
 *
 * Клиент зөвхөн ХАРАГДАХ индексээ илгээнэ. Сервер:
 *   1. асуулт нээгдсэн эсэх, хугацаа (СЕРВЕРИЙН цагаар)
 *   2. харагдах → хадгалсан индекс рүү хөрвүүлэх
 *   3. `answered_at IS NULL` нөхцөлтэй бичих — хоёр дахь хариулт ХЭЗЭЭ Ч орохгүй
 *   4. сүүлийн асуулт бол тоглолтыг хаах
 *
 * ИДЕМПОТЕНТ: сүлжээ тасарч дахин илгээвэл анхны хариултын дүнг буцаана —
 * хариултаа өөрчлөх боломжгүй.
 */
import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { QUESTION_TIME_LIMIT_MS, toCanonicalIndex, toDisplayIndex } from '@nomad/core';
import { DailyAnswerRequestSchema } from '@nomad/contracts';
import { dailyAnswers } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, requireAuth, route, tooManyRequests } from '@/lib/api';
import {
  answersOf,
  correctRates,
  displayOrder,
  findPlay,
  finishIfComplete,
  getDailySet,
  isExpired,
  loadQuestion,
  type AnswerRow,
  type QuestionRecord,
} from '@/lib/daily';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Бүлэг 6.1: цагт 120 хариулт — хүн өдөрт 5 л хариулна, бот л хэтрүүлнэ */
const ANSWERS_PER_HOUR = 120;

export const POST = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const rl = await rateLimit(`answer:${userId}`, ANSWERS_PER_HOUR, 3600);
  if (!rl.allowed) return tooManyRequests('Хэт олон хариулт илгээлээ. Түр хүлээнэ үү.', rl.resetSec);

  const parsed = await parseBody(req, DailyAnswerRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { dayKey, position, selectedIndex } = parsed.data;

  const now = Date.now();
  const set = await getDailySet(dayKey, now);
  if (!set.ok) return apiError(set.reason, 'Энэ өдрийн тав олдсонгүй', 404);

  const play = await findPlay(userId, dayKey);
  if (!play) return apiError('NO_PLAY', 'Энэ өдрийг эхлүүлээгүй байна', 404);

  const answers = await answersOf(play.id);
  let row = answers.find((a) => a.position === position);
  if (!row) return apiError('NOT_SERVED', 'Энэ асуулт хараахан нээгдээгүй байна', 409);

  const q = await loadQuestion(row.questionId);
  if (!q) return apiError('QUESTION_NOT_FOUND', 'Асуулт олдсонгүй', 404);
  const order = displayOrder(dayKey, q);

  if (row.answeredAt === null) {
    const timedOut = selectedIndex === -1 || isExpired(row.servedAt, now);
    const canonical = timedOut ? -1 : toCanonicalIndex(order, selectedIndex);
    if (canonical === null) {
      return apiError('BAD_OPTION', 'Ийм сонголт байхгүй', 422);
    }

    const [updated] = await db
      .update(dailyAnswers)
      .set({
        answeredAt: new Date(now),
        selectedIndex: canonical,
        isCorrect: !timedOut && canonical === q.correctIndex,
        responseMs: timedOut
          ? QUESTION_TIME_LIMIT_MS
          : Math.min(QUESTION_TIME_LIMIT_MS, Math.max(0, now - row.servedAt.getTime())),
      })
      .where(
        and(
          eq(dailyAnswers.playId, play.id),
          eq(dailyAnswers.position, position),
          isNull(dailyAnswers.answeredAt)
        )
      )
      .returning();

    // Зэрэг ирсэн хариулт аль хэдийн бичигдсэн — тэр дүнг буцаана
    row = updated ?? (await answersOf(play.id)).find((a) => a.position === position) ?? row;
  }

  const finishedPlay = await finishIfComplete(play, set.questionIds.length, now);
  const rates = await correctRates(dayKey);

  return NextResponse.json(
    {
      ...resultOf(row, q, order),
      correctRate: rates.get(position) ?? null,
      finished: finishedPlay.finishedAt !== null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
});

/** Хадгалсан хариултыг ХАРАГДАХ индекс рүү хөрвүүлнэ */
function resultOf(row: AnswerRow, q: QuestionRecord, order: number[]) {
  const timedOut = row.selectedIndex === -1;
  return {
    position: row.position,
    isCorrect: row.isCorrect === true,
    timedOut,
    correctIndex: toDisplayIndex(order, q.correctIndex),
    selectedIndex: timedOut || row.selectedIndex === null ? -1 : toDisplayIndex(order, row.selectedIndex),
    responseMs: row.responseMs ?? 0,
    explanation: q.explanation,
    sourceRef: q.sourceRef,
  };
}
