/**
 * Лигийн логик — Бүлэг 3.6, ADR-003
 *
 * ГОЛ ШИЙДВЭР: нэг глобал leaderboard БҮҮ ХИЙ.
 * ~30 хүний бүлэг. Долоо хоног бүр дээд 5 нь дээш, доод 5 нь доош шилжинэ.
 * «30 хүний дунд 4-р байранд байх нь 5000-аас 4321-р байранд байхаас
 *  хамаагүй хүчтэй сэдэл өгдөг.»
 */
import { TIER_ORDER, type RankTier } from './rank';

/** Нэг лигийн бүлгийн хэмжээ */
export const LEAGUE_BUCKET_SIZE = 30;

/** Дээш шилжих байрны тоо */
export const PROMOTE_COUNT = 5;

/** Доош шилжих байрны тоо */
export const RELEGATE_COUNT = 5;

export type LeagueMovement = 'promote' | 'relegate' | 'stay';

/**
 * Долоо хоногийн эцсийн байрнаас шилжилтийг тодорхойлно.
 * @param finalRank 1-ээс эхэлсэн байр
 * @param memberCount тухайн бүлгийн гишүүдийн тоо
 */
export function movementForRank(
  finalRank: number,
  memberCount: number
): LeagueMovement {
  if (finalRank >= 1 && finalRank <= PROMOTE_COUNT) return 'promote';
  if (finalRank > memberCount - RELEGATE_COUNT && finalRank <= memberCount) {
    return 'relegate';
  }
  return 'stay';
}

/** Шилжилтийн дараах шинэ tier (дээд/доод хязгаарт тогтоно) */
export function tierAfterMovement(
  tier: RankTier,
  movement: LeagueMovement
): RankTier {
  const idx = TIER_ORDER.indexOf(tier);
  if (idx < 0) return tier;
  if (movement === 'promote') {
    return TIER_ORDER[Math.min(idx + 1, TIER_ORDER.length - 1)] ?? tier;
  }
  if (movement === 'relegate') {
    return TIER_ORDER[Math.max(idx - 1, 0)] ?? tier;
  }
  return tier;
}

/**
 * Хэрэглэгчдийг ~30-аар бүлэглэнэ.
 * Сүүлийн бүлэг хэт жижиг (< 10) бол өмнөх бүлэгтэй нийлүүлнэ —
 * 3 хүнтэй лигт өрсөлдөөн үүсэхгүй.
 */
export function assignBuckets(userIds: readonly number[]): number[][] {
  if (userIds.length === 0) return [];
  const buckets: number[][] = [];
  for (let i = 0; i < userIds.length; i += LEAGUE_BUCKET_SIZE) {
    buckets.push([...userIds.slice(i, i + LEAGUE_BUCKET_SIZE)]);
  }
  const last = buckets[buckets.length - 1];
  if (buckets.length > 1 && last && last.length < 10) {
    const prev = buckets[buckets.length - 2];
    if (prev) {
      prev.push(...last);
      buckets.pop();
    }
  }
  return buckets;
}

export interface RankedEntry {
  userId: number;
  weeklyXp: number;
}

/**
 * ZREVRANGE-ийн үр дүнг байрлалтай болгоно.
 * Тэнцсэн оноог userId-аар тогтвортой эрэмбэлнэ (детерминистик).
 */
export function rankEntries(entries: readonly RankedEntry[]): Array<
  RankedEntry & { rank: number }
> {
  return [...entries]
    .sort((a, b) => b.weeklyXp - a.weeklyXp || a.userId - b.userId)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}
