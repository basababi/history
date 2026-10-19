/**
 * Монгол хэлний туслагч — нэрийн шалгалт, гарах тийн ялгал
 */
import { describe, expect, it } from 'vitest';
import { ablative, normalizeDisplayName, validateDisplayName } from '../src/mongolian';

describe('Гарах тийн ялгал — эгшиг зохицол', () => {
  it.each([
    ['Бат', 'Батаас'],
    ['Болд', 'Болдоос'],
    ['Батболд', 'Батболдоос'],
    ['Цэцэг', 'Цэцэгээс'],
    ['Төмөр', 'Төмөрөөс'],
    ['Сүх', 'Сүхээс'],
    ['Мөнхзул', 'Мөнхзулаас'],
    ['Оюун', 'Оюунаас'],
    ['Номин', 'Номиноос'],
    ['Тэмүүжин', 'Тэмүүжинээс'],
    ['Чингис', 'Чингисээс'],
    ['Хулан', 'Хуланаас'],
  ])('%s → %s (гийгүүлэгчээр төгссөн)', (name, expected) => {
    expect(ablative(name)).toBe(expected);
  });

  it.each([
    ['Ариунаа', 'Ариунаагаас'],
    ['Энхтуяа', 'Энхтуяагаас'],
    ['Сарнай', 'Сарнайгаас'],
    ['Өлзий', 'Өлзийгөөс'],
    ['Сүхээ', 'Сүхээгээс'],
  ])('%s → %s (урт эгшиг — «г» жийрэг)', (name, expected) => {
    expect(ablative(name)).toBe(expected);
  });

  it.each([
    ['Солонго', 'Солонгоос'],
    ['Бат-Эрдэнэ', 'Бат-Эрдэнээс'],
  ])('%s → %s (богино эгшиг уртсана)', (name, expected) => {
    expect(ablative(name)).toBe(expected);
  });

  it('латин эсвэл тодорхойгүй нэрт null — буруу залгахгүй', () => {
    expect(ablative('Bat')).toBeNull();
    expect(ablative('Bat2005')).toBeNull();
    expect(ablative('')).toBeNull();
  });
});

describe('Дэлгэцийн нэр', () => {
  it('зай шахаж, тайрна', () => {
    expect(normalizeDisplayName('  Бат   Эрдэнэ ')).toBe('Бат Эрдэнэ');
  });

  it('хэвийн нэрийг зөвшөөрнө', () => {
    expect(validateDisplayName('Бат-Эрдэнэ')).toEqual({ ok: true });
    expect(validateDisplayName('Saraa_07')).toEqual({ ok: true });
    expect(validateDisplayName('Өлзий')).toEqual({ ok: true });
  });

  it('урт, богино, тэмдэгтийн дүрэм', () => {
    expect(validateDisplayName('Б')).toEqual({ ok: false, error: 'too_short' });
    expect(validateDisplayName('Б'.repeat(25))).toEqual({ ok: false, error: 'too_long' });
    expect(validateDisplayName('Бат<script>')).toEqual({ ok: false, error: 'bad_chars' });
    expect(validateDisplayName('12345')).toEqual({ ok: false, error: 'no_letters' });
  });

  it('линк, и-мэйлийг хориглоно', () => {
    expect(validateDisplayName('www.spam.mn')).toEqual({ ok: false, error: 'link' });
    expect(validateDisplayName('bat@mail')).toEqual({ ok: false, error: 'link' });
  });
});
