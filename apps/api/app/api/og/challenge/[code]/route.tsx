/**
 * GET /api/og/challenge/:code — сорилтын карт (PNG)
 *
 *   ?format=og    1200×630 — Messenger/Facebook линкийн урьдчилсан харагдац (анхдагч)
 *   ?format=story 1080×1920 — Instagram/Facebook story-д татаж хуваалцах
 *
 * Дууссан дүн өөрчлөгдөхгүй тул CDN-д урт хадгална.
 */
import { ImageResponse } from 'next/og';
import {
  DAILY_QUESTION_COUNT,
  formatDuration,
  isValidShareCode,
  normalizeShareCode,
} from '@nomad/core';
import { apiError, routeWith } from '@/lib/api';
import { dayNo, findPlayByShareCode, getDailySet, marksFor } from '@/lib/daily';
import { ChallengeCard, ChallengeStory, loadOgFonts, OG_SIZE, STORY_SIZE } from '@/lib/og';
import { peopleFor } from '@/lib/social';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = routeWith<{ code: string }>(async (req, params) => {
  const code = normalizeShareCode(params.code.replace(/\.png$/i, ''));
  if (!isValidShareCode(code)) return apiError('BAD_CODE', 'Сорилтын код буруу байна', 400);

  const play = await findPlayByShareCode(code);
  if (!play?.finishedAt) return apiError('CHALLENGE_NOT_FOUND', 'Ийм сорилт олдсонгүй', 404);

  const [people, marks, set, fonts] = await Promise.all([
    peopleFor([play.userId]),
    marksFor([play.id]),
    getDailySet(play.dayKey),
    loadOgFonts(),
  ]);
  const owner = people.get(play.userId);

  const data = {
    dayNumber: dayNo(play.dayKey),
    name: owner?.displayName ?? 'Зочин',
    title: owner?.title ?? '',
    correct: play.correctCount,
    total: set.ok ? set.questionIds.length : DAILY_QUESTION_COUNT,
    timeText: formatDuration(play.totalMs),
    marks: marks.get(play.id) ?? [],
  };

  const story = new URL(req.url).searchParams.get('format') === 'story';
  // ⚠ Нэр дараа нь солигдож болох тул «immutable» биш — нэг цаг хадгална
  const headers = { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' };

  return new ImageResponse(story ? <ChallengeStory d={data} /> : <ChallengeCard d={data} />, {
    ...(story ? STORY_SIZE : OG_SIZE),
    fonts,
    headers,
  });
});
