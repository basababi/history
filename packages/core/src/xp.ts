/**
 * XP-ийн дүрэм — Бүлэг 3.6, бүх 7 бонус бүрэн хэрэгжсэн
 * Хязгаарууд (өдөрт 20 асуулт г.м.) сервер талаас хянагдана.
 */

import type { Difficulty } from './question';

export const XP_RULES = {
  easyCorrect: 10,
  mediumCorrect: 15,
  hardCorrect: 25,
  fastAnswerMultiplier: 1.5,
  fastAnswerThresholdMs: 5000,
  dailyChallengeBonus: 50,
  streak7DaysBonus: 200,
  leagueTop3Bonus: 500,
  inviteFriendBonus: 300,
} as const;

/** Өдөрт амархан асуултын хязгаар (Бүлэг 3.6) */
export const DAILY_EASY_LIMIT = 20;

export function baseXpForDifficulty(difficulty: Difficulty): number {
  switch (difficulty) {
    case 'easy':
      return XP_RULES.easyCorrect;
    case 'medium':
      return XP_RULES.mediumCorrect;
    case 'hard':
      return XP_RULES.hardCorrect;
  }
}

/**
 * Нэг хариултын XP тооцоолол.
 * @param responseMs СЕРВЕРИЙН цагаар хэмжсэн: received_at − question.served_at
 */
export function computeAnswerXp(params: {
  difficulty: Difficulty;
  isCorrect: boolean;
  responseMs: number;
}): { xp: number; timeBonusApplied: boolean } {
  if (!params.isCorrect) return { xp: 0, timeBonusApplied: false };
  let xp = baseXpForDifficulty(params.difficulty);
  const timeBonusApplied =
    params.responseMs > 0 && params.responseMs < XP_RULES.fastAnswerThresholdMs;
  if (timeBonusApplied) xp = Math.round(xp * XP_RULES.fastAnswerMultiplier);
  return { xp, timeBonusApplied };
}

/** Бонус олгох нөхцөл шалгагчид — серверийн лимитийн төлөв */
export interface BonusLedger {
  dailyChallengeDoneOn?: string; // YYYY-MM-DD (UB)
  streak7AwardedWeeks?: string[]; // ISO week keys
  leagueTop3AwardedWeeks?: string[];
  invitesThisMonth?: { monthKey: string; count: number };
}

/** Өдрийн сорилын бонус: +50, өдөрт 1 */
export function awardDailyChallenge(
  ledger: BonusLedger,
  ubDate: string
): { awarded: boolean; ledger: BonusLedger } {
  if (ledger.dailyChallengeDoneOn === ubDate) {
    return { awarded: false, ledger };
  }
  return {
    awarded: true,
    ledger: { ...ledger, dailyChallengeDoneOn: ubDate },
  };
}

/** Streak 7 хоногийн бонус: +200, долоо хоногт 1 */
export function awardStreak7(
  ledger: BonusLedger,
  weekKey: string
): { awarded: boolean; ledger: BonusLedger } {
  const weeks = ledger.streak7AwardedWeeks ?? [];
  if (weeks.includes(weekKey)) return { awarded: false, ledger };
  return {
    awarded: true,
    ledger: { ...ledger, streak7AwardedWeeks: [...weeks, weekKey] },
  };
}

/** Лигийн эхний 3 байрны бонус: +500 + баатрын хэлтэрхий, долоо хоногт 1 */
export function awardLeagueTop3(
  ledger: BonusLedger,
  weekKey: string,
  finalRank: number
): { awarded: boolean; ledger: BonusLedger } {
  if (finalRank < 1 || finalRank > 3) return { awarded: false, ledger };
  const weeks = ledger.leagueTop3AwardedWeeks ?? [];
  if (weeks.includes(weekKey)) return { awarded: false, ledger };
  return {
    awarded: true,
    ledger: { ...ledger, leagueTop3AwardedWeeks: [...weeks, weekKey] },
  };
}

/** Найз урьсан бонус: +300, сард 5 */
export const INVITE_MONTHLY_LIMIT = 5;

export function awardInvite(
  ledger: BonusLedger,
  monthKey: string // YYYY-MM
): { awarded: boolean; ledger: BonusLedger } {
  const current = ledger.invitesThisMonth;
  if (current && current.monthKey === monthKey && current.count >= INVITE_MONTHLY_LIMIT) {
    return { awarded: false, ledger };
  }
  const next =
    current && current.monthKey === monthKey
      ? { monthKey, count: current.count + 1 }
      : { monthKey, count: 1 };
  return { awarded: true, ledger: { ...ledger, invitesThisMonth: next } };
}