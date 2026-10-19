/**
 * Нийгмийн давхарга — код, найзын бүлгийн чансаа, цол, хуваалцах текст
 */
import { describe, expect, it } from 'vitest';
import {
  CODE_ALPHABET,
  formatRecoveryCode,
  generateGroupCode,
  generateShareCode,
  isValidGroupCode,
  isValidRecoveryCode,
  isValidShareCode,
  normalizeGroupCode,
  normalizeRecoveryCode,
} from '../src/codes';
import { isValidGroupName, rankWeek } from '../src/groups';
import { titleFor, TITLE_TIERS } from '../src/titles';
import { buildShareText, duelMessage, shareMarks } from '../src/share';
import { QUESTION_FORMAT_LABEL, QUESTION_FORMATS, shouldShuffleOptions } from '../src/question';

describe('Кодууд', () => {
  it('андуурагдах тэмдэгт (I, O, 0, 1) цагаан толгойд байхгүй', () => {
    for (const ch of 'IO01') expect(CODE_ALPHABET.includes(ch)).toBe(false);
  });

  it('үүсгэсэн код үргэлж хүчинтэй', () => {
    for (let i = 0; i < 200; i++) {
      expect(isValidShareCode(generateShareCode())).toBe(true);
      expect(isValidGroupCode(generateGroupCode())).toBe(true);
    }
  });

  it('хэрэглэгчийн бичлэгийг хэвийн болгоно, гэхдээ тэмдэгт ТААХГҮЙ', () => {
    expect(normalizeGroupCode(' ab-c2 34 ')).toBe('ABC234');
    expect(isValidGroupCode(normalizeGroupCode('ABCO23'))).toBe(false);
  });

  it('сэргээх код — 5×5 бүлэглэлт, буцаан задлалт', () => {
    const raw = 'ABCDEFGHJKLMNPQRSTUVWXYZ2';
    const pretty = formatRecoveryCode(raw);
    expect(pretty).toBe('ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ2');
    expect(normalizeRecoveryCode(pretty.toLowerCase())).toBe(raw);
    expect(isValidRecoveryCode(raw)).toBe(true);
    expect(isValidRecoveryCode(raw.slice(1))).toBe(false);
  });
});

describe('Найзын бүлэг', () => {
  it('нэрийн дүрэм', () => {
    expect(isValidGroupName('ШУТИС 3-р курс')).toBe(true);
    expect(isValidGroupName(' ')).toBe(false);
    expect(isValidGroupName('—')).toBe(false);
  });

  it('долоо хоногийн чансаа: зөв → өдөр → хугацаа, тэнцвэл ижил байр', () => {
    const ranked = rankWeek([
      { userId: 1, correct: 12, daysPlayed: 3, totalMs: 90_000 },
      { userId: 2, correct: 15, daysPlayed: 4, totalMs: 120_000 },
      { userId: 3, correct: 12, daysPlayed: 3, totalMs: 60_000 },
      { userId: 4, correct: 0, daysPlayed: 0, totalMs: 0 },
    ]);
    expect(ranked.map((r) => r.userId)).toEqual([2, 3, 1, 4]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });
});

describe('Цол', () => {
  it('босгоор ахина', () => {
    expect(titleFor(0).tier.key).toBe('daichin');
    expect(titleFor(10).tier.key).toBe('arav');
    expect(titleFor(199).tier.key).toBe('zuu');
    expect(titleFor(5000).tier.key).toBe('tumen');
  });

  it('явц ба үлдэгдэл', () => {
    const t = titleFor(30);
    expect(t.next?.key).toBe('zuu');
    expect(t.remaining).toBe(20);
    expect(t.progress).toBeCloseTo(0.5);
    expect(titleFor(600)).toMatchObject({ next: null, progress: 1, remaining: 0 });
  });

  it('босго өсөх дараалалтай', () => {
    const mins = TITLE_TIERS.map((t) => t.minCorrect);
    expect(mins).toEqual([...mins].sort((a, b) => a - b));
  });
});

describe('Хуваалцах текст — спойлергүй', () => {
  it('тэмдэгт зөв/бурууг л харуулна', () => {
    expect(shareMarks([true, true, false, true, true])).toBe('■■□■■');
  });

  it('асуултын агуулга ороогүй, линктэй', () => {
    const text = buildShareText({
      dayNumber: 14,
      correct: 4,
      total: 5,
      totalMs: 38_000,
      marks: [true, true, false, true, true],
      url: 'https://ertniiov.mn/c/ABCD2345',
    });
    expect(text).toBe(
      'Эртний Өв · Өдрийн тав #14\n■■□■■ 4/5 · 38 сек\nЧи надаас илүү мэдэх үү? https://ertniiov.mn/c/ABCD2345'
    );
  });
});

describe('Тулааны мессеж', () => {
  it('ялалт — гарах тийн ялгалтай', () => {
    expect(duelMessage({ correct: 4, totalMs: 40_000 }, { correct: 3, totalMs: 30_000 }, 'Бат')).toEqual({
      outcome: 'win',
      headline: 'Чи түрүүллээ!',
      detail: 'Чи Батаас 1 оноогоор түрүүллээ.',
    });
  });

  it('хугацаагаар ялалт', () => {
    expect(duelMessage({ correct: 4, totalMs: 30_000 }, { correct: 4, totalMs: 36_000 }, 'Болд').detail).toBe(
      'Оноо тэнцүү, гэхдээ чи Болдоос 6 секундээр хурдан байлаа.'
    );
  });

  it('ялагдал — нэр нь өгүүлэгч', () => {
    expect(duelMessage({ correct: 2, totalMs: 30_000 }, { correct: 4, totalMs: 30_000 }, 'Цэцэг').detail).toBe(
      'Цэцэг чамаас 2 оноогоор түрүүллээ.'
    );
  });

  it('латин нэрт залгавар шаардахгүй өгүүлбэр', () => {
    expect(duelMessage({ correct: 5, totalMs: 30_000 }, { correct: 3, totalMs: 30_000 }, 'Bat').detail).toBe(
      'Чи 2 оноогоор түрүүллээ — Bat: 3, чи: 5.'
    );
  });

  it('тэнцээ', () => {
    expect(duelMessage({ correct: 3, totalMs: 30_000 }, { correct: 3, totalMs: 30_300 }, 'Бат').outcome).toBe('tie');
  });
});

describe('Асуултын хэлбэр', () => {
  it('хэлбэр бүр шошготой', () => {
    for (const f of QUESTION_FORMATS) expect(QUESTION_FORMAT_LABEL[f].length).toBeGreaterThan(0);
  });

  it('«Үнэн үү, домог уу?»-ийн сонголтыг холихгүй', () => {
    expect(shouldShuffleOptions('myth_or_fact')).toBe(false);
    expect(shouldShuffleOptions('classic')).toBe(true);
  });
});
