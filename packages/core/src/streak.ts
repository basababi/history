/**
 * Streak логик — Бүлэг 3.2 (perk 3), 3.7 (streak-гүй горим), 5.4 (UTC+8)
 *
 * - «Өдөр»-ийг Asia/Ulaanbaatar (UTC+8)-аар тооцоолно
 * - Streak хамгаалалт: «НЭГ өдөр алгассан ч streak тасрахгүй (сард 1 удаа)»
 *   → зөвхөн ЯГ нэг өдөр алгассан үед л ажиллана, 5 өдөр алгассныг аврахгүй
 * - Streak-гүй горим: даралтыг унтраах боломж (Бүлэг 3.7)
 */
import { daysBetweenUb } from './date';

/** ISO week key: 2026-W35 хэлбэрээр */
export function isoWeekKey(dateUtcMs: number): string {
  const d = new Date(dateUtcMs);
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const dayNum = (target.getUTCDay() + 6) % 7; // Даваа=0 … Ням=6
  target.setUTCDate(target.getUTCDate() - dayNum + 3); // энэ долоо хоногийн лхагва
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week =
    1 +
    Math.round(
      (target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Хамгаалалт хамгийн ихдээ хэдэн өдрийн завсрыг аврах вэ (яг 1 өдөр) */
export const SHIELD_MAX_GAP_DAYS = 2;

export interface StreakInput {
  /** Сүүлийн идэвхтэй өдөр — UB огноо YYYY-MM-DD (хоосон = анх удаа) */
  lastActiveDate: string | null;
  streakDays: number;
  /** Хамгаалалтыг сүүлд ашигласан сар (YYYY-MM) эсвэл null */
  streakShieldUsedMonth: string | null;
  /** Идэвхтэй баатарт streakShield perk байгаа эсэх (Бүлэг 3.2) */
  hasShieldPerk: boolean;
  /** Streak-гүй горим идэвхтэй эсэх (Бүлэг 3.7) */
  freeMode: boolean;
}

export interface StreakResult {
  streakDays: number;
  increased: boolean;
  shieldUsed: boolean;
  newShieldUsedMonth: string | null;
  /** 7 хоногийн бонусын эрх нээгдсэн эсэх (Бүлэг 3.6: +200) */
  reachedWeekMilestone: boolean;
}

/**
 * Quiz дууссаны дараа streak шинэчлэх.
 * @param todayUb өнөөдрийн UB огноо (YYYY-MM-DD)
 * @param currentMonthUb одоогийн UB сар (YYYY-MM) — shield-ийн лимитэд
 */
export function updateStreak(
  input: StreakInput,
  todayUb: string,
  currentMonthUb: string
): StreakResult {
  const unchanged = (streakDays: number): StreakResult => ({
    streakDays,
    increased: false,
    shieldUsed: false,
    newShieldUsedMonth: input.streakShieldUsedMonth,
    reachedWeekMilestone: false,
  });

  // Streak-гүй горим: тоолуурыг хөдөлгөхгүй, харин хадгална (Бүлэг 3.7)
  if (input.freeMode) return unchanged(input.streakDays);

  // Анх удаа
  if (!input.lastActiveDate) {
    return {
      streakDays: 1,
      increased: true,
      shieldUsed: false,
      newShieldUsedMonth: input.streakShieldUsedMonth,
      reachedWeekMilestone: false,
    };
  }

  // Өнөөдөр аль хэдийн идэвхтэй байсан
  if (input.lastActiveDate === todayUb) return unchanged(input.streakDays);

  const gap = daysBetweenUb(input.lastActiveDate, todayUb);

  // Ирээдүйн огноо — цаг хуурсан байх магадлалтай, өөрчлөхгүй
  if (gap <= 0) return unchanged(input.streakDays);

  const grew = (days: number, shieldUsed: boolean): StreakResult => ({
    streakDays: days,
    increased: true,
    shieldUsed,
    newShieldUsedMonth: shieldUsed ? currentMonthUb : input.streakShieldUsedMonth,
    reachedWeekMilestone: days > 0 && days % 7 === 0,
  });

  // Өчигдөр идэвхтэй байсан — хэвийн үргэлжлэл
  if (gap === 1) return grew(input.streakDays + 1, false);

  // ЯГ нэг өдөр алгассан → хамгаалалт ашиглаж болно (сард 1 удаа, perk-тэй бол)
  const canUseShield =
    gap === SHIELD_MAX_GAP_DAYS &&
    input.hasShieldPerk &&
    input.streakShieldUsedMonth !== currentMonthUb &&
    input.streakDays > 0;

  if (canUseShield) return grew(input.streakDays + 1, true);

  // Тасарсан — эхнээс
  return grew(1, false);
}
