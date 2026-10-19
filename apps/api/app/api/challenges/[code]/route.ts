/**
 * GET /api/challenges/:code — сорилтын линкийн мэдээлэл (НИЙТЭД НЭЭЛТТЭЙ)
 *
 * «Бат 4/5 · 38 сек авсан — чи давж чадах уу?» Найз линк дээр дарахад
 * эхлээд үүнийг харна. Нэвтрээгүй ч ажиллана (зочны бүртгэл үүсэхээс
 * өмнө ч нүүр хуудас харагдана).
 *
 * ⚠ СПОЙЛЕРГҮЙ: асуулт, сонголт, зөв хариулт ХЭЗЭЭ Ч орохгүй — зөвхөн дүн.
 */
import { NextResponse } from 'next/server';
import { DAILY_QUESTION_COUNT, GUEST_DISPLAY_NAME, isValidShareCode, normalizeShareCode } from '@nomad/core';
import { apiError, optionalAuth, routeWith } from '@/lib/api';
import {
  dayNo,
  findPlay,
  findPlayByShareCode,
  getDailySet,
  marksFor,
  todayKey,
} from '@/lib/daily';
import { duelSummary, peopleFor, recordBetween, scoresByDay } from '@/lib/social';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = routeWith<{ code: string }>(async (req, params) => {
  const code = normalizeShareCode(params.code);
  if (!isValidShareCode(code)) return apiError('BAD_CODE', 'Сорилтын код буруу байна', 400);

  const play = await findPlayByShareCode(code);
  if (!play?.finishedAt) return apiError('CHALLENGE_NOT_FOUND', 'Ийм сорилт олдсонгүй', 404);

  const set = await getDailySet(play.dayKey);
  const total = set.ok ? set.questionIds.length : DAILY_QUESTION_COUNT;
  const ownerScore = { correct: play.correctCount, totalMs: play.totalMs };
  const viewer = optionalAuth(req);

  const ids = viewer ? [play.userId, viewer.userId] : [play.userId];
  const people = await peopleFor(ids);
  const owner = people.get(play.userId);
  const marks = await marksFor([play.id]);

  let viewerInfo = null;
  if (viewer) {
    if (viewer.userId === play.userId) {
      viewerInfo = { isOwner: true, status: 'finished' as const, duel: null };
    } else {
      const mine = await findPlay(viewer.userId, play.dayKey);
      const status = !mine ? 'not_started' : mine.finishedAt ? 'finished' : 'in_progress';
      let duel = null;
      if (mine?.finishedAt && owner) {
        const scores = await scoresByDay(ids);
        duel = duelSummary({
          mine: { correct: mine.correctCount, totalMs: mine.totalMs },
          opponent: owner,
          theirs: ownerScore,
          theirMarks: marks.get(play.id) ?? [],
          total,
          record: recordBetween(scores, viewer.userId, play.userId),
        });
      }
      viewerInfo = { isOwner: false, status, duel };
    }
  }

  return NextResponse.json(
    {
      code,
      dayKey: play.dayKey,
      dayNumber: dayNo(play.dayKey),
      isToday: play.dayKey === todayKey(),
      owner: { displayName: owner?.displayName ?? GUEST_DISPLAY_NAME, title: owner?.title ?? '' },
      ownerResult: { ...ownerScore, total, marks: marks.get(play.id) ?? [] },
      viewer: viewerInfo,
    },
    // Нэвтэрсэн үзэгчийн мэдээлэл агуулж болох тул хуваалцсан кэшэд хадгалахгүй
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
});
