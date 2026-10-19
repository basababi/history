import { describe, expect, it } from 'vitest';
import {
  nextTier,
  RANK_META,
  tierFromXp,
  TIER_ORDER,
  validateHeroChronology,
} from '../src/rank';

describe('tierFromXp', () => {
  it('хязгаарын тохиолдлууд', () => {
    expect(tierFromXp(0)).toBe('bronze');
    expect(tierFromXp(499)).toBe('bronze');
    expect(tierFromXp(500)).toBe('silver');
    expect(tierFromXp(1499)).toBe('silver');
    expect(tierFromXp(1500)).toBe('gold');
    expect(tierFromXp(3999)).toBe('gold');
    expect(tierFromXp(4000)).toBe('platinum');
  });

  it('tier-ийн minXp өсөх дараалалтай', () => {
    for (let i = 1; i < TIER_ORDER.length; i++) {
      const prev = RANK_META[TIER_ORDER[i - 1]!];
      const curr = RANK_META[TIER_ORDER[i]!];
      expect(curr.minXp).toBeGreaterThan(prev.minXp);
    }
  });

  it('nextTier дээд түвшинд null', () => {
    expect(nextTier('bronze')).toBe('silver');
    expect(nextTier('platinum')).toBeNull();
  });
});

describe('он цагийн дараалал (Бүлэг 3.2 анхааруулга)', () => {
  it('Модун (МЭӨ III з.) → Чингис (XIII з.) → Ану (XVII з.) — зөрчилгүй', () => {
    const heroes = [
      { rankTier: 'bronze' as const, chronologicalOrder: 1 }, // Модун шаньюй
      { rankTier: 'silver' as const, chronologicalOrder: 2 }, // Чингис хаан
      { rankTier: 'silver' as const, chronologicalOrder: 2.5 }, // Бөртэ үжин
      { rankTier: 'gold' as const, chronologicalOrder: 3 }, // Ану хатан
    ];
    const result = validateHeroChronology(heroes);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('буруу дараалал илрүүлнэ — хожим үеийн дүр өмнөх tier-д орвол', () => {
    const heroes = [
      { rankTier: 'bronze' as const, chronologicalOrder: 3 }, // Ану хатан bronze-д?
      { rankTier: 'silver' as const, chronologicalOrder: 1 }, // Модун silver-д?
    ];
    const result = validateHeroChronology(heroes);
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});