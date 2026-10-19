/**
 * Нийгмийн давхарга — нэр, цол, өрсөлдөгч, тулааны оноо
 *
 * Тулааны оноог ХАДГАЛАХГҮЙ: хоёулаа тоглосон өдрүүдийн дүнгээс үргэлж
 * шинээр тооцоолно. Ингэснээр хэзээ ч зөрөхгүй, засах шаардлагагүй.
 */
import { and, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import {
  duelMessage,
  GUEST_DISPLAY_NAME,
  headToHead,
  titleFor,
  type DayScore,
} from '@nomad/core';
import type { DuelRecord, DuelSummary, TitleInfo } from '@nomad/contracts';
import { dailyPlays, profiles, rivalries } from '@nomad/db';
import { db } from './db';

export interface Person {
  userId: number;
  displayName: string;
  /** Нэрээ өөрөө тавьсан эсэх */
  named: boolean;
  totalCorrect: number;
  title: string;
}

export function titleInfo(totalCorrect: number): TitleInfo {
  const t = titleFor(totalCorrect);
  return {
    key: t.tier.key,
    label: t.tier.label,
    nextLabel: t.next?.label ?? null,
    progress: t.progress,
    remaining: t.remaining,
  };
}

/** Нийт зөв хариулт (дууссан тоглолтуудаар) — цолын суурь */
export async function totalCorrectFor(userIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (userIds.length === 0) return out;
  const rows = await db
    .select({
      userId: dailyPlays.userId,
      total: sql<number>`coalesce(sum(${dailyPlays.correctCount}), 0)::int`,
    })
    .from(dailyPlays)
    .where(and(inArray(dailyPlays.userId, userIds), isNotNull(dailyPlays.finishedAt)))
    .groupBy(dailyPlays.userId);
  for (const r of rows) out.set(r.userId, r.total);
  return out;
}

/** Нэр + цол — олон хүнийг нэг дор */
export async function peopleFor(userIds: number[]): Promise<Map<number, Person>> {
  const ids = [...new Set(userIds)];
  const out = new Map<number, Person>();
  if (ids.length === 0) return out;

  const [rows, totals] = await Promise.all([
    db
      .select({ userId: profiles.userId, displayName: profiles.displayName })
      .from(profiles)
      .where(inArray(profiles.userId, ids)),
    totalCorrectFor(ids),
  ]);
  const names = new Map(rows.map((r) => [r.userId, r.displayName]));

  for (const id of ids) {
    const name = names.get(id) ?? null;
    const totalCorrect = totals.get(id) ?? 0;
    out.set(id, {
      userId: id,
      displayName: name ?? GUEST_DISPLAY_NAME,
      named: name !== null,
      totalCorrect,
      title: titleFor(totalCorrect).tier.label,
    });
  }
  return out;
}

// ─── Өрсөлдөгч ───

/** Хос бүр НЭГ мөр (low < high) — давхардлыг ӨС-ийн PK барина */
export async function ensureRivalry(a: number, b: number): Promise<void> {
  if (a === b) return;
  const [userLow, userHigh] = a < b ? [a, b] : [b, a];
  await db.insert(rivalries).values({ userLow, userHigh }).onConflictDoNothing();
}

export async function rivalIdsOf(userId: number): Promise<number[]> {
  const rows = await db
    .select({ low: rivalries.userLow, high: rivalries.userHigh })
    .from(rivalries)
    .where(or(eq(rivalries.userLow, userId), eq(rivalries.userHigh, userId)));
  return rows.map((r) => (r.low === userId ? r.high : r.low));
}

/** Хэрэглэгч бүрийн дууссан тоглолт: өдөр → дүн */
export async function scoresByDay(userIds: number[]): Promise<Map<number, Map<string, DayScore>>> {
  const out = new Map<number, Map<string, DayScore>>();
  if (userIds.length === 0) return out;
  const rows = await db
    .select({
      userId: dailyPlays.userId,
      dayKey: dailyPlays.dayKey,
      correct: dailyPlays.correctCount,
      totalMs: dailyPlays.totalMs,
    })
    .from(dailyPlays)
    .where(and(inArray(dailyPlays.userId, [...new Set(userIds)]), isNotNull(dailyPlays.finishedAt)));
  for (const r of rows) {
    const m = out.get(r.userId) ?? new Map<string, DayScore>();
    m.set(r.dayKey, { correct: r.correct, totalMs: r.totalMs });
    out.set(r.userId, m);
  }
  return out;
}

export function recordBetween(
  scores: Map<number, Map<string, DayScore>>,
  me: number,
  other: number
): DuelRecord {
  return headToHead(scores.get(me) ?? new Map(), scores.get(other) ?? new Map());
}

/** Нэг өдрийн харьцуулалтыг хэрэглэгчид харуулах хэлбэрт */
export function duelSummary(input: {
  mine: DayScore;
  opponent: Person;
  theirs: DayScore;
  theirMarks: boolean[];
  total: number;
  record: DuelRecord;
}): DuelSummary {
  const msg = duelMessage(input.mine, input.theirs, input.opponent.displayName);
  return {
    opponent: {
      userId: input.opponent.userId,
      displayName: input.opponent.displayName,
      title: input.opponent.title,
      correct: input.theirs.correct,
      total: input.total,
      totalMs: input.theirs.totalMs,
      marks: input.theirMarks,
    },
    outcome: msg.outcome,
    headline: msg.headline,
    detail: msg.detail,
    record: input.record,
  };
}
