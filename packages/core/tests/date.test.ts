import { describe, expect, it } from 'vitest';
import {
  daysBetweenUb,
  todayInUlaanbaatar,
  ubDate,
  ubDateToUtcMs,
  ubMonth,
  yesterdayInUlaanbaatar,
} from '../src/date';

describe('UB (UTC+8) огнооны хөрвүүлэлт — Бүлэг 5.4', () => {
  it('UTC 15:59 → UB нь мөн өдөр', () => {
    expect(ubDate(Date.UTC(2026, 7, 24, 15, 59))).toBe('2026-08-24');
  });

  it('UTC 16:00 → UB нь ДАРААГИЙН өдөр (цагийн бүсийн хил)', () => {
    expect(ubDate(Date.UTC(2026, 7, 24, 16, 0))).toBe('2026-08-25');
  });

  it('UTC шөнө дунд → UB нь мөн өдрийн 08:00', () => {
    expect(ubDate(Date.UTC(2026, 7, 25, 0, 0))).toBe('2026-08-25');
  });

  it('сарын хил: UTC 08-31 16:00 → UB 09-01', () => {
    expect(ubDate(Date.UTC(2026, 7, 31, 16, 0))).toBe('2026-09-01');
    expect(ubMonth(Date.UTC(2026, 7, 31, 16, 0))).toBe('2026-09');
  });

  it('оны хил: UTC 12-31 16:00 → UB 2027-01-01', () => {
    expect(ubDate(Date.UTC(2026, 11, 31, 16, 0))).toBe('2027-01-01');
  });

  it('өнөөдөр/өчигдөр 1 өдрийн зөрүүтэй', () => {
    const now = Date.UTC(2026, 7, 25, 10, 0);
    expect(todayInUlaanbaatar(now)).toBe('2026-08-25');
    expect(yesterdayInUlaanbaatar(now)).toBe('2026-08-24');
  });

  it('ubDateToUtcMs нь эргэж ижил огноо өгнө', () => {
    const ms = ubDateToUtcMs('2026-08-25');
    expect(ubDate(ms)).toBe('2026-08-25');
    // UB 00:00 = UTC өмнөх өдрийн 16:00
    expect(new Date(ms).toISOString()).toBe('2026-08-24T16:00:00.000Z');
  });

  it('daysBetweenUb сарын хилээр зөв тоолно', () => {
    expect(daysBetweenUb('2026-08-30', '2026-09-02')).toBe(3);
    expect(daysBetweenUb('2026-08-25', '2026-08-25')).toBe(0);
    expect(daysBetweenUb('2026-08-25', '2026-08-24')).toBe(-1);
  });
});
