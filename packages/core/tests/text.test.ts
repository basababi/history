import { describe, expect, it } from 'vitest';
import { isTextAnswerCorrect, levenshtein, normalizeMongolian } from '../src/text';

describe('normalizeMongolian (Бүлэг 5.4)', () => {
  it('ө→о, ү→у, ё→е хөрвүүлнэ', () => {
    expect(normalizeMongolian('Өв соёл')).toBe('ов соел');
    expect(normalizeMongolian('Үсэг')).toBe('усэг');
    expect(normalizeMongolian('Ёлка')).toBe('елка');
  });

  it('э/е зөрүүг normalize ЗАСАХГҮЙ — Levenshtein хүлцэл барина', () => {
    // Баримт бичиг зөвхөн ө/о, ү/у, ё/е-г normalize хийхийг заасан (Бүлэг 5.4).
    // «мэнд» vs «менд» ялгааг Levenshtein ≤ 1 дүрэм шийднэ — mentorChat-ийн
    // мэндчилгээний таних алдааны зөв засвар нь энэ (regex биш).
    expect(normalizeMongolian('мэнд')).not.toBe(normalizeMongolian('менд'));
    expect(isTextAnswerCorrect('мэнд', 'менд')).toBe(true);
  });

  it('том жижиг үсгийн ялгааг арилгана', () => {
    expect(normalizeMongolian('ЧИНГИС ХААН')).toBe('чингис хаан');
  });
});

describe('levenshtein', () => {
  it('ижил тэмдэгт = 0', () => {
    expect(levenshtein('хүннү', 'хүннү')).toBe(0);
  });

  it('нэг үсгийн зөрүү = 1', () => {
    expect(levenshtein('тэмүүжин', 'тэмүжин')).toBe(1);
  });

  it('бүрэн өөр тэмдэгт', () => {
    expect(levenshtein('abc', 'xyz')).toBe(3);
  });

  it('хоосон мөр', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });
});

describe('isTextAnswerCorrect — бичвэрийн хариултын хүлцэл (Бүлэг 5.4)', () => {
  it('ө/о, ү/у алдаатай зөв мэдсэн хариултыг зөв гэж тооцно', () => {
    // Зөв мэдсэн ч бичлэгийн алдаатай: «Тэмүужин» vs «Тэмүүжин»
    expect(isTextAnswerCorrect('Тэмүужин', 'Тэмүүжин')).toBe(true);
    // ө/о солигдсон
    expect(isTextAnswerCorrect('Хонгорум', 'Хонгорум')).toBe(true);
  });

  it('бүрэн буруу хариултыг буруу гэнэ', () => {
    expect(isTextAnswerCorrect('Сүхбаатар', 'Чингис хаан')).toBe(false);
  });

  it('tolerance тохируулж болно', () => {
    expect(isTextAnswerCorrect('abcd', 'abxy', 0)).toBe(false);
    expect(isTextAnswerCorrect('abcd', 'abxy', 2)).toBe(true);
  });
});