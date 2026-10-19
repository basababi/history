/**
 * «Өдрийн тав»-ын цэвэр логик — тогтмол байдал, шударга харьцуулалт, цуврал
 */
import { describe, expect, it } from 'vitest';
import {
  advanceStreak,
  compareScores,
  cooldownDays,
  DAILY_QUESTION_COUNT,
  dayNumber,
  formatDuration,
  headToHead,
  isValidDayKey,
  msUntilNextDay,
  optionOrder,
  pickDailySet,
  seededShuffle,
  shiftDay,
  toCanonicalIndex,
  toDisplayIndex,
  visibleStreak,
  weekStartDay,
  type DailyCandidate,
  type DayScore,
} from '../src/daily';
import type { Difficulty } from '../src/question';

function pool(n: number, lastUsed: (i: number) => string | null = () => null): DailyCandidate[] {
  const diffs: Difficulty[] = ['easy', 'medium', 'hard'];
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    difficulty: diffs[i % 3] as Difficulty,
    eraId: (i % 3) + 1,
    lastUsedDay: lastUsed(i),
  }));
}

describe('Өдрийн түлхүүр', () => {
  it('зөв огноог л хүлээн авна', () => {
    expect(isValidDayKey('2026-10-19')).toBe(true);
    expect(isValidDayKey('2026-02-30')).toBe(false);
    expect(isValidDayKey('2026-1-5')).toBe(false);
    expect(isValidDayKey('../etc')).toBe(false);
  });

  it('эхний өдөр #1, дараагийнх #2', () => {
    expect(dayNumber('2026-10-19', '2026-10-19')).toBe(1);
    expect(dayNumber('2026-11-01', '2026-10-19')).toBe(14);
  });

  it('өдөр шилжүүлэх нь сар, оны хилийг зөв давна', () => {
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('долоо хоногийн эхлэл — Даваа гараг', () => {
    expect(weekStartDay('2026-10-19')).toBe('2026-10-19'); // Даваа
    expect(weekStartDay('2026-10-25')).toBe('2026-10-19'); // Ням
    expect(weekStartDay('2026-10-26')).toBe('2026-10-26');
  });

  it('дараагийн өдөр хүртэлх хугацаа UB шөнө дундаар', () => {
    // UB 23:59:00 = UTC 15:59:00
    expect(msUntilNextDay(Date.UTC(2026, 9, 19, 15, 59, 0))).toBe(60_000);
    // UB 00:00 = UTC 16:00 — бүтэн өдөр
    expect(msUntilNextDay(Date.UTC(2026, 9, 19, 16, 0, 0))).toBe(24 * 3600_000);
  });
});

describe('Сонголтын дараалал — зөв хариулт байрлалдаа тогтохгүй', () => {
  it('өдөр + асуултаар тогтмол', () => {
    expect(optionOrder('2026-10-19', 7, 4)).toEqual(optionOrder('2026-10-19', 7, 4));
  });

  it('үргэлж бүрэн сэлгэмэл (давхардал, алдагдалгүй)', () => {
    for (let q = 1; q <= 50; q++) {
      const order = optionOrder('2026-10-19', q, 4);
      expect([...order].sort()).toEqual([0, 1, 2, 3]);
    }
  });

  it('«А» зөв хариулт 4 байрлалд бараг жигд тархана', () => {
    const counts = [0, 0, 0, 0];
    for (let d = 0; d < 400; d++) {
      const order = optionOrder(shiftDay('2026-01-01', d), 3, 4);
      counts[toDisplayIndex(order, 0)]! += 1;
    }
    for (const c of counts) expect(c).toBeGreaterThan(60);
  });

  it('хөрвүүлэлт хоёр чиглэлд таарна', () => {
    const order = optionOrder('2026-10-20', 11, 4);
    for (let display = 0; display < 4; display++) {
      const canonical = toCanonicalIndex(order, display);
      expect(canonical).not.toBeNull();
      expect(toDisplayIndex(order, canonical!)).toBe(display);
    }
  });

  it('хүчингүй индексийг татгалзана', () => {
    const order = optionOrder('2026-10-20', 11, 4);
    expect(toCanonicalIndex(order, -1)).toBeNull();
    expect(toCanonicalIndex(order, 4)).toBeNull();
    expect(toCanonicalIndex(order, 1.5)).toBeNull();
  });

  it('холихгүй горимд дараалал хэвээр', () => {
    expect(optionOrder('2026-10-20', 1, 2, false)).toEqual([0, 1]);
  });

  it('seededShuffle оролтыг өөрчлөхгүй', () => {
    const input = [1, 2, 3, 4, 5];
    seededShuffle(input, 'x');
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('Өдрийн багц сонголт', () => {
  it('ижил сан + ижил өдөр → ижил багц (бүх хүнд ижил)', () => {
    const p = pool(30);
    expect(pickDailySet(p, '2026-10-19')).toEqual(pickDailySet([...p].reverse(), '2026-10-19'));
  });

  it('өөр өдөр → өөр багц', () => {
    const p = pool(30);
    expect(pickDailySet(p, '2026-10-19')).not.toEqual(pickDailySet(p, '2026-10-20'));
  });

  it(`${DAILY_QUESTION_COUNT} давхардалгүй асуулт`, () => {
    const set = pickDailySet(pool(30), '2026-10-19');
    expect(set).toHaveLength(DAILY_QUESTION_COUNT);
    expect(new Set(set).size).toBe(DAILY_QUESTION_COUNT);
  });

  it('хүндрэл амархнаас хүнд рүү өснө', () => {
    const p = pool(30);
    const byId = new Map(p.map((c) => [c.id, c.difficulty]));
    const rank = { easy: 0, medium: 1, hard: 2 } as const;
    const ranks = pickDailySet(p, '2026-10-19').map((id) => rank[byId.get(id)!]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(ranks).toEqual([0, 0, 1, 1, 2]);
  });

  it('саяхан орсон асуултыг давтахгүй', () => {
    // Эхний 10 нь өчигдөр орсон — өнөөдрийн багцад орох ёсгүй
    const p = pool(30, (i) => (i < 10 ? '2026-10-18' : null));
    const set = pickDailySet(p, '2026-10-19');
    for (const id of set) expect(id).toBeGreaterThan(10);
  });

  it('хэзээ ч ороогүй асуултыг эхэлж сонгоно', () => {
    const p = pool(30, (i) => (i < 25 ? '2026-08-01' : null));
    const set = pickDailySet(p, '2026-10-19');
    expect(set.filter((id) => id > 25).length).toBeGreaterThanOrEqual(5 - 2);
  });

  it('сан бага бол хамгийн эрт ашигласнаар нөхнө — хоосон буцаахгүй', () => {
    const p = pool(6, (i) => shiftDay('2026-10-18', -i));
    expect(pickDailySet(p, '2026-10-19')).toHaveLength(5);
  });

  it('сангаас олон асуулт шаардвал байгаагаа буцаана', () => {
    expect(pickDailySet(pool(3), '2026-10-19')).toHaveLength(3);
    expect(pickDailySet([], '2026-10-19')).toEqual([]);
  });

  it('давтагдахгүй хоног сангийн хэмжээнд тааруулна', () => {
    expect(cooldownDays(21)).toBe(3);
    expect(cooldownDays(150)).toBe(29);
    expect(cooldownDays(1000)).toBe(30);
    expect(cooldownDays(4)).toBe(0);
  });

  it('21 асуулттай сан 4 өдөр дараалан давхардалгүй багц гаргана', () => {
    let p = pool(21);
    const seen = new Set<number>();
    for (let d = 0; d < 4; d++) {
      const day = shiftDay('2026-10-19', d);
      const set = pickDailySet(p, day);
      for (const id of set) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
      p = p.map((c) => (set.includes(c.id) ? { ...c, lastUsedDay: day } : c));
    }
  });
});

describe('Дүн харьцуулалт', () => {
  const s = (correct: number, totalMs: number): DayScore => ({ correct, totalMs });

  it('зөв хариулт эхэлж шийднэ', () => {
    expect(compareScores(s(4, 60_000), s(3, 10_000))).toMatchObject({ outcome: 'win', decidedBy: 'correct', correctDiff: 1 });
    expect(compareScores(s(2, 10_000), s(3, 60_000))).toMatchObject({ outcome: 'loss', decidedBy: 'correct' });
  });

  it('оноо тэнцвэл хугацаа шийднэ', () => {
    expect(compareScores(s(4, 30_000), s(4, 36_000))).toMatchObject({ outcome: 'win', decidedBy: 'time', msDiff: 6_000 });
  });

  it('секундээс бага зөрүү — тэнцсэн', () => {
    expect(compareScores(s(4, 30_000), s(4, 30_400))).toMatchObject({ outcome: 'tie', decidedBy: 'none' });
  });

  it('тулааны нийт оноо — зөвхөн хоёулаа тоглосон өдрөөр', () => {
    const mine = new Map([
      ['2026-10-19', s(4, 30_000)],
      ['2026-10-20', s(2, 30_000)],
      ['2026-10-21', s(5, 20_000)],
    ]);
    const theirs = new Map([
      ['2026-10-19', s(3, 30_000)],
      ['2026-10-20', s(4, 30_000)],
      ['2026-10-22', s(5, 10_000)],
    ]);
    expect(headToHead(mine, theirs)).toEqual({ wins: 1, losses: 1, ties: 0, days: 2 });
  });
});

describe('Цуврал', () => {
  const base = { streakDays: 0, bestStreak: 0, lastActiveDate: null };

  it('анх тоглоход 1', () => {
    expect(advanceStreak(base, '2026-10-19')).toMatchObject({ streakDays: 1, bestStreak: 1, increased: true });
  });

  it('өдөр дараалан тоглоход өснө, дээд амжилт хадгалагдана', () => {
    const s1 = advanceStreak(base, '2026-10-19');
    const s2 = advanceStreak(s1, '2026-10-20');
    expect(s2).toMatchObject({ streakDays: 2, bestStreak: 2 });
    const broken = advanceStreak(s2, '2026-10-23');
    expect(broken).toMatchObject({ streakDays: 1, bestStreak: 2 });
  });

  it('нэг өдөрт хоёр дахин нэмэгдэхгүй', () => {
    const s1 = advanceStreak(base, '2026-10-19');
    expect(advanceStreak(s1, '2026-10-19')).toMatchObject({ streakDays: 1, increased: false });
  });

  it('ирээдүйн огноотой төлөвийг өөрчлөхгүй', () => {
    const s = { streakDays: 3, bestStreak: 3, lastActiveDate: '2026-10-25' };
    expect(advanceStreak(s, '2026-10-19')).toMatchObject({ streakDays: 3, increased: false });
  });

  it('харагдах цуврал: өчигдөр тоглосон бол амьд, түүнээс өмнө бол 0', () => {
    const s = { streakDays: 5, bestStreak: 5, lastActiveDate: '2026-10-18' };
    expect(visibleStreak(s, '2026-10-19')).toBe(5);
    expect(visibleStreak(s, '2026-10-20')).toBe(0);
    expect(visibleStreak(base, '2026-10-20')).toBe(0);
  });
});

describe('Хугацааны формат', () => {
  it('секунд ба минут', () => {
    expect(formatDuration(38_200)).toBe('38 сек');
    expect(formatDuration(65_000)).toBe('1 мин 05 сек');
    expect(formatDuration(-5)).toBe('0 сек');
  });
});
