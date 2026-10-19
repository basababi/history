/**
 * Найзын бүлгийн үйлчилгээ — гишүүнчлэл, долоо хоногийн чансаа
 *
 * Долоо хоног = UB-ийн Даваа 00:00-оос. Тухайн 7 хоногийн өдрүүдийн
 * багцыг хэзээ тоглосноос үл хамааран тооцно — өдөр бүр ИЖИЛ тав тул
 * хэн ч давуу талгүй.
 */
import { and, asc, eq, gte, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import { rankWeek, weekStartDay, type RankedTally } from '@nomad/core';
import type { GroupSummary } from '@nomad/contracts';
import { dailyPlays, friendGroupMembers, friendGroups } from '@nomad/db';
import { db } from './db';

export type GroupRow = typeof friendGroups.$inferSelect;

export async function groupsOf(userId: number): Promise<GroupRow[]> {
  return db
    .select({
      id: friendGroups.id,
      code: friendGroups.code,
      name: friendGroups.name,
      ownerId: friendGroups.ownerId,
      createdAt: friendGroups.createdAt,
    })
    .from(friendGroupMembers)
    .innerJoin(friendGroups, eq(friendGroupMembers.groupId, friendGroups.id))
    .where(eq(friendGroupMembers.userId, userId))
    .orderBy(asc(friendGroups.createdAt));
}

export async function memberIdsOf(groupId: number): Promise<number[]> {
  const rows = await db
    .select({ userId: friendGroupMembers.userId })
    .from(friendGroupMembers)
    .where(eq(friendGroupMembers.groupId, groupId))
    .orderBy(asc(friendGroupMembers.joinedAt));
  return rows.map((r) => r.userId);
}

export async function isMember(groupId: number, userId: number): Promise<boolean> {
  const [row] = await db
    .select({ userId: friendGroupMembers.userId })
    .from(friendGroupMembers)
    .where(and(eq(friendGroupMembers.groupId, groupId), eq(friendGroupMembers.userId, userId)))
    .limit(1);
  return row !== undefined;
}

export async function memberCount(groupId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(friendGroupMembers)
    .where(eq(friendGroupMembers.groupId, groupId));
  return row?.n ?? 0;
}

export interface TodayPlay {
  correct: number;
  totalMs: number;
  playId: number;
}

/** Гишүүдийн долоо хоногийн нийлбэр ба өнөөдрийн тоглолт */
export async function weekOf(
  memberIds: number[],
  today: string
): Promise<{ ranked: RankedTally[]; todayPlays: Map<number, TodayPlay>; weekStart: string }> {
  const weekStart = weekStartDay(today);
  if (memberIds.length === 0) return { ranked: [], todayPlays: new Map(), weekStart };

  const plays = await db
    .select({
      id: dailyPlays.id,
      userId: dailyPlays.userId,
      dayKey: dailyPlays.dayKey,
      correct: dailyPlays.correctCount,
      totalMs: dailyPlays.totalMs,
    })
    .from(dailyPlays)
    .where(
      and(
        inArray(dailyPlays.userId, memberIds),
        gte(dailyPlays.dayKey, weekStart),
        lte(dailyPlays.dayKey, today),
        isNotNull(dailyPlays.finishedAt)
      )
    );

  const tallies = new Map(memberIds.map((id) => [id, { userId: id, correct: 0, daysPlayed: 0, totalMs: 0 }]));
  const todayPlays = new Map<number, TodayPlay>();
  for (const p of plays) {
    const t = tallies.get(p.userId);
    if (!t) continue;
    t.correct += p.correct;
    t.daysPlayed += 1;
    t.totalMs += p.totalMs;
    if (p.dayKey === today) todayPlays.set(p.userId, { correct: p.correct, totalMs: p.totalMs, playId: p.id });
  }

  return { ranked: rankWeek([...tallies.values()]), todayPlays, weekStart };
}

/** Жагсаалтын мөр — гишүүн бүрийн хувьд нэг дор тооцоолно */
export async function summarize(group: GroupRow, userId: number, today: string): Promise<GroupSummary> {
  const ids = await memberIdsOf(group.id);
  const { ranked, todayPlays } = await weekOf(ids, today);
  return {
    id: group.id,
    name: group.name,
    code: group.code,
    memberCount: ids.length,
    isOwner: group.ownerId === userId,
    myRank: ranked.find((r) => r.userId === userId)?.rank ?? ids.length,
    playedToday: todayPlays.size,
  };
}
