import { describe, expect, it } from 'vitest';
import {
  awardDailyChallenge,
  awardInvite,
  awardLeagueTop3,
  awardStreak7,
  computeAnswerXp,
  INVITE_MONTHLY_LIMIT,
  XP_RULES,
} from '../src/xp';

describe('computeAnswerXp', () => {
  it('амархан зөв хариулт +10', () => {
    const r = computeAnswerXp({ difficulty: 'easy', isCorrect: true, responseMs: 8000 });
    expect(r.xp).toBe(10);
    expect(r.timeBonusApplied).toBe(false);
  });

  it('дунд зөв +15, хүнд зөв +25', () => {
    expect(computeAnswerXp({ difficulty: 'medium', isCorrect: true, responseMs: 9000 }).xp).toBe(15);
    expect(computeAnswerXp({ difficulty: 'hard', isCorrect: true, responseMs: 9000 }).xp).toBe(25);
  });

  it('буруу хариулт 0 оноо', () => {
    const r = computeAnswerXp({ difficulty: 'hard', isCorrect: false, responseMs: 1000 });
    expect(r.xp).toBe(0);
    expect(r.timeBonusApplied).toBe(false);
  });

  it('хурдан бонус (<5 сек) ×1.5 — асуулт тус бүрийн served_at-аас хэмжигдсэн responseMs-ээр', () => {
    // 4999 мс → ×1.5
    expect(computeAnswerXp({ difficulty: 'easy', isCorrect: true, responseMs: 4999 }).xp).toBe(15);
    // 5000 мс → бонусгүй (хязгаар дотор биш)
    expect(computeAnswerXp({ difficulty: 'easy', isCorrect: true, responseMs: 5000 }).xp).toBe(10);
    // Сессийн эхлэлээс БИШ, асуултын served_at-аас тооцогдсон утга л ирнэ
    expect(computeAnswerXp({ difficulty: 'medium', isCorrect: true, responseMs: 3000 }).xp).toBe(
      Math.round(15 * 1.5)
    );
  });
});

describe('бонусын лимитүүд', () => {
  it('өдрийн сорил: +50, өдөрт 1 удаа', () => {
    let ledger = {};
    const first = awardDailyChallenge(ledger, '2026-08-25');
    expect(first.awarded).toBe(true);

    ledger = first.ledger;
    const second = awardDailyChallenge(ledger, '2026-08-25');
    expect(second.awarded).toBe(false); // ижил өдөр

    const nextDay = awardDailyChallenge(ledger, '2026-08-26');
    expect(nextDay.awarded).toBe(true);
  });

  it('streak 7: +200, долоо хоногт 1 удаа', () => {
    const ledger = {};
    const w35 = awardStreak7(ledger, '2026-W35');
    expect(w35.awarded).toBe(true);
    const again = awardStreak7(w35.ledger, '2026-W35');
    expect(again.awarded).toBe(false);
    const w36 = awardStreak7(w35.ledger, '2026-W36');
    expect(w36.awarded).toBe(true);
  });

  it('лигийн top-3: +500, зөвхөн 1–3 байр, долоо хоногт 1', () => {
    const ledger = {};
    expect(awardLeagueTop3(ledger, '2026-W35', 4).awarded).toBe(false);
    expect(awardLeagueTop3(ledger, '2026-W35', 0).awarded).toBe(false);
    const top1 = awardLeagueTop3(ledger, '2026-W35', 1);
    expect(top1.awarded).toBe(true);
    expect(awardLeagueTop3(top1.ledger, '2026-W35', 2).awarded).toBe(false);
  });

  it(`найз урьсан: +300, сард ${INVITE_MONTHLY_LIMIT}`, () => {
    let ledger = {};
    for (let i = 0; i < INVITE_MONTHLY_LIMIT; i++) {
      const r = awardInvite(ledger, '2026-08');
      expect(r.awarded).toBe(true);
      ledger = r.ledger;
    }
    expect(awardInvite(ledger, '2026-08').awarded).toBe(false);
    expect(awardInvite(ledger, '2026-09').awarded).toBe(true); // шинэ сар
  });

  it('XP_RULES баримт бичгийн тоотой таарна (Бүлэг 3.6)', () => {
    expect(XP_RULES.easyCorrect).toBe(10);
    expect(XP_RULES.mediumCorrect).toBe(15);
    expect(XP_RULES.hardCorrect).toBe(25);
    expect(XP_RULES.fastAnswerMultiplier).toBe(1.5);
    expect(XP_RULES.dailyChallengeBonus).toBe(50);
    expect(XP_RULES.streak7DaysBonus).toBe(200);
    expect(XP_RULES.leagueTop3Bonus).toBe(500);
    expect(XP_RULES.inviteFriendBonus).toBe(300);
  });
});