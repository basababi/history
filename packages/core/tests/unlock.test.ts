import { describe, expect, it } from 'vitest';
import {
  computeUnlocks,
  grantArtifact,
  pickSessionArtifactReward,
  type HeroRef,
} from '../src/unlock';

const HEROES: HeroRef[] = [
  { id: 1, rankTier: 'bronze' }, // Модун шаньюй   (0 XP)
  { id: 2, rankTier: 'silver' }, // Чингис хаан    (500 XP)
  { id: 3, rankTier: 'silver' }, // Бөртэ үжин     (500 XP)
  { id: 4, rankTier: 'gold' }, //   Ану хатан      (1500 XP)
];

describe('computeUnlocks — идемпотент байдал (Алхам 5)', () => {
  it('0 XP → зөвхөн bronze баатар нээгдэнэ', () => {
    const r = computeUnlocks({
      oldXp: 0,
      newXp: 0,
      oldUnlockedHeroIds: [],
      heroes: HEROES,
    });
    expect(r.newHeroIds).toEqual([1]);
    expect(r.allUnlockedHeroIds).toEqual([1]);
    expect(r.rankUp).toBeNull();
  });

  it('0→500 XP үсэрвэл Модун шаньюй АЛГА БОЛОХГҮЙ (алдааны засвар №8)', () => {
    const r = computeUnlocks({
      oldXp: 0,
      newXp: 500,
      oldUnlockedHeroIds: [],
      heroes: HEROES,
    });
    expect(r.allUnlockedHeroIds).toContain(1); // Модун шаньюй — bronze
    expect(r.allUnlockedHeroIds).toContain(2); // Чингис хаан
    expect(r.allUnlockedHeroIds).toContain(3); // Бөртэ үжин
    expect(r.allUnlockedHeroIds).not.toContain(4); // Ану хатан — gold=1500
    expect(r.rankUp).toBe('silver');
  });

  it('0→1500 XP хоёр tier алгасахад дундах баатрууд бүгд олгогдоно', () => {
    const r = computeUnlocks({
      oldXp: 0,
      newXp: 1500,
      oldUnlockedHeroIds: [],
      heroes: HEROES,
    });
    expect(r.allUnlockedHeroIds).toEqual([1, 2, 3, 4]);
    expect(r.rankUp).toBe('gold');
  });

  it('rankUp нь зөвхөн tier ӨӨРЧЛӨГДӨХӨД буцна', () => {
    const same = computeUnlocks({
      oldXp: 600,
      newXp: 800,
      oldUnlockedHeroIds: [1, 2, 3],
      heroes: HEROES,
    });
    expect(same.rankUp).toBeNull();
    expect(same.oldTier).toBe('silver');
    expect(same.newTier).toBe('silver');

    const up = computeUnlocks({
      oldXp: 1400,
      newXp: 1600,
      oldUnlockedHeroIds: [1, 2, 3],
      heroes: HEROES,
    });
    expect(up.rankUp).toBe('gold');
  });

  it('давхар дуудахад давхар олгохгүй — идемпотент', () => {
    const first = computeUnlocks({
      oldXp: 1400,
      newXp: 1500,
      oldUnlockedHeroIds: [1, 2, 3],
      heroes: HEROES,
    });
    expect(first.newHeroIds).toEqual([4]);

    const second = computeUnlocks({
      oldXp: 1500,
      newXp: 1500,
      oldUnlockedHeroIds: first.allUnlockedHeroIds,
      heroes: HEROES,
    });
    expect(second.newHeroIds).toHaveLength(0);
    expect(second.allUnlockedHeroIds).toEqual([1, 2, 3, 4]);
  });

  it('tier-ээс дээд баатрыг олгохгүй', () => {
    const r = computeUnlocks({
      oldXp: 0,
      newXp: 100,
      oldUnlockedHeroIds: [],
      heroes: HEROES,
    });
    expect(r.allUnlockedHeroIds).toEqual([1]);
  });

  it('bronze баатар seed-д байхгүй ч хэрэглэгч баатаргүй үлдэхгүй', () => {
    const noBronze: HeroRef[] = [{ id: 9, rankTier: 'silver' }];
    const r = computeUnlocks({
      oldXp: 0,
      newXp: 0,
      oldUnlockedHeroIds: [],
      heroes: noBronze,
    });
    // Bronze fallback хоосон → баатар олгогдохгүй, гэхдээ алдаа гарахгүй
    expect(r.allUnlockedHeroIds).toEqual([]);
  });
});

describe('grantArtifact — идемпотент', () => {
  it('шинэ олдвор олгоно', () => {
    const r = grantArtifact([1], 3);
    expect(r.granted).toBe(true);
    expect(r.artifactIds).toEqual([1, 3]);
  });

  it('давхар олгохгүй', () => {
    const r = grantArtifact([1, 3], 3);
    expect(r.granted).toBe(false);
    expect(r.artifactIds).toEqual([1, 3]);
  });
});

describe('pickSessionArtifactReward — музей бодитоор дүүрдэг (алдааны засвар №6)', () => {
  const artifacts = [{ id: 1 }, { id: 2 }, { id: 3 }];

  it('нарийвчлал ≥70% бол олдвор олгоно', () => {
    const reward = pickSessionArtifactReward({
      correctCount: 7,
      totalQuestions: 10,
      availableArtifacts: artifacts,
      seed: 0,
    });
    expect(reward).toEqual({ id: 1 });
  });

  it('нарийвчлал <70% бол олгохгүй', () => {
    expect(
      pickSessionArtifactReward({
        correctCount: 6,
        totalQuestions: 10,
        availableArtifacts: artifacts,
      })
    ).toBeNull();
  });

  it('цуглуулаагүй олдвор дуусвал null (бүгдийг цуглуулсан)', () => {
    expect(
      pickSessionArtifactReward({
        correctCount: 10,
        totalQuestions: 10,
        availableArtifacts: [],
      })
    ).toBeNull();
  });

  it('seed нь детерминистик — тест давтагдана', () => {
    const a = pickSessionArtifactReward({
      correctCount: 10,
      totalQuestions: 10,
      availableArtifacts: artifacts,
      seed: 0.99,
    });
    const b = pickSessionArtifactReward({
      correctCount: 10,
      totalQuestions: 10,
      availableArtifacts: artifacts,
      seed: 0.99,
    });
    expect(a).toEqual(b);
    expect(a).toEqual({ id: 3 });
  });

  it('seed = 1 хилийн утга массивын гадуур гарахгүй', () => {
    const r = pickSessionArtifactReward({
      correctCount: 10,
      totalQuestions: 10,
      availableArtifacts: artifacts,
      seed: 1,
    });
    expect(r).toEqual({ id: 3 });
  });
});
