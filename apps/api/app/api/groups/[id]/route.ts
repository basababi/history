/**
 * GET /api/groups/:id — бүлгийн өнөөдрийн самбар ба долоо хоногийн чансаа
 *
 * Зөвхөн ГИШҮҮД үзнэ. Гадны хүнд бүлэг байгаа эсэхийг ч илчлэхгүй (404).
 */
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { friendGroups } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, requireAuth, routeWith } from '@/lib/api';
import { marksFor, todayKey } from '@/lib/daily';
import { isMember, memberIdsOf, weekOf } from '@/lib/groups';
import { peopleFor } from '@/lib/social';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = routeWith<{ id: string }>(async (req, params) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const groupId = Number(params.id);
  if (!Number.isInteger(groupId) || groupId <= 0) {
    return apiError('GROUP_NOT_FOUND', 'Бүлэг олдсонгүй', 404);
  }

  const [group] = await db.select().from(friendGroups).where(eq(friendGroups.id, groupId)).limit(1);
  if (!group || !(await isMember(groupId, userId))) {
    return apiError('GROUP_NOT_FOUND', 'Бүлэг олдсонгүй', 404);
  }

  const today = todayKey();
  const ids = await memberIdsOf(groupId);
  const [{ ranked, todayPlays, weekStart }, people] = await Promise.all([weekOf(ids, today), peopleFor(ids)]);
  const marks = await marksFor([...todayPlays.values()].map((p) => p.playId));

  const members = ranked.map((r) => {
    const person = people.get(r.userId);
    const t = todayPlays.get(r.userId);
    return {
      userId: r.userId,
      displayName: person?.displayName ?? 'Зочин',
      title: person?.title ?? '',
      isMe: r.userId === userId,
      isOwner: r.userId === group.ownerId,
      rank: r.rank,
      weekCorrect: r.correct,
      daysPlayed: r.daysPlayed,
      today: {
        played: t !== undefined,
        correct: t?.correct ?? null,
        totalMs: t?.totalMs ?? null,
        marks: t ? (marks.get(t.playId) ?? []) : [],
      },
    };
  });

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      code: group.code,
      memberCount: ids.length,
      isOwner: group.ownerId === userId,
      myRank: ranked.find((r) => r.userId === userId)?.rank ?? ids.length,
      playedToday: todayPlays.size,
    },
    weekStart,
    dayKey: today,
    members,
  });
});
