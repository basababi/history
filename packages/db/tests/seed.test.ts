import { describe, expect, it } from 'vitest';
import { validateHeroChronology, RANK_META, type RankTier } from '@nomad/core';
import { ERA_SEED } from '../src/seed/eras';
import { HERO_SEED } from '../src/seed/heroes';
import { ARTIFACT_SEED } from '../src/seed/artifacts';
import { QUESTION_SEED } from '../src/seed/questions';
import { KNOWLEDGE_SEED } from '../src/seed/knowledge';

describe('Баатрын он цагийн дараалал (Бүлэг 3.2 анхааруулга)', () => {
  it('rank ахих тусам он цаг УРАГШ явна — зөрчилгүй', () => {
    const result = validateHeroChronology(
      HERO_SEED.map((h) => ({
        name: h.name,
        rankTier: h.rankTier,
        chronologicalOrder: h.chronologicalOrder,
      }))
    );
    expect(result.violations).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('tier бүрт дор хаяж нэг баатар байна (platinum багтана)', () => {
    const tiers: RankTier[] = ['bronze', 'silver', 'gold', 'platinum'];
    for (const tier of tiers) {
      const count = HERO_SEED.filter((h) => h.rankTier === tier).length;
      expect(count, `${tier} tier баатаргүй байна`).toBeGreaterThan(0);
    }
  });

  it('perk 4 төрөл бүр дор хаяж нэг баатарт байна', () => {
    const keys = ['extraSeconds', 'fiftyFifty', 'streakShield', 'eraBonusMultiplier'];
    for (const key of keys) {
      const has = HERO_SEED.some((h) => key in h.perk);
      expect(has, `${key} perk-тэй баатар байхгүй`).toBe(true);
    }
  });
});

describe('Контентийн засаглал (Бүлэг 6.2)', () => {
  it('асуулт бүр source_ref-тэй — ХООСОН БАЙЖ БОЛОХГҮЙ', () => {
    for (const q of QUESTION_SEED) {
      expect(q.sourceRef.trim().length, `«${q.body}» эх сурвалжгүй`).toBeGreaterThan(0);
    }
  });

  it('correctIndex нь options-ийн хүрээнд байна', () => {
    for (const q of QUESTION_SEED) {
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.options.length);
    }
  });

  it('асуулт бүр дор хаяж 2 сонголттой', () => {
    for (const q of QUESTION_SEED) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('сонголтууд давхардаагүй', () => {
    for (const q of QUESTION_SEED) {
      expect(new Set(q.options).size, `«${q.body}» давхардсан сонголттой`).toBe(
        q.options.length
      );
    }
  });

  it('асуултын бие давхардаагүй', () => {
    const bodies = QUESTION_SEED.map((q) => q.body);
    expect(new Set(bodies).size).toBe(bodies.length);
  });

  it('баатар, олдвор бүр source_ref-тэй', () => {
    for (const h of HERO_SEED) expect(h.sourceRef.length).toBeGreaterThan(0);
    for (const a of ARTIFACT_SEED) expect(a.sourceRef.length).toBeGreaterThan(0);
  });

  it('гурван хүндрэлийн түвшин бүгд төлөөлөлтэй', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      expect(QUESTION_SEED.some((q) => q.difficulty === d)).toBe(true);
    }
  });
});

describe('RAG корпус (ADR-007)', () => {
  it('chunk бүр эх сурвалжтай — хариултад заавал харуулна', () => {
    for (const k of KNOWLEDGE_SEED) {
      expect(k.sourceRef.trim().length).toBeGreaterThan(0);
    }
  });

  it('chunk бүр seed-д байгаа баатарт харьяалагдана', () => {
    const names = new Set(HERO_SEED.map((h) => h.name));
    for (const k of KNOWLEDGE_SEED) {
      expect(names.has(k.heroName), `Тодорхойгүй баатар: ${k.heroName}`).toBe(true);
    }
  });

  it('баатар бүр дор хаяж нэг chunk-тай — «мэдэхгүй» гэж л хариулахгүй', () => {
    for (const h of HERO_SEED) {
      const count = KNOWLEDGE_SEED.filter((k) => k.heroName === h.name).length;
      expect(count, `${h.name}-д мэдлэг байхгүй`).toBeGreaterThan(0);
    }
  });

  it('chunk бүр түлхүүр үгтэй', () => {
    for (const k of KNOWLEDGE_SEED) {
      expect(k.keywords.length).toBeGreaterThan(0);
    }
  });
});

describe('Эрин ба rank-ийн нийцэл', () => {
  it('3 эрин, orderIndex давхардаагүй', () => {
    const orders = ERA_SEED.map((e) => e.orderIndex);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('баатрын эрин seed-д байгаа эрин рүү заана', () => {
    const keys = new Set(ERA_SEED.map((e) => e.key));
    for (const h of HERO_SEED) expect(keys.has(h.eraKey)).toBe(true);
    for (const a of ARTIFACT_SEED) expect(keys.has(a.eraKey)).toBe(true);
    for (const q of QUESTION_SEED) expect(keys.has(q.eraKey)).toBe(true);
  });

  it('RANK_META-гийн minXp өсөх дараалалтай', () => {
    const tiers: RankTier[] = ['bronze', 'silver', 'gold', 'platinum'];
    for (let i = 1; i < tiers.length; i++) {
      expect(RANK_META[tiers[i]!].minXp).toBeGreaterThan(RANK_META[tiers[i - 1]!].minXp);
    }
  });
});
