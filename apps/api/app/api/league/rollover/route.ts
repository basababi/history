/**
 * POST /api/league/rollover — долоо хоногийн шилжилтийн cron (Бүлэг 3.6)
 *
 * «Долоо хоног бүр: дээд 5 нь дээш лиг рүү, доод 5 нь доош шилжинэ.»
 *
 * Vercel Cron-оос дуудна. `CRON_SECRET` толгойгоор хамгаална —
 * ил задгай байвал хэн ч чансааг дахин тохируулж чадна.
 */
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import {
  assignBuckets,
  isoWeekKey,
  movementForRank,
  rankEntries,
  tierAfterMovement,
  XP_RULES,
  awardLeagueTop3,
  type BonusLedger,
  type RankTier,
} from '@nomad/core';
import { leagueMembers, leagues, profiles } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, route } from '@/lib/api';
import { leagueKey, safeRedis } from '@/lib/redis';
import { timingSafeEqualStr } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = route(async (req) => {
  // ─── Cron-ы нууц түлхүүр ───
  const provided = req.headers.get('authorization')?.replace('Bearer ', '') ?? '';
  const expected = process.env.CRON_SECRET;
  if (!expected || !timingSafeEqualStr(provided, expected)) {
    return apiError('UNAUTHORIZED', 'Cron нууц түлхүүр буруу', 401);
  }

  const now = Date.now();
  const closingWeek = isoWeekKey(now - 7 * 24 * 60 * 60 * 1000);
  const newWeek = isoWeekKey(now);

  // ─── 1) Хаагдаж буй долоо хоногийн лигүүдийг дүгнэнэ ───
  const closingLeagues = await db
    .select()
    .from(leagues)
    .where(eq(leagues.weekKey, closingWeek));

  /** userId → шилжсэн шинэ tier */
  const nextTierByUser = new Map<number, RankTier>();
  let top3Awarded = 0;

  for (const league of closingLeagues) {
    const members = await db
      .select({
        userId: leagueMembers.userId,
        weeklyXp: leagueMembers.weeklyXp,
      })
      .from(leagueMembers)
      .where(eq(leagueMembers.leagueId, league.id))
      .orderBy(desc(leagueMembers.weeklyXp));

    const ranked = rankEntries(members);
    const total = ranked.length;

    for (const entry of ranked) {
      const movement = movementForRank(entry.rank, total);
      nextTierByUser.set(
        entry.userId,
        tierAfterMovement(league.tier as RankTier, movement)
      );

      // Эцсийн байрыг хадгална
      await db
        .update(leagueMembers)
        .set({ finalRank: entry.rank })
        .where(eq(leagueMembers.leagueId, league.id));

      // ─── Top-3 бонус: +500, долоо хоногт 1 (Бүлэг 3.6) ───
      if (entry.rank <= 3) {
        const [profile] = await db
          .select({ xp: profiles.xp, bonusLedger: profiles.bonusLedger })
          .from(profiles)
          .where(eq(profiles.userId, entry.userId))
          .limit(1);
        if (profile) {
          const result = awardLeagueTop3(
            (profile.bonusLedger ?? {}) as BonusLedger,
            closingWeek,
            entry.rank
          );
          if (result.awarded) {
            await db
              .update(profiles)
              .set({
                xp: profile.xp + XP_RULES.leagueTop3Bonus,
                bonusLedger: result.ledger,
              })
              .where(eq(profiles.userId, entry.userId));
            top3Awarded += 1;
          }
        }
      }
    }

    // Хуучин долоо хоногийн Redis түлхүүрийг цэвэрлэнэ
    await safeRedis((r) =>
      r.del(leagueKey(closingWeek, league.tier, league.bucketNo))
    );
  }

  // ─── 2) Шинэ долоо хоногийн лигүүдийг үүсгэнэ ───
  const allProfiles = await db
    .select({ userId: profiles.userId, rankTier: profiles.rankTier })
    .from(profiles);

  const byTier = new Map<RankTier, number[]>();
  for (const p of allProfiles) {
    const tier = nextTierByUser.get(p.userId) ?? (p.rankTier as RankTier);
    const list = byTier.get(tier) ?? [];
    list.push(p.userId);
    byTier.set(tier, list);
  }

  let bucketsCreated = 0;

  for (const [tier, userIds] of byTier) {
    // Санамсаргүй холино — ижил хүмүүс байнга нэг бүлэгт орохгүй
    const shuffled = [...userIds].sort(() => Math.random() - 0.5);
    const buckets = assignBuckets(shuffled);

    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      if (!bucket) continue;

      const [league] = await db
        .insert(leagues)
        .values({ weekKey: newWeek, tier, bucketNo: i })
        .onConflictDoNothing()
        .returning({ id: leagues.id });

      if (!league) continue;
      bucketsCreated += 1;

      await db
        .insert(leagueMembers)
        .values(
          bucket.map((userId) => ({
            leagueId: league.id,
            userId,
            weeklyXp: 0,
          }))
        )
        .onConflictDoNothing();

      // Redis ZSET-ийг 0 оноогоор бэлдэнэ
      const key = leagueKey(newWeek, tier, i);
      await safeRedis(async (r) => {
        const pipeline = r.pipeline();
        for (const userId of bucket) pipeline.zadd(key, 0, `user:${userId}`);
        pipeline.expire(key, 60 * 60 * 24 * 14); // 2 долоо хоног
        return pipeline.exec();
      });
    }
  }

  return NextResponse.json({
    closedWeek: closingWeek,
    newWeek,
    leaguesClosed: closingLeagues.length,
    bucketsCreated,
    top3Awarded,
  });
});
