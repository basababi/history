/**
 * Unlock логик — идемпотент (Алхам 5)
 * Давхар дуудахад давхар олгохгүй. Сервер талаас дуудна.
 *
 * Алдааны засвар №8: «анхны баатар» fallback нь rank-up блокийн ӨМНӨ,
 * нэгтгэсэн урсгалд хийгдэнэ. 0→500 XP үсэрвэл Модун шаньюй алга болохгүй.
 */
import { RANK_META, tierFromXp, type RankTier } from './rank';

export interface HeroRef {
  id: number;
  rankTier: RankTier;
}

export interface ArtifactRef {
  id: number;
  rarity?: 'common' | 'rare' | 'epic';
}

export interface UnlockResult {
  /** Энэ дуудалтад ШИНЭЭР нээгдсэн баатрууд */
  newHeroIds: number[];
  /** Нээгдсэн бүх баатрын нэгдсэн жагсаалт (эрэмбэлэгдсэн) */
  allUnlockedHeroIds: number[];
  /** Rank ахисан бол шинэ tier, үгүй бол null */
  rankUp: RankTier | null;
  oldTier: RankTier;
  newTier: RankTier;
}

/**
 * XP-ийн өөрчлөлтөөс шинэ баатрууд ба rank ахилтыг тооцоолно — ИДЕМПОТЕНТ.
 *
 * Баатар нээх дүрэм: hero.rankTier-ийн minXp ≤ newXp бол нээгдэнэ.
 * Ингэснээр XP хэдий их үсэрсэн ч дундах бүх tier-ийн баатар олгогдоно.
 */
export function computeUnlocks(params: {
  oldXp: number;
  newXp: number;
  oldUnlockedHeroIds: readonly number[];
  heroes: readonly HeroRef[];
}): UnlockResult {
  const { oldXp, newXp, oldUnlockedHeroIds, heroes } = params;

  const oldTier = tierFromXp(oldXp);
  const newTier = tierFromXp(newXp);
  const rankUp = newTier !== oldTier ? newTier : null;

  const unlocked = new Set(oldUnlockedHeroIds);
  const newHeroIds: number[] = [];

  // XP-д хүрсэн БҮХ tier-ийн баатруудыг нээнэ (дундах tier алгасахгүй)
  for (const hero of heroes) {
    if (!unlocked.has(hero.id) && RANK_META[hero.rankTier].minXp <= newXp) {
      unlocked.add(hero.id);
      newHeroIds.push(hero.id);
    }
  }

  // Fallback: ямар ч баатар байхгүй бол bronze-ийнхийг заавал олгоно.
  // (Хэрэв bronze баатар seed-д байхгүй бол хэрэглэгч баатаргүй үлдэхгүй)
  if (unlocked.size === 0) {
    for (const hero of heroes.filter((h) => h.rankTier === 'bronze')) {
      unlocked.add(hero.id);
      newHeroIds.push(hero.id);
    }
  }

  return {
    newHeroIds: newHeroIds.sort((a, b) => a - b),
    allUnlockedHeroIds: [...unlocked].sort((a, b) => a - b),
    rankUp,
    oldTier,
    newTier,
  };
}

/** Олдвор олгох — идемпотент (Бүлэг 3.1 Artifact Museum) */
export function grantArtifact(
  ownedArtifactIds: readonly number[],
  artifactId: number
): { granted: boolean; artifactIds: number[] } {
  if (ownedArtifactIds.includes(artifactId)) {
    return { granted: false, artifactIds: [...ownedArtifactIds] };
  }
  return {
    granted: true,
    artifactIds: [...ownedArtifactIds, artifactId].sort((a, b) => a - b),
  };
}

/** Сессийн олдворын шагналын босго — нарийвчлал ≥ 70% */
export const ARTIFACT_ACCURACY_THRESHOLD = 0.7;

/**
 * Олдвор олгох дүрэм (алдааны засвар №6: музей бодитоор дүүрдэг).
 * - Сессийн нарийвчлал ≥ 70% → цуглуулаагүй олдворуудаас 1
 * - Детерминистик сонголт: `seed` өгвөл тестэд давтагдана
 */
export function pickSessionArtifactReward(params: {
  correctCount: number;
  totalQuestions: number;
  /** Хэрэглэгчийн ХАРААХАН цуглуулаагүй олдворууд */
  availableArtifacts: readonly ArtifactRef[];
  /** 0..1 — өгөөгүй бол Math.random() */
  seed?: number;
}): ArtifactRef | null {
  const { correctCount, totalQuestions, availableArtifacts, seed } = params;
  if (availableArtifacts.length === 0) return null;
  const accuracy = totalQuestions > 0 ? correctCount / totalQuestions : 0;
  if (accuracy < ARTIFACT_ACCURACY_THRESHOLD) return null;

  const r = seed ?? Math.random();
  const idx = Math.min(
    availableArtifacts.length - 1,
    Math.floor(r * availableArtifacts.length)
  );
  return availableArtifacts[idx] ?? null;
}
