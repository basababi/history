import { describe, expect, it } from 'vitest';
import { applyEraBonus, applyFiftyFifty } from '../src/perk';

describe('perk 4: эриний бонус ×1.5', () => {
  const perk = { eraBonusMultiplier: 1.5 };

  it('баатрын эринтэй таарвал ×1.5', () => {
    expect(applyEraBonus(10, 1, 1, perk)).toBe(15);
  });

  it('таарахгүй бол өөрчлөлтгүй', () => {
    expect(applyEraBonus(10, 1, 2, perk)).toBe(10);
    expect(applyEraBonus(10, null, 1, perk)).toBe(10);
  });

  it('perk байхгүй бол өөрчлөлтгүй', () => {
    expect(applyEraBonus(10, 1, 1, {})).toBe(10);
  });
});

describe('perk 2: 50/50 — сервер талаас (алдааны засвар №7)', () => {
  it('зөв хариулт ХЭЗЭЭ Ч арилгагдахгүй', () => {
    for (let trial = 0; trial < 50; trial++) {
      const r = applyFiftyFifty(4, 2, false);
      expect(r.allowed).toBe(true);
      expect(r.hiddenIndexes).not.toContain(2);
      expect(r.hiddenIndexes.length).toBe(1); // floor(3/2) = 1
    }
  });

  it('4 сонголтод 1 бурууг арилгана (floor(3/2))', () => {
    const r = applyFiftyFifty(4, 0, false);
    expect(r.hiddenIndexes.length).toBe(1);
    expect(r.hiddenIndexes[0]).not.toBe(0);
  });

  it('өдөрт 1 удаа л ашиглагдана', () => {
    const r = applyFiftyFifty(4, 1, true);
    expect(r.allowed).toBe(false);
    expect(r.hiddenIndexes).toEqual([]);
  });
});