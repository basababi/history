/**
 * GET /api/daily/today — өнөөдрийн тав: дугаар, миний явц, тоглосон хүний тоо
 *
 * Нүүр дэлгэц үүгээр л эхэлнэ. Багц байхгүй бол үүсгэнэ (идемпотент).
 */
import { NextResponse } from 'next/server';
import { msUntilNextDay } from '@nomad/core';
import { apiError, requireAuth, route } from '@/lib/api';
import {
  answersOf,
  dayNo,
  findPlay,
  finishedCount,
  getDailySet,
  progressOf,
  todayKey,
} from '@/lib/daily';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const now = Date.now();
  const dayKey = todayKey(now);
  const set = await getDailySet(dayKey, now);
  if (!set.ok) {
    return apiError('NO_QUESTIONS', 'Өнөөдрийн асуулт бэлэн болоогүй байна. Удахгүй!', 503, true);
  }

  const play = await findPlay(auth.user.userId, dayKey);
  const answers = play ? await answersOf(play.id) : [];

  return NextResponse.json({
    dayKey,
    dayNumber: dayNo(dayKey),
    msUntilNext: msUntilNextDay(now),
    play: progressOf(play, answers, set.questionIds.length),
    playersToday: await finishedCount(dayKey),
  });
});
