/**
 * Босоо монгол бичгийн гүүрийн тест (ROADMAP C3)
 */
import { describe, expect, it } from 'vitest';
import {
  letterBridge,
  letterOfTheDay,
  SCRIPT_DISCLAIMER,
  SCRIPT_LETTERS,
} from '../src/script';

describe('SCRIPT_LETTERS', () => {
  it('кирилл үсэг давхардахгүй', () => {
    const set = new Set(SCRIPT_LETTERS.map((l) => l.cyrillic));
    expect(set.size).toBe(SCRIPT_LETTERS.length);
  });

  it('бүх бичлэг монгол Unicode блокт багтана (U+1820–U+1842)', () => {
    for (const l of SCRIPT_LETTERS) {
      const cp = l.mongol.codePointAt(0)!;
      expect(cp, `${l.cyrillic} → ${l.mongol}`).toBeGreaterThanOrEqual(0x1820);
      expect(cp, `${l.cyrillic} → ${l.mongol}`).toBeLessThanOrEqual(0x1842);
    }
  });

  it('үсэг бүр уншлага ба сануулгатай', () => {
    for (const l of SCRIPT_LETTERS) {
      expect(l.reading.length).toBeGreaterThan(0);
      expect(l.mnemonic.length).toBeGreaterThan(5);
    }
  });
});

describe('letterOfTheDay — детерминист', () => {
  it('ижил огноонд ижил үсэг', () => {
    expect(letterOfTheDay('2026-08-29')).toEqual(letterOfTheDay('2026-08-29'));
  });

  it('огноо солигдоход үсэг эргэлддэг', () => {
    const days = ['2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01'];
    const picked = new Set(days.map((d) => letterOfTheDay(d).cyrillic));
    expect(picked.size).toBeGreaterThan(1);
  });

  it('үргэлж жагсаалтын гишүүнийг буцаана', () => {
    for (let d = 1; d <= 28; d++) {
      const date = `2026-03-${String(d).padStart(2, '0')}`;
      expect(SCRIPT_LETTERS).toContain(letterOfTheDay(date));
    }
  });
});

describe('letterBridge', () => {
  it('таарсан үсгийг харгалзуулна', () => {
    const out = letterBridge('АН');
    expect(out).toHaveLength(2);
    expect(out[0]!.mongol).toBe('ᠠ');
    expect(out[1]!.mongol).toBe('ᠨ');
  });

  it('таарахгүй тэмдэгтэд null буцаана — чимээгүй алдахгүй', () => {
    const out = letterBridge('А1');
    expect(out[1]!.mongol).toBeNull();
  });

  it('жижиг үсгийг томоор нь харгалзуулна', () => {
    expect(letterBridge('а')[0]!.mongol).toBe('ᠠ');
  });
});

describe('Таних тэмдэг', () => {
  it('бүрэн хөрвүүлэлт биш гэдгийг ил хэлнэ', () => {
    expect(SCRIPT_DISCLAIMER).toContain('хэлбэр');
    expect(SCRIPT_DISCLAIMER.length).toBeGreaterThan(50);
  });
});
