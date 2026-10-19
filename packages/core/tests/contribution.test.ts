/**
 * Ахмад үеийн дуу хоолойн дүрмийн тест (ROADMAP B3)
 *
 * Хамгийн чухал шалгуур: XP нь БАТАЛГААЖУУЛАЛТААС ХАМААРАХГҮЙ (Бүлэг 6.3).
 */
import { describe, expect, it } from 'vitest';
import {
  checkContribution,
  CONTRIBUTION_DAILY_LIMIT,
  CONTRIBUTION_LABEL,
  CONTRIBUTION_LIMITS,
  CONTRIBUTION_XP,
  contributionXp,
} from '../src/contribution';

const VALID = {
  kind: 'proverb' as const,
  body: 'Ухаантай хүн үгээ хэмнэнэ, ухаангүй хүн үгээ үрнэ.',
  elderLabel: 'Дорж өвөө',
  consentConfirmed: true,
  todayCount: 0,
};

describe('🔴 Зөвшөөрөл — ёс зүйн заавал шаардлага', () => {
  it('зөвшөөрөл баталгаажуулаагүй бол ХҮЛЭЭЖ АВАХГҮЙ', () => {
    const res = checkContribution({ ...VALID, consentConfirmed: false });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('NO_CONSENT');
  });

  it('зөвшөөрөлгүй үед XP олгохгүй', () => {
    const res = checkContribution({ ...VALID, consentConfirmed: false });
    expect(contributionXp(res)).toBe(0);
  });

  it('бусад бүх зүйл зөв ч зөвшөөрөлгүй бол таслана', () => {
    expect(
      checkContribution({ ...VALID, consentConfirmed: false }).reason
    ).toBe('NO_CONSENT');
  });
});

describe('Уртын шалгуур төрлөөс хамаарна', () => {
  it('зүйр үг богино байж болно', () => {
    expect(checkContribution(VALID).ok).toBe(true);
  });

  it('хэт богино зүйр үг таслагдана', () => {
    const res = checkContribution({ ...VALID, body: 'Богино' });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('TOO_SHORT');
  });

  it('домогт илүү урт шаардана', () => {
    const res = checkContribution({ ...VALID, kind: 'legend', body: VALID.body });
    expect(res.reason).toBe('TOO_SHORT');
  });

  it('хязгаараас хэтэрсэн бичвэр таслагдана', () => {
    const res = checkContribution({ ...VALID, body: 'а'.repeat(400) });
    expect(res.reason).toBe('TOO_LONG');
  });

  it('төрөл бүрд хязгаар ба нэр тодорхойлогдсон', () => {
    for (const kind of Object.keys(CONTRIBUTION_LIMITS) as Array<
      keyof typeof CONTRIBUTION_LIMITS
    >) {
      expect(CONTRIBUTION_LIMITS[kind].min).toBeLessThan(CONTRIBUTION_LIMITS[kind].max);
      expect(CONTRIBUTION_LABEL[kind].length).toBeGreaterThan(2);
    }
  });
});

describe('Ахмад хүний таних тэмдэг', () => {
  it('хоосон бол таслагдана', () => {
    expect(checkContribution({ ...VALID, elderLabel: ' ' }).reason).toBe(
      'NO_ELDER_LABEL'
    );
  });
});

describe('Өдрийн хязгаар', () => {
  it('хязгаарт хүрсэн бол хүлээж авахгүй', () => {
    const res = checkContribution({ ...VALID, todayCount: CONTRIBUTION_DAILY_LIMIT });
    expect(res.reason).toBe('DAILY_LIMIT');
  });

  it('хязгаараас доогуур бол зөвшөөрнө', () => {
    expect(
      checkContribution({ ...VALID, todayCount: CONTRIBUTION_DAILY_LIMIT - 1 }).ok
    ).toBe(true);
  });
});

describe('🔴 Бүлэг 6.3 — XP нь баталгаажуулалтаас ХАМААРАХГҮЙ', () => {
  it('хүлээн авсан хувь нэмэрт шууд XP олгоно', () => {
    expect(contributionXp(checkContribution(VALID))).toBe(CONTRIBUTION_XP);
  });

  it('contributionXp нь status параметр АВДАГГҮЙ — гарын үсгээр баталгаажина', () => {
    // Хэрэв ирээдүйд status нэмбэл энэ тест эвдэрч анхааруулна.
    expect(contributionXp).toHaveLength(1);
  });
});
