/**
 * Агуулгын хүснэгт — CSV задлагч ба шалгагч (ӨС-гүй, цэвэр функц)
 *
 * Түүхч Google Sheets-ээс татсан CSV-д гардаг бодит тохиолдлууд:
 * таслалтай/хашилттай/олон мөртэй нүд, BOM, CRLF, монгол утга.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { shouldShuffleOptions } from '@nomad/core';
import { parseCsv, toCsv } from '../src/content/csv';
import {
  CONTENT_COLUMNS,
  DAILY_NEED,
  freshDays,
  MYTH_OPTIONS,
  normalizeBody,
  readQuestionCsv,
} from '../src/content/questions';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_CSV = path.resolve(here, '../../../content/questions.csv');

const HEADER = CONTENT_COLUMNS.join(',');

type Cells = Partial<Record<(typeof CONTENT_COLUMNS)[number], string>>;

const VALID: Cells = {
  key: 'Q-9001',
  format: 'classic',
  era: 'mongol',
  difficulty: 'medium',
  question: 'Их Монгол Улс хэдэн онд байгуулагдсан бэ?',
  option_a: '1206',
  option_b: '1189',
  option_c: '1227',
  option_d: '1260',
  correct: 'A',
  explanation: '1206 онд Онон голын эхэнд хурилдай хуралдаж Тэмүжинийг Чингис хаан хэмээн өргөмжилсөн.',
  source: 'Монголын нууц товчоо, §202',
  status: 'published',
  reviewer: 'Д. Түүхч',
};

function csv(...rows: Cells[]): string {
  return toCsv([[...CONTENT_COLUMNS], ...rows.map((r) => CONTENT_COLUMNS.map((c) => r[c] ?? ''))]);
}

describe('parseCsv — Google Sheets-ийн экспорт', () => {
  it('хашилттай таслал, давхар хашилт, олон мөртэй нүд', () => {
    const rows = parseCsv('a,b,c\n"x, y","say ""hi""","line1\nline2"\n');
    expect(rows.map((r) => r.cells)).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'say "hi"', 'line1\nline2'],
    ]);
  });

  it('BOM, CRLF, хоосон мөр, мөрийн дугаар', () => {
    const rows = parseCsv('﻿a,b\r\n\r\n"1\r\n2",3\r\nx,y');
    expect(rows.map((r) => r.cells)).toEqual([
      ['a', 'b'],
      ['1\n2', '3'],
      ['x', 'y'],
    ]);
    // Олон мөртэй нүдний дараах бичлэг зөв мөрөөс эхэлнэ
    expect(rows.map((r) => r.line)).toEqual([1, 3, 5]);
  });

  it('хаагдаагүй хашилт → мөрийн дугаартай алдаа', () => {
    const result = readQuestionCsv(`${HEADER}\nQ-1,"classic`);
    expect(result.errors[0]?.message).toContain('Хашилт');
    expect(result.errors[0]?.line).toBe(2);
  });

  it('toCsv → parseCsv буцаад ижил', () => {
    const data = [['a', 'b,c'], ['"q"', 'x\ny'], [' lead', 'тайлбар']];
    expect(parseCsv(toCsv(data)).map((r) => r.cells)).toEqual(data);
  });
});

describe('readQuestionCsv — зөв мөр', () => {
  it('хүчинтэй асуулт', () => {
    const { questions, errors } = readQuestionCsv(csv(VALID));
    expect(errors).toEqual([]);
    expect(questions[0]).toMatchObject({
      key: 'Q-9001',
      format: 'classic',
      eraKey: 'mongol',
      difficulty: 'medium',
      correctIndex: 0,
      status: 'published',
      reviewedBy: 'Д. Түүхч',
      line: 2,
    });
  });

  it('монгол утга: «дунд», «нийтэлсэн», кирилл «В», эриний нэр', () => {
    const { questions, errors } = readQuestionCsv(
      csv({ ...VALID, difficulty: 'Дунд', status: 'нийтэлсэн', correct: 'В', era: 'Их Монгол Улс' })
    );
    expect(errors).toEqual([]);
    expect(questions[0]).toMatchObject({ difficulty: 'medium', status: 'published', correctIndex: 2, eraKey: 'mongol' });
  });

  it('баганын дараалал хамаагүй, нэмэлт багана анхааруулга', () => {
    const cols = [...CONTENT_COLUMNS].reverse();
    const text = toCsv([[...cols, 'тэмдэглэл'], [...cols.map((c) => VALID[c] ?? ''), 'дотоод']]);
    const { questions, errors, warnings } = readQuestionCsv(text);
    expect(errors).toEqual([]);
    expect(questions).toHaveLength(1);
    expect(warnings[0]?.message).toContain('тэмдэглэл');
  });

  it('«Үнэн үү, домог уу?» — сонголт хоосон бол автоматаар, холихгүй', () => {
    const { questions, errors } = readQuestionCsv(
      csv({
        ...VALID,
        format: 'myth_or_fact',
        question: 'Чингис хаан цэнхэр нүдтэй байсан гэж нууц товчоонд бичсэн.',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct: 'B',
      })
    );
    expect(errors).toEqual([]);
    expect(questions[0]?.options).toEqual([...MYTH_OPTIONS]);
    expect(shouldShuffleOptions('myth_or_fact')).toBe(false);
  });
});

describe('readQuestionCsv — алдаа', () => {
  const errorFor = (patch: Cells) => readQuestionCsv(csv({ ...VALID, ...patch })).errors;

  it.each([
    ['эх сурвалжгүй', { source: '' }, 'source'],
    ['тайлбаргүй', { explanation: 'Зөв.' }, 'explanation'],
    ['сонголт дутуу', { option_d: '' }, 'option_d'],
    ['давхардсан сонголт', { option_b: '1206' }, 'option_a'],
    ['буруу эрин', { era: 'atlantis' }, 'era'],
    ['буруу хүндрэл', { difficulty: 'маш хүнд' }, 'difficulty'],
    ['буруу хэлбэр', { format: 'puzzle' }, 'format'],
    ['буруу зөв хариулт', { correct: 'E' }, 'correct'],
    ['түүхчгүй нийтлэл', { reviewer: '' }, 'reviewer'],
    ['түлхүүрт кирилл', { key: 'Асуулт-1' }, 'key'],
    ['хэт урт асуулт', { question: 'ы'.repeat(300) }, 'question'],
  ])('%s', (_name, patch, column) => {
    const errs = errorFor(patch as Cells);
    expect(errs.map((e) => e.column)).toContain(column);
    expect(errs[0]?.line).toBe(2);
  });

  it('🔴 «Дээрх бүгд» — сонголт холигддог тул хориглоно', () => {
    expect(errorFor({ option_d: 'Дээрх бүгд' }).map((e) => e.column)).toContain('option_d');
  });

  it('ноорог асуулт түүхчгүй байж болно', () => {
    expect(errorFor({ status: 'draft', reviewer: '' })).toEqual([]);
  });

  it('үнэн/домог асуултад өөр сонголт, C хариулт', () => {
    const errs = errorFor({ format: 'myth_or_fact', option_a: 'Тийм', option_b: 'Үгүй', option_c: '', option_d: '', correct: 'A' });
    expect(errs.map((e) => e.column)).toContain('option_a');
    const errs2 = errorFor({ format: 'myth_or_fact', option_a: '', option_b: '', option_c: '', option_d: '', correct: 'C' });
    expect(errs2.map((e) => e.column)).toContain('correct');
  });

  it('давхардсан түлхүүр ба ижил асуулт (цэг таслал, том үсэг өөр ч)', () => {
    const { errors } = readQuestionCsv(
      csv(VALID, { ...VALID, question: 'их монгол улс хэдэн онд байгуулагдсан бэ' })
    );
    expect(errors.map((e) => e.column)).toEqual(expect.arrayContaining(['key', 'question']));
    expect(errors.every((e) => e.line === 3)).toBe(true);
  });

  it('гарчгийн багана дутуу → тодорхой заавар', () => {
    const { errors } = readQuestionCsv('key,question\nQ-1,Асуулт?');
    expect(errors[0]?.message).toContain('option_a');
  });

  it('Sheets-ийн хоосон сүүлийн мөрүүдийг алгасна', () => {
    const text = csv(VALID) + ',,,,,,,,,,,,,\n,,,,,,,,,,,,,\n';
    const { questions, errors } = readQuestionCsv(text);
    expect(errors).toEqual([]);
    expect(questions).toHaveLength(1);
  });
});

describe('Чанарын анхааруулга', () => {
  it('зөв хариулт бусдаасаа хамаагүй урт → «уншилгүй таана»', () => {
    const { warnings, errors } = readQuestionCsv(
      csv({ ...VALID, option_a: 'Онон голын эхэнд болсон их хуралдайгаар 1206 онд' })
    );
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.column === 'correct')).toBe(true);
  });

  it('хянуулаагүй нийтлэл — НЭГ хураангуй мөр', () => {
    const text = csv(
      { ...VALID, key: 'Q-1', reviewer: 'ХЯНАГДААГҮЙ — Phase 0' },
      { ...VALID, key: 'Q-2', question: 'Өөр асуулт энд байна уу?', reviewer: 'ХЯНАГДААГҮЙ — Phase 0' }
    );
    const { warnings } = readQuestionCsv(text);
    const unreviewed = warnings.filter((w) => w.column === 'reviewer');
    expect(unreviewed).toHaveLength(1);
    expect(unreviewed[0]?.message).toContain('2 нийтлэгдсэн');
  });
});

describe('Нөөцийн тооцоо', () => {
  it('өдөрт 2 амархан + 2 дунд + 1 хүнд (core-ийн төлөвлөгөөнөөс)', () => {
    expect(DAILY_NEED).toEqual({ easy: 2, medium: 2, hard: 1 });
  });

  it('хамгийн түрүүнд дуусах хүндрэл нөөцийг тодорхойлно', () => {
    expect(freshDays({ easy: 60, medium: 60, hard: 30 })).toBe(30);
    expect(freshDays({ easy: 60, medium: 60, hard: 4 })).toBe(4);
    expect(freshDays({ easy: 3, medium: 60, hard: 30 })).toBe(1);
  });

  it('normalizeBody — цэг таслал, том жижиг үсэг, зай', () => {
    expect(normalizeBody('«Их Засаг» гэж юу вэ?')).toBe(normalizeBody('их засаг  гэж юу вэ'));
  });
});

describe('🔴 Repo-ийн content/questions.csv (CI)', () => {
  const result = readQuestionCsv(fs.readFileSync(REPO_CSV, 'utf8'));

  it('алдаагүй', () => {
    expect(result.errors).toEqual([]);
  });

  it('нийтлэгдсэн асуулт өдрийн тавыг дүүргэхэд хүрэлцэнэ', () => {
    const published = result.questions.filter((q) => q.status === 'published');
    for (const [d, need] of Object.entries(DAILY_NEED)) {
      expect(published.filter((q) => q.difficulty === d).length).toBeGreaterThanOrEqual(need);
    }
  });
});
