/**
 * Тоглогчийн замын тест (ROADMAP B5)
 *
 * Хамгийн чухал шалгуур: зам нь ХААЛТ БИШ, ЭРЭМБЭ. Ямар ч зам сонгосон
 * бүх үйлдэл хүртээмжтэй хэвээр байх ёстой (Бүлэг 3.7 — бие даасан байдал).
 */
import { describe, expect, it } from 'vitest';
import {
  orderActions,
  parsePlayerPath,
  PLAYER_PATH_META,
  PLAYER_PATHS,
  type PathAction,
} from '../src/playerPath';

const ALL: PathAction[] = [
  'league', 'battle', 'heroes', 'ger', 'freeMode',
  'mentor', 'contribution', 'voiceBattle', 'script',
];

describe('🔴 Зам нь ХААЛТ БИШ — юу ч алдагдахгүй', () => {
  it('ямар ч замд бүх үйлдэл үлдэнэ', () => {
    for (const path of PLAYER_PATHS) {
      const out = orderActions(ALL, path);
      expect(out).toHaveLength(ALL.length);
      expect([...out].sort()).toEqual([...ALL].sort());
    }
  });

  it('зам сонгоогүй үед анхны дараалал хэвээр', () => {
    expect(orderActions(ALL, null)).toEqual(ALL);
  });
});

describe('Эрэмбэлэлт', () => {
  it('өрсөлдөгчид лиг түрүүлж гарна', () => {
    expect(orderActions(ALL, 'competitor')[0]).toBe('league');
  });

  it('цуглуулагчид баатар түрүүлнэ', () => {
    expect(orderActions(ALL, 'collector')[0]).toBe('heroes');
  });

  it('судлаачид чөлөөт горим түрүүлнэ', () => {
    expect(orderActions(ALL, 'researcher')[0]).toBe('freeMode');
  });

  it('өгүүлэгчид өвөө эмээгийн дуу хоолой түрүүлнэ', () => {
    expect(orderActions(ALL, 'storyteller')[0]).toBe('contribution');
  });

  it('эрэмбэ тогтвортой — давтан дуудахад ижил', () => {
    expect(orderActions(ALL, 'collector')).toEqual(orderActions(ALL, 'collector'));
  });

  it('тэргүүлэх бус үйлдлүүд анхны дарааллаа хадгална', () => {
    const out = orderActions(ALL, 'competitor');
    const rest = out.filter((a) => !PLAYER_PATH_META.competitor.priority.includes(a));
    const expected = ALL.filter((a) => !PLAYER_PATH_META.competitor.priority.includes(a));
    expect(rest).toEqual(expected);
  });
});

describe('parsePlayerPath — ӨС-ийн утгыг аюулгүй унших', () => {
  it('хүчинтэй утгыг буцаана', () => {
    expect(parsePlayerPath('collector')).toBe('collector');
  });

  it('мэдэгдэхгүй утганд null', () => {
    expect(parsePlayerPath('wizard')).toBeNull();
    expect(parsePlayerPath(null)).toBeNull();
    expect(parsePlayerPath(undefined)).toBeNull();
  });
});

describe('Тодорхойлолтын бүрэн байдал', () => {
  it('зам бүр нэр, emoji, өөрийгөө таних хэллэгтэй', () => {
    for (const path of PLAYER_PATHS) {
      const meta = PLAYER_PATH_META[path];
      expect(meta.label.length).toBeGreaterThan(2);
      expect(meta.emoji.length).toBeGreaterThan(0);
      expect(meta.selfDescription.length).toBeGreaterThan(20);
      expect(meta.priority.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('зам бүрийн тэргүүлэх жагсаалтад давхардал байхгүй', () => {
    for (const path of PLAYER_PATHS) {
      const p = PLAYER_PATH_META[path].priority;
      expect(new Set(p).size).toBe(p.length);
    }
  });
});
