/**
 * POST /api/daily/next — дараагийн асуултыг НЭЭНЭ
 *
 * Сервер нээсэн мөчийг (`servedAt`) бичнэ — хариултын хугацаа үүнээс
 * хэмжигдэнэ. Дуудлага идемпотент:
 *   • нээгдсэн, хариулаагүй асуулт байвал ТЭР асуултыг үлдсэн хугацаатай нь буцаана
 *   • хугацаа нь хэтэрсэн бол «хугацаа дууссан» болгоод дараагийнхыг нээнэ
 *   • бүгд хариулагдсан бол тоглолтыг хааж `{ done: true }`
 *
 * Өнгөрсөн өдрийг зөвхөн сорилтын линкээр (тэр өдрийн багц байгаа үед) тоглоно.
 */
import { NextResponse } from 'next/server';
import { isValidShareCode, normalizeShareCode } from '@nomad/core';
import { DailyNextRequestSchema } from '@nomad/contracts';
import { dailyAnswers } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, requireAuth, route } from '@/lib/api';
import {
  answersOf,
  expireIfStale,
  findOrCreatePlay,
  findPlay,
  findPlayByShareCode,
  finishIfComplete,
  getDailySet,
  loadQuestion,
  servedQuestion,
  type AnswerRow,
} from '@/lib/daily';
import { isUniqueViolation } from '@/lib/pgError';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY_ERRORS = {
  BAD_DAY: { status: 400, message: 'Өдрийн формат буруу байна' },
  FUTURE_DAY: { status: 400, message: 'Ирээдүйн өдрийг тоглох боломжгүй' },
  NO_SUCH_DAY: { status: 404, message: 'Энэ өдрийн тав олдсонгүй' },
  NO_QUESTIONS: { status: 503, message: 'Өнөөдрийн асуулт бэлэн болоогүй байна' },
} as const;

export const POST = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const parsed = await parseBody(req, DailyNextRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { dayKey, challengeCode } = parsed.data;

  const now = Date.now();
  const set = await getDailySet(dayKey, now);
  if (!set.ok) {
    const e = DAY_ERRORS[set.reason];
    return apiError(set.reason, e.message, e.status, set.reason === 'NO_QUESTIONS');
  }
  const ids = set.questionIds;

  // Сорилт — зөвхөн ИЖИЛ өдрийн, ӨӨР хүний дууссан тоглолт
  let challengedByPlayId: number | null = null;
  if (challengeCode && !(await findPlay(userId, dayKey))) {
    const code = normalizeShareCode(challengeCode);
    if (isValidShareCode(code)) {
      const source = await findPlayByShareCode(code);
      if (source && source.dayKey === dayKey && source.userId !== userId && source.finishedAt) {
        challengedByPlayId = source.id;
      }
    }
  }

  const play = await findOrCreatePlay(userId, dayKey, { now, challengedByPlayId });
  if (play.finishedAt) return NextResponse.json({ done: true });

  let answers = await answersOf(play.id);

  // Нээгдсэн боловч хариулаагүй асуулт
  const open = answers.find((a) => a.answeredAt === null);
  if (open) {
    if (await expireIfStale(open, now)) {
      answers = await answersOf(play.id);
    } else {
      return respondWith(dayKey, open, ids.length, now, marksOf(answers));
    }
  }

  const position = answers.length;
  if (position >= ids.length) {
    await finishIfComplete(play, ids.length, now);
    return NextResponse.json({ done: true });
  }

  const questionId = ids[position];
  if (questionId === undefined) return apiError('BAD_SET', 'Өдрийн багц эвдэрсэн байна', 500, true);

  let served: AnswerRow | undefined;
  try {
    [served] = await db
      .insert(dailyAnswers)
      .values({ playId: play.id, position, questionId, servedAt: new Date(now) })
      .returning();
  } catch (err) {
    // Зэрэг ирсэн хоёр «next» — нөгөө нь аль хэдийн нээсэн
    if (!isUniqueViolation(err)) throw err;
    served = (await answersOf(play.id)).find((a) => a.position === position);
  }
  if (!served) return apiError('SERVE_FAILED', 'Асуулт нээж чадсангүй', 500, true);

  return respondWith(dayKey, served, ids.length, now, marksOf(answers));
});

/** Хариулсан асуултуудын зөв/буруу — байрлалын дарааллаар */
function marksOf(answers: AnswerRow[]): boolean[] {
  return answers.filter((a) => a.answeredAt !== null).map((a) => a.isCorrect === true);
}

async function respondWith(dayKey: string, answer: AnswerRow, total: number, now: number, marks: boolean[]) {
  const q = await loadQuestion(answer.questionId);
  if (!q) return apiError('QUESTION_NOT_FOUND', 'Асуулт олдсонгүй', 404);
  return NextResponse.json(
    { done: false, question: servedQuestion(dayKey, answer.position, total, q, answer.servedAt, now), marks },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
