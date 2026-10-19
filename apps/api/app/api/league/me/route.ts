/**
 * GET /api/league/me — 30 хүний лигийн чансаа (Бүлэг 3.6, ADR-003)
 *
 * Redis ZSET: ZREVRANK O(log N)-ээр «миний байр», ZREVRANGE-ээр жагсаалт.
 * Redis унасан үед Postgres snapshot-оос уншиж `degraded: true` буцаана
 * (Бүлэг 6.6 graceful degradation).
 *
 * Алдааны засвар №10: өмнөх `getMockLeague` бүрэн устсан.
 */
import { NextResponse } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  isoWeekKey,
  movementForRank,
  rankEntries,
  type RankTier,
} from '@nomad/core';
import { leagueMembers, leagues, profiles } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, requireAuth, route } from '@/lib/api';
import { leagueKey, safeRedis } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const weekKey = isoWeekKey(Date.now());

  // Хэрэглэгчийн энэ долоо хоногийн лигийн гишүүнчлэл
  const [membership] = await db
    .select({
      leagueId: leagueMembers.leagueId,
      weeklyXp: leagueMembers.weeklyXp,
      tier: leagues.tier,
      bucketNo: leagues.bucketNo,
    })
    .from(leagueMembers)
    .innerJoin(leagues, eq(leagueMembers.leagueId, leagues.id))
    .where(and(eq(leagueMembers.userId, userId), eq(leagues.weekKey, weekKey)))
    .limit(1);

  if (!membership) {
    return apiError(
      'NOT_IN_LEAGUE',
      'Энэ долоо хоногт лигт хуваарилагдаагүй байна',
      404,
      true
    );
  }

  const tier = membership.tier as RankTier;
  const key = leagueKey(weekKey, tier, membership.bucketNo);

  // ─── Эхлээд Redis ZSET (ADR-003) ───
  const zres = await safeRedis(async (r) => {
    const flat = await r.zrevrange(key, 0, 49, 'WITHSCORES');
    if (flat.length === 0) return null;
    const out: Array<{ userId: number; weeklyXp: number }> = [];
    for (let i = 0; i < flat.length; i += 2) {
      const member = flat[i];
      const score = flat[i + 1];
      if (!member || score === undefined) continue;
      out.push({
        userId: Number(member.replace('user:', '')),
        weeklyXp: Math.round(Number(score)),
      });
    }
    return out;
  });

  let raw: Array<{ userId: number; weeklyXp: number }>;
  let degraded: boolean;

  if (zres && zres.length > 0) {
    raw = zres;
    degraded = false;
  } else {
    // ─── Postgres snapshot (graceful degradation) ───
    const rows = await db
      .select({
        userId: leagueMembers.userId,
        weeklyXp: leagueMembers.weeklyXp,
      })
      .from(leagueMembers)
      .where(eq(leagueMembers.leagueId, membership.leagueId))
      .orderBy(desc(leagueMembers.weeklyXp));
    raw = rows;
    degraded = true;
  }

  // Нэр, аватар
  const ids = raw.map((r) => r.userId);
  const names =
    ids.length > 0
      ? await db
          .select({
            userId: profiles.userId,
            displayName: profiles.displayName,
            avatarEmoji: profiles.avatarEmoji,
          })
          .from(profiles)
          .where(inArray(profiles.userId, ids))
      : [];
  const nameMap = new Map(names.map((n) => [n.userId, n]));

  const ranked = rankEntries(raw);
  const total = ranked.length;

  const entries = ranked.map((e) => {
    const p = nameMap.get(e.userId);
    return {
      userId: e.userId,
      displayName: p?.displayName ?? 'Нүүдэлчин',
      avatarEmoji: p?.avatarEmoji ?? '🧑‍🌾',
      weeklyXp: e.weeklyXp,
      rank: e.rank,
      isMe: e.userId === userId,
      movement: movementForRank(e.rank, total),
    };
  });

  const myRank = entries.find((e) => e.isMe)?.rank ?? 0;

  return NextResponse.json({
    weekKey,
    tier,
    bucketNo: membership.bucketNo,
    myRank,
    totalMembers: total,
    entries,
    degraded,
  });
});
