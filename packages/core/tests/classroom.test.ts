/**
 * Ангийн лиг ба хамтын зорилтын тест (ROADMAP B4)
 */
import { describe, expect, it } from 'vitest';
import {
  classGoalProgress,
  CLASSROOM_CODE_LENGTH,
  DEFAULT_CLASS_GOAL,
  generateClassroomCode,
  isValidClassroomCode,
  normalizeClassroomCode,
  rankClassMembers,
} from '../src/classroom';

describe('Ангийн код', () => {
  it('үүсгэсэн код үргэлж хүчинтэй', () => {
    for (let i = 0; i < 200; i++) {
      expect(isValidClassroomCode(generateClassroomCode())).toBe(true);
    }
  });

  it('өгсөн random функцээр детерминист', () => {
    const fixed = () => 0;
    expect(generateClassroomCode(fixed)).toBe('A'.repeat(CLASSROOM_CODE_LENGTH));
  });

  it('зай, зураас, жижиг үсгийг цэвэрлэнэ', () => {
    expect(normalizeClassroomCode(' ab c-de f ')).toBe('ABCDEF');
  });

  it('уртаас хэтэрсэн хэсгийг таслана', () => {
    expect(normalizeClassroomCode('ABCDEFGHIJ')).toHaveLength(CLASSROOM_CODE_LENGTH);
  });

  it('🔴 андуурч болох тэмдэгтийг ТААХГҮЙ — буруу код чимээгүй үүсэхгүй', () => {
    // I, O, 0, 1 нь цагаан толгойд байхгүй. Эдгээрийг өөр үсэг рүү
    // хөрвүүлбэл хэрэглэгч буруу ангид нэгдэж болзошгүй.
    const normalized = normalizeClassroomCode('OO0011');
    expect(isValidClassroomCode(normalized)).toBe(false);
  });

  it('богино кодыг татгалзана', () => {
    expect(isValidClassroomCode('ABC')).toBe(false);
  });
});

describe('Хамтын зорилт', () => {
  it('эхлээгүй үед 0 хувь', () => {
    const p = classGoalProgress(0, DEFAULT_CLASS_GOAL);
    expect(p.percent).toBe(0);
    expect(p.reached).toBe(false);
  });

  it('зорилгод хүрсэн эсэхийг зөв тогтооно', () => {
    expect(classGoalProgress(1000, 1000).reached).toBe(true);
    expect(classGoalProgress(999, 1000).reached).toBe(false);
  });

  it('хэтэрсэн ч 100 хувиас давахгүй', () => {
    const p = classGoalProgress(5000, 1000);
    expect(p.percent).toBe(100);
    expect(p.ratio).toBe(1);
  });

  it('сөрөг утгыг аюулгүй боловсруулна', () => {
    expect(classGoalProgress(-10, 1000).ratio).toBe(0);
  });

  it('зорилт 0 байхад хуваахгүй', () => {
    const p = classGoalProgress(5, 0);
    expect(Number.isFinite(p.ratio)).toBe(true);
    expect(p.target).toBe(1);
  });

  it('🔴 мессеж хэн нэгнийг буруутгахгүй — хамтын хэлбэртэй', () => {
    for (const cur of [0, 100, 500, 800, 1000]) {
      const msg = classGoalProgress(cur, 1000).message;
      expect(msg).not.toMatch(/чи |та бол|хоцор|удаа/i);
      expect(msg.length).toBeGreaterThan(10);
    }
  });
});

describe('Ангийн чансаа', () => {
  const members = [
    { userId: 3, weeklyXp: 50 },
    { userId: 1, weeklyXp: 120 },
    { userId: 2, weeklyXp: 120 },
    { userId: 4, weeklyXp: 0 },
  ];

  it('🔴 БҮХ гишүүн жагсаалтад үлдэнэ — хэн ч алга болохгүй', () => {
    expect(rankClassMembers(members)).toHaveLength(members.length);
  });

  it('оноогоор буурахаар эрэмбэлнэ', () => {
    const r = rankClassMembers(members);
    expect(r[0]!.weeklyXp).toBe(120);
    expect(r[r.length - 1]!.weeklyXp).toBe(0);
  });

  it('ижил оноотой бол ижил байр', () => {
    const r = rankClassMembers(members);
    expect(r[0]!.rank).toBe(1);
    expect(r[1]!.rank).toBe(1);
    expect(r[2]!.rank).toBe(3);
  });

  it('тэнцсэн үед ID-аар тогтвортой эрэмбэлнэ', () => {
    const r = rankClassMembers(members);
    expect(r[0]!.userId).toBe(1);
    expect(r[1]!.userId).toBe(2);
  });

  it('хоосон ангид алдаа гарахгүй', () => {
    expect(rankClassMembers([])).toEqual([]);
  });
});
