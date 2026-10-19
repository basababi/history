/**
 * GET /api/daily/result?dayKey=YYYY-MM-DD — дууссан өдрийн дүн
 *
 * Дүнгийн дэлгэц бол хамгийн сэтгэл хөдөлгөм мөч — хуваалцах шийдвэр
 * энд гарна. Тиймээс нэг хариунд бүгдийг өгнө: оноо, асуулт тус бүрийн
 * зөв хувь, өдрийн байр, сорьсон хүнтэй харьцуулалт, өрсөлдөгчид, цол.
 */
import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { DAILY_QUESTION_COUNT, isValidDayKey, titleFor, visibleStreak } from '@nomad/core';
import { dailyPlays, profiles } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, requireAuth, route } from '@/lib/api';
import {
  answersOf,
  correctRates,
  dayNo,
  dayRank,
  findPlay,
  getDailySet,
  marksFor,
  todayKey,
} from '@/lib/daily';
import {
  duelSummary,
  peopleFor,
  recordBetween,
  rivalIdsOf,
  scoresByDay,
  titleInfo,
} from '@/lib/social';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_RIVALS_SHOWN = 10;

export const GET = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const dayKey = new URL(req.url).searchParams.get('dayKey') ?? todayKey();
  if (!isValidDayKey(dayKey)) return apiError('BAD_DAY', 'Өдрийн формат буруу байна', 400);

  const play = await findPlay(userId, dayKey);
  if (!play?.finishedAt || !play.shareCode) {
    return apiError('NOT_FINISHED', 'Энэ өдрийг хараахан дуусгаагүй байна', 409);
  }

  const set = await getDailySet(dayKey);
  const total = set.ok ? set.questionIds.length : DAILY_QUESTION_COUNT;
  const answers = await answersOf(play.id);
  const rates = await correctRates(dayKey);
  const mine = { correct: play.correctCount, totalMs: play.totalMs };

  // ─── Сорьсон хүн ба өрсөлдөгчид ───
  let challengerPlay: typeof play | null = null;
  if (play.challengedByPlayId !== null) {
    const [row] = await db.select().from(dailyPlays).where(eq(dailyPlays.id, play.challengedByPlayId));
    challengerPlay = row?.finishedAt ? row : null;
  }

  const rivalIds = (await rivalIdsOf(userId)).filter((id) => id !== challengerPlay?.userId);
  const rivalPlays =
    rivalIds.length > 0
      ? await db
          .select()
          .from(dailyPlays)
          .where(
            and(
              eq(dailyPlays.dayKey, dayKey),
              inArray(dailyPlays.userId, rivalIds),
              isNotNull(dailyPlays.finishedAt)
            )
          )
          .orderBy(desc(dailyPlays.correctCount))
          .limit(MAX_RIVALS_SHOWN)
      : [];

  const opponentPlays = [...(challengerPlay ? [challengerPlay] : []), ...rivalPlays];
  const people = await peopleFor([userId, ...opponentPlays.map((p) => p.userId)]);
  const scores = await scoresByDay([userId, ...opponentPlays.map((p) => p.userId)]);
  const marks = await marksFor(opponentPlays.map((p) => p.id));

  const summarize = (p: typeof play) => {
    const opponent = people.get(p.userId);
    if (!opponent) return null;
    return duelSummary({
      mine,
      opponent,
      theirs: { correct: p.correctCount, totalMs: p.totalMs },
      theirMarks: marks.get(p.id) ?? [],
      total,
      record: recordBetween(scores, userId, p.userId),
    });
  };

  // ─── Цол — энэ тоглолтоор ахисан эсэх (зөвхөн хамгийн сүүлийн тоглолтод) ───
  const me = people.get(userId);
  const totalCorrect = me?.totalCorrect ?? play.correctCount;
  const [latest] = await db
    .select({ id: dailyPlays.id })
    .from(dailyPlays)
    .where(and(eq(dailyPlays.userId, userId), isNotNull(dailyPlays.finishedAt)))
    .orderBy(desc(dailyPlays.finishedAt))
    .limit(1);
  const before = titleFor(totalCorrect - play.correctCount).tier;
  const after = titleFor(totalCorrect).tier;
  const titleUp = latest?.id === play.id && before.key !== after.key ? after.label : null;

  const [profile] = await db
    .select({ streakDays: profiles.streakDays, bestStreak: profiles.bestStreak, lastActiveDate: profiles.lastActiveDate })
    .from(profiles)
    .where(eq(profiles.userId, userId));
  const today = todayKey();

  return NextResponse.json({
    dayKey,
    dayNumber: dayNo(dayKey),
    isToday: dayKey === today,
    correct: play.correctCount,
    total,
    totalMs: play.totalMs,
    marks: answers.filter((a) => a.answeredAt !== null).map((a) => a.isCorrect === true),
    perQuestion: answers.map((a) => ({
      position: a.position,
      isCorrect: a.isCorrect === true,
      timedOut: a.selectedIndex === -1,
      responseMs: a.responseMs ?? 0,
      correctRate: rates.get(a.position) ?? null,
    })),
    shareCode: play.shareCode,
    rank: await dayRank(dayKey, play.correctCount, play.totalMs),
    duel: challengerPlay ? summarize(challengerPlay) : null,
    rivals: rivalPlays.map(summarize).filter((d) => d !== null),
    streak: {
      current: profile ? visibleStreak(profile, today) : 0,
      best: profile?.bestStreak ?? 0,
    },
    title: titleInfo(totalCorrect),
    titleUp,
    needsName: !(me?.named ?? false),
  });
});
