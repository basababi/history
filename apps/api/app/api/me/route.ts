/**
 * GET   /api/me — нэр, цол, цуврал, статистик, сүүлийн 30 өдөр
 * PATCH /api/me — дэлгэцийн нэр тавих
 *
 * Бүлэг 6.5: зөвхөн дэлгэцийн нэр. Бодит нэр, утас, и-мэйл шаардахгүй.
 */
import { NextResponse } from 'next/server';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import {
  DAILY_QUESTION_COUNT,
  DISPLAY_NAME_ERROR_TEXT,
  normalizeDisplayName,
  validateDisplayName,
  visibleStreak,
} from '@nomad/core';
import { UpdateMeRequestSchema } from '@nomad/contracts';
import { dailyPlays, profiles } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, requireAuth, route } from '@/lib/api';
import { dayNo, todayKey } from '@/lib/daily';
import { titleInfo } from '@/lib/social';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HISTORY_LIMIT = 30;

async function buildMe(userId: number) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile) return null;

  const plays = await db
    .select({
      dayKey: dailyPlays.dayKey,
      correct: dailyPlays.correctCount,
      totalMs: dailyPlays.totalMs,
    })
    .from(dailyPlays)
    .where(and(eq(dailyPlays.userId, userId), isNotNull(dailyPlays.finishedAt)))
    .orderBy(desc(dailyPlays.dayKey));

  const today = todayKey();
  const totalCorrect = plays.reduce((s, p) => s + p.correct, 0);
  const perfectDays = plays.filter((p) => p.correct >= DAILY_QUESTION_COUNT).length;

  return {
    userId,
    displayName: profile.displayName,
    title: titleInfo(totalCorrect),
    streak: {
      current: visibleStreak(
        { streakDays: profile.streakDays, bestStreak: profile.bestStreak, lastActiveDate: profile.lastActiveDate },
        today
      ),
      best: profile.bestStreak,
      playedToday: profile.lastActiveDate === today,
    },
    stats: {
      plays: plays.length,
      totalCorrect,
      perfectDays,
      averageCorrect: plays.length > 0 ? Math.round((totalCorrect / plays.length) * 10) / 10 : 0,
    },
    history: plays.slice(0, HISTORY_LIMIT).map((p) => ({
      dayKey: p.dayKey,
      dayNumber: dayNo(p.dayKey),
      correct: p.correct,
      total: DAILY_QUESTION_COUNT,
      totalMs: p.totalMs,
    })),
    todayKey: today,
  };
}

export const GET = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const me = await buildMe(auth.user.userId);
  if (!me) return apiError('NO_PROFILE', 'Профайл олдсонгүй', 404);
  return NextResponse.json(me);
});

export const PATCH = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(req, UpdateMeRequestSchema);
  if (!parsed.ok) return parsed.response;

  const name = normalizeDisplayName(parsed.data.displayName);
  const check = validateDisplayName(name);
  if (!check.ok) {
    return apiError('BAD_NAME', DISPLAY_NAME_ERROR_TEXT[check.error], 422);
  }

  const updated = await db
    .update(profiles)
    .set({ displayName: name })
    .where(eq(profiles.userId, auth.user.userId))
    .returning({ userId: profiles.userId });
  if (updated.length === 0) return apiError('NO_PROFILE', 'Профайл олдсонгүй', 404);

  const me = await buildMe(auth.user.userId);
  return NextResponse.json(me);
});
