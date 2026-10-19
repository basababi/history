/**
 * Rank систем — Бүлэг 3.2
 * Он цагийн дараалал зөрчигдөхгүй байхыг тестээр шалгана.
 */

export type RankTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface RankMeta {
  title: string;
  era: string;
  minXp: number;
  /** Он цагийн дарааллын эрэмбэ (МЭӨ III з. → XIII з. → XVII–XX з.) */
  chronologicalOrder: number;
}

export const RANK_META: Record<RankTier, RankMeta> = {
  bronze: {
    title: 'Элч',
    era: 'Хүннү гүрний үе',
    minXp: 0,
    chronologicalOrder: 1,
  },
  silver: {
    title: 'Өрлөг',
    era: 'Их Монгол Улсын үе',
    minXp: 500,
    chronologicalOrder: 2,
  },
  gold: {
    title: 'Баатар',
    era: 'Богд хаант ба шинэ үе',
    minXp: 1500,
    chronologicalOrder: 3,
  },
  platinum: {
    title: 'Их хаан',
    era: 'Бүх эриний нэгдсэн түвшин',
    minXp: 4000,
    chronologicalOrder: 4,
  },
};

export const TIER_ORDER: readonly RankTier[] = [
  'bronze',
  'silver',
  'gold',
  'platinum',
] as const;

/** XP-ээс tier тодорхойлох */
export function tierFromXp(xp: number): RankTier {
  let tier: RankTier = 'bronze';
  for (const t of TIER_ORDER) {
    if (xp >= RANK_META[t].minXp) tier = t;
  }
  return tier;
}

/** Дараагийн tier (platinum бол null) */
export function nextTier(tier: RankTier): RankTier | null {
  const idx = TIER_ORDER.indexOf(tier);
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1] ?? null;
}

/**
 * Баатруудын rank-ийн он цагийн дарааллыг шалгана (Бүлэг 3.2 анхааруулга).
 * Модун (МЭӨ III з.) → Чингис (XIII з.) → Ану (XVII з.) дараалал зөрчигдөх ёсгүй.
 */
export function validateHeroChronology(
  heroes: ReadonlyArray<{
    name?: string;
    rankTier: RankTier;
    chronologicalOrder: number;
  }>
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  // Баатруудыг rank-ийн шатлалаар эрэмбэлээд, тэдний ӨӨРСДИЙН он цагийн
  // эрэмбэ буурахгүй байх ёстой. Өөрөөр хэлбэл дээд tier-т хүрэхэд
  // хэрэглэгч он цагаар УРАГШ явна, хэзээ ч ухрахгүй.
  const sorted = [...heroes].sort(
    (a, b) =>
      RANK_META[a.rankTier].chronologicalOrder -
        RANK_META[b.rankTier].chronologicalOrder ||
      a.chronologicalOrder - b.chronologicalOrder
  );

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (!prev || !curr) continue;

    const prevTierOrder = RANK_META[prev.rankTier].chronologicalOrder;
    const currTierOrder = RANK_META[curr.rankTier].chronologicalOrder;

    // Дараагийн tier-ийн баатар өмнөх tier-ийнхээс он цагаар ЭРТ байж болохгүй
    if (currTierOrder > prevTierOrder && curr.chronologicalOrder < prev.chronologicalOrder) {
      const currName = curr.name ?? `#${i + 1}`;
      const prevName = prev.name ?? `#${i}`;
      violations.push(
        `Он цагийн дараалал зөрчигдсөн: ${currName} (${curr.rankTier}, эрэмбэ ${curr.chronologicalOrder}) нь ` +
          `${prevName} (${prev.rankTier}, эрэмбэ ${prev.chronologicalOrder})-аас ЭРТ үеийнх боловч дээд tier-д байна`
      );
    }
  }

  return { valid: violations.length === 0, violations };
}