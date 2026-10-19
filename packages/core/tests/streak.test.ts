import { describe, expect, it } from 'vitest';
import { isoWeekKey, updateStreak, type StreakInput } from '../src/streak';

const base: StreakInput = {
  lastActiveDate: '2026-08-24',
  streakDays: 5,
  streakShieldUsedMonth: null,
  hasShieldPerk: false,
  freeMode: false,
};

describe('updateStreak — UB (UTC+8) өдрөөр (Бүлэг 5.4)', () => {
  it('өчигдөр идэвхтэй байсан бол +1', () => {
    const r = updateStreak(base, '2026-08-25', '2026-08');
    expect(r.streakDays).toBe(6);
    expect(r.increased).toBe(true);
    expect(r.shieldUsed).toBe(false);
  });

  it('өнөөдөр аль хэдийн идэвхтэй бол өөрчлөлтгүй', () => {
    const r = updateStreak(
      { ...base, lastActiveDate: '2026-08-25' },
      '2026-08-25',
      '2026-08'
    );
    expect(r.streakDays).toBe(5);
    expect(r.increased).toBe(false);
  });

  it('анх удаа (lastActiveDate = null) → 1', () => {
    const r = updateStreak(
      { ...base, lastActiveDate: null, streakDays: 0 },
      '2026-08-25',
      '2026-08'
    );
    expect(r.streakDays).toBe(1);
    expect(r.increased).toBe(true);
  });

  it('сарын хилээр үргэлжилнэ (08-31 → 09-01)', () => {
    const r = updateStreak(
      { ...base, lastActiveDate: '2026-08-31' },
      '2026-09-01',
      '2026-09'
    );
    expect(r.streakDays).toBe(6);
  });

  it('ирээдүйн огноо — цаг хуурсныг үл тоомсорлоно', () => {
    const r = updateStreak(
      { ...base, lastActiveDate: '2026-08-30' },
      '2026-08-25',
      '2026-08'
    );
    expect(r.increased).toBe(false);
    expect(r.streakDays).toBe(5);
  });
});

describe('streak тасрах ба хамгаалалт (perk 3 — Бүлэг 3.2)', () => {
  it('perk-гүй бол 2+ өдөр алгасахад эхнээс (1)', () => {
    const r = updateStreak(
      { ...base, lastActiveDate: '2026-08-20' },
      '2026-08-25',
      '2026-08'
    );
    expect(r.streakDays).toBe(1);
    expect(r.shieldUsed).toBe(false);
  });

  it('perk-гүй бол НЭГ өдөр алгасахад ч тасарна', () => {
    const r = updateStreak(
      { ...base, lastActiveDate: '2026-08-23', hasShieldPerk: false },
      '2026-08-25',
      '2026-08'
    );
    expect(r.streakDays).toBe(1);
    expect(r.shieldUsed).toBe(false);
  });

  it('perk-тэй бол ЯГ нэг өдөр алгассныг аварна', () => {
    const r = updateStreak(
      { ...base, lastActiveDate: '2026-08-23', hasShieldPerk: true },
      '2026-08-25',
      '2026-08'
    );
    expect(r.shieldUsed).toBe(true);
    expect(r.streakDays).toBe(6);
    expect(r.newShieldUsedMonth).toBe('2026-08');
  });

  it('perk-тэй ч 5 өдөр алгассныг аврахгүй («НЭГ өдөр» гэсэн заалт)', () => {
    const r = updateStreak(
      { ...base, lastActiveDate: '2026-08-20', hasShieldPerk: true },
      '2026-08-25',
      '2026-08'
    );
    expect(r.shieldUsed).toBe(false);
    expect(r.streakDays).toBe(1);
  });

  it('хамгаалалт сард 1 удаа л ашиглагдана', () => {
    const r = updateStreak(
      {
        ...base,
        lastActiveDate: '2026-08-23',
        hasShieldPerk: true,
        streakShieldUsedMonth: '2026-08',
      },
      '2026-08-25',
      '2026-08'
    );
    expect(r.shieldUsed).toBe(false);
    expect(r.streakDays).toBe(1);
  });

  it('шинэ сар эхэлбэл хамгаалалт дахин боломжтой', () => {
    const r = updateStreak(
      {
        ...base,
        lastActiveDate: '2026-08-31',
        hasShieldPerk: true,
        streakShieldUsedMonth: '2026-08',
      },
      '2026-09-02',
      '2026-09'
    );
    expect(r.shieldUsed).toBe(true);
    expect(r.newShieldUsedMonth).toBe('2026-09');
  });
});

describe('streak-гүй горим (Бүлэг 3.7 — бие даасан байдал)', () => {
  it('тоолуур хөдлөхгүй, харин хадгалагдана', () => {
    const r = updateStreak(
      { ...base, lastActiveDate: '2026-08-20', freeMode: true },
      '2026-08-25',
      '2026-08'
    );
    expect(r.increased).toBe(false);
    expect(r.streakDays).toBe(5);
  });

  it('streak-гүй горимд тасрахгүй — даралт байхгүй', () => {
    const r = updateStreak(
      { ...base, lastActiveDate: '2026-01-01', freeMode: true },
      '2026-08-25',
      '2026-08'
    );
    expect(r.streakDays).toBe(5);
  });
});

describe('7 хоногийн босго (Бүлэг 3.6: +200 бонус)', () => {
  it('7 дахь өдөрт тэмдэглэгдэнэ', () => {
    const r = updateStreak({ ...base, streakDays: 6 }, '2026-08-25', '2026-08');
    expect(r.streakDays).toBe(7);
    expect(r.reachedWeekMilestone).toBe(true);
  });

  it('14 дэх өдөрт мөн тэмдэглэгдэнэ', () => {
    const r = updateStreak({ ...base, streakDays: 13 }, '2026-08-25', '2026-08');
    expect(r.reachedWeekMilestone).toBe(true);
  });

  it('8 дахь өдөрт тэмдэглэгдэхгүй', () => {
    const r = updateStreak({ ...base, streakDays: 7 }, '2026-08-25', '2026-08');
    expect(r.reachedWeekMilestone).toBe(false);
  });
});

describe('isoWeekKey', () => {
  it('2026-08-24 (Даваа) → 2026-W35', () => {
    expect(isoWeekKey(Date.UTC(2026, 7, 24))).toBe('2026-W35');
  });

  it('оны заагийн тохиолдол зөв форматтай', () => {
    expect(isoWeekKey(Date.UTC(2027, 0, 1))).toMatch(/^20\d{2}-W\d{2}$/);
  });

  it('нэг долоо хоногийн бүх өдөр ижил түлхүүртэй', () => {
    const keys = new Set<string>();
    for (let d = 24; d <= 30; d++) {
      keys.add(isoWeekKey(Date.UTC(2026, 7, d)));
    }
    expect(keys.size).toBe(1);
  });
});
