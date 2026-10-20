/**
 * Асуултын хүснэгтийн шалгагч — `content/questions.csv` (docs/CONTENT.md)
 *
 * Түүхч Google Sheets дээр бичээд CSV болгон татна. Энэ файл тэр CSV-г
 * ӨС-д орохоос ӨМНӨ шалгана: алдаа бүр мөрийн дугаар, баганын нэр, монгол
 * тайлбартай. Алдаа (error) байвал импорт ажиллахгүй; анхааруулга
 * (warning) нь чанарын зөвлөмж.
 *
 * ⚠ Цэвэр функц — ӨС, файл хөндөхгүй. CI-д ӨС-гүйгээр ажиллана.
 */
import { DAILY_DIFFICULTY_PLAN, type Difficulty, type QuestionFormat } from '@nomad/core';
import { ERA_SEED, type EraKey } from '../seed/eras';
import { CsvError, parseCsv } from './csv';

export const CONTENT_COLUMNS = [
  'key',
  'format',
  'era',
  'difficulty',
  'question',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct',
  'explanation',
  'source',
  'status',
  'reviewer',
] as const;
type Column = (typeof CONTENT_COLUMNS)[number];

export type ContentStatus = 'draft' | 'reviewed' | 'published';

/** «Үнэн үү, домог уу?»-ын тогтмол сонголтууд — холихгүй (core: shouldShuffleOptions) */
export const MYTH_OPTIONS = ['Үнэн', 'Домог'] as const;

/** Phase 0-ийн, түүхчээр хянуулаагүй асуултын тэмдэг */
export const UNREVIEWED_MARKER = 'ХЯНАГДААГҮЙ';

export interface ContentQuestion {
  line: number;
  key: string;
  format: QuestionFormat;
  eraKey: EraKey;
  difficulty: Difficulty;
  body: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceRef: string;
  status: ContentStatus;
  reviewedBy: string | null;
}

export interface ContentIssue {
  line: number;
  key: string | null;
  column: Column | null;
  message: string;
}

export interface ContentReadResult {
  questions: ContentQuestion[];
  errors: ContentIssue[];
  warnings: ContentIssue[];
}

// ─── Утгын толь — түүхч монголоор бичиж болно ───

const FORMAT_ALIASES: Record<string, QuestionFormat> = {
  classic: 'classic',
  'сонгодог': 'classic',
  myth_or_fact: 'myth_or_fact',
  'үнэн үү домог уу': 'myth_or_fact',
  'үнэн/домог': 'myth_or_fact',
  proverb: 'proverb',
  'зүйр үг': 'proverb',
  what_if: 'what_if',
  'хэрэв': 'what_if',
};

const DIFFICULTY_ALIASES: Record<string, Difficulty> = {
  easy: 'easy',
  'амархан': 'easy',
  medium: 'medium',
  'дунд': 'medium',
  hard: 'hard',
  'хүнд': 'hard',
};

const STATUS_ALIASES: Record<string, ContentStatus> = {
  draft: 'draft',
  'ноорог': 'draft',
  reviewed: 'reviewed',
  'хянасан': 'reviewed',
  published: 'published',
  'нийтэлсэн': 'published',
};

/** Латин A–D, кирилл А Б В Г (апп-д харагддаг), 1–4 */
const CORRECT_ALIASES: Record<string, number> = {
  a: 0, b: 1, c: 2, d: 3,
  'а': 0, 'б': 1, 'в': 2, 'г': 3,
  '1': 0, '2': 1, '3': 2, '4': 3,
};

const ERA_KEYS = new Set<string>(ERA_SEED.map((e) => e.key));
const ERA_BY_NAME = new Map<string, EraKey>(ERA_SEED.map((e) => [e.name.toLowerCase(), e.key]));

// ─── Хэмжээ — апп-ын дэлгэцэнд багтах ───

export const LIMITS = {
  keyPattern: /^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/,
  bodyMin: 10,
  bodyMax: 280,
  optionMax: 90,
  explanationMin: 20,
  explanationMax: 600,
  sourceMin: 6,
} as const;

/** Сонголт холигддог тул «дээрх бүгд» мэт байрлалаас хамаарсан сонголт буруу болно */
const POSITIONAL_OPTION = /(дээрх|доорх|бүгд нь|бүгд зөв|аль нь ч|аль аль нь)/i;

function clean(v: string | undefined): string {
  return (v ?? '').replace(/\u00a0/g, ' ').trim();
}

/** Давхардал илрүүлэх хэвийн хэлбэр — том жижиг үсэг, цэг таслал, зай хамаарахгүй */
export function normalizeBody(body: string): string {
  return body
    .toLowerCase()
    .replace(/[«»"'“”„.,!?;:()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function readQuestionCsv(text: string): ContentReadResult {
  const errors: ContentIssue[] = [];
  const warnings: ContentIssue[] = [];
  const questions: ContentQuestion[] = [];

  let rows;
  try {
    rows = parseCsv(text);
  } catch (err) {
    if (err instanceof CsvError) {
      return { questions, errors: [{ line: err.line, key: null, column: null, message: err.message }], warnings };
    }
    throw err;
  }

  const [header, ...body] = rows;
  if (!header) {
    return { questions, errors: [{ line: 1, key: null, column: null, message: 'Файл хоосон байна' }], warnings };
  }

  const index = new Map<string, number>();
  header.cells.forEach((name, i) => index.set(clean(name).toLowerCase(), i));
  const missing = CONTENT_COLUMNS.filter((c) => !index.has(c));
  if (missing.length > 0) {
    errors.push({
      line: header.line,
      key: null,
      column: null,
      message: `Гарчгийн мөрөнд багана дутуу: ${missing.join(', ')}. Загварыг docs/CONTENT.md-ээс хуулна уу.`,
    });
    return { questions, errors, warnings };
  }
  const extra = [...index.keys()].filter((c) => c !== '' && !(CONTENT_COLUMNS as readonly string[]).includes(c));
  if (extra.length > 0) {
    warnings.push({ line: header.line, key: null, column: null, message: `Танихгүй багана үл тооцогдоно: ${extra.join(', ')}` });
  }

  const seenKeys = new Map<string, number>();
  const seenBodies = new Map<string, string>();
  const unreviewed: ContentQuestion[] = [];

  for (const row of body) {
    const get = (c: Column) => clean(row.cells[index.get(c) ?? -1]);
    const key = get('key');
    const err = (column: Column | null, message: string) => errors.push({ line: row.line, key: key || null, column, message });
    const warn = (column: Column | null, message: string) => warnings.push({ line: row.line, key: key || null, column, message });
    const before = errors.length;

    // Бүхэлдээ хоосон мөр (Sheets-ийн сүүлийн мөрүүд)
    if (row.cells.every((c) => clean(c) === '')) continue;

    if (!key) err('key', 'Түлхүүр хоосон. Жишээ нь: Q-0042');
    else if (!LIMITS.keyPattern.test(key)) err('key', `«${key}» — зөвхөн латин үсэг, тоо, зураас (2–32 тэмдэгт)`);
    else if (seenKeys.has(key)) err('key', `«${key}» түлхүүр ${seenKeys.get(key)}-р мөрөнд давхардсан`);
    else seenKeys.set(key, row.line);

    const format = FORMAT_ALIASES[get('format').toLowerCase()];
    if (!format) err('format', `«${get('format')}» — classic, myth_or_fact, proverb, what_if-ийн аль нэг`);

    const eraRaw = get('era').toLowerCase();
    const eraKey = (ERA_KEYS.has(eraRaw) ? eraRaw : ERA_BY_NAME.get(eraRaw)) as EraKey | undefined;
    if (!eraKey) err('era', `«${get('era')}» эрин олдсонгүй. Боломжит: ${[...ERA_KEYS].join(', ')}`);

    const difficulty = DIFFICULTY_ALIASES[get('difficulty').toLowerCase()];
    if (!difficulty) err('difficulty', `«${get('difficulty')}» — easy (амархан), medium (дунд), hard (хүнд)`);

    const status = STATUS_ALIASES[get('status').toLowerCase()];
    if (!status) err('status', `«${get('status')}» — draft (ноорог), reviewed (хянасан), published (нийтэлсэн)`);

    const question = get('question');
    if (question.length < LIMITS.bodyMin) err('question', 'Асуулт хэт богино эсвэл хоосон');
    else if (question.length > LIMITS.bodyMax) {
      err('question', `Асуулт ${question.length} тэмдэгт — утасны дэлгэцэнд ${LIMITS.bodyMax}-аас ихгүй`);
    }

    // Сонголтууд
    let options = (['option_a', 'option_b', 'option_c', 'option_d'] as const).map((c) => get(c));
    if (format === 'myth_or_fact') {
      const [a, b, c, d] = options;
      if ((a && a !== MYTH_OPTIONS[0]) || (b && b !== MYTH_OPTIONS[1])) {
        err('option_a', `«Үнэн үү, домог уу?» асуултын сонголт заавал «${MYTH_OPTIONS[0]}», «${MYTH_OPTIONS[1]}» (хоосон орхиж болно)`);
      }
      if (c || d) err('option_c', '«Үнэн үү, домог уу?» асуулт 2 сонголттой — C, D хоосон байна');
      options = [...MYTH_OPTIONS];
    } else if (format) {
      options.forEach((o, i) => {
        const col = (['option_a', 'option_b', 'option_c', 'option_d'] as const)[i] ?? 'option_a';
        if (!o) err(col, 'Сонголт хоосон — 4 сонголт заавал');
        else if (o.length > LIMITS.optionMax) err(col, `Сонголт ${o.length} тэмдэгт — ${LIMITS.optionMax}-аас ихгүй`);
        else if (POSITIONAL_OPTION.test(o)) err(col, `«${o}» — сонголт холигддог тул «дээрх бүгд» мэт сонголт ажиллахгүй`);
      });
      const distinct = new Set(options.map((o) => o.toLowerCase()));
      if (options.every(Boolean) && distinct.size !== options.length) err('option_a', 'Давхардсан сонголт байна');
    }

    const correctIndex = CORRECT_ALIASES[get('correct').toLowerCase()];
    if (correctIndex === undefined) err('correct', `«${get('correct')}» — A, B, C, D (эсвэл А, Б, В, Г)`);
    else if (correctIndex >= options.length) err('correct', `Зөв хариулт ${get('correct')} — энэ асуулт ${options.length} сонголттой`);

    const explanation = get('explanation');
    if (explanation.length < LIMITS.explanationMin) err('explanation', 'Тайлбар хэт богино — яагаад зөв болохыг 1–2 өгүүлбэрээр');
    else if (explanation.length > LIMITS.explanationMax) err('explanation', `Тайлбар ${explanation.length} тэмдэгт — ${LIMITS.explanationMax}-аас ихгүй`);

    const source = get('source');
    if (source.length < LIMITS.sourceMin) err('source', 'Эх сурвалж ЗААВАЛ — ном, боть, хуудас эсвэл баримтын нэр');

    const reviewer = get('reviewer');
    if (status === 'published' && !reviewer) err('reviewer', 'Нийтлэх асуултыг баталсан түүхчийн нэр заавал');

    if (question.length >= LIMITS.bodyMin) {
      const norm = normalizeBody(question);
      const prior = seenBodies.get(norm);
      if (prior) err('question', `Ижил асуулт «${prior}» түлхүүрээр аль хэдийн байна`);
      else seenBodies.set(norm, key || `мөр ${row.line}`);
    }

    if (errors.length > before || !format || !eraKey || !difficulty || !status || correctIndex === undefined) continue;

    // ─── Чанарын анхааруулга ───
    if (format !== 'myth_or_fact') {
      const correct = options[correctIndex] ?? '';
      const longestOther = Math.max(...options.filter((_, i) => i !== correctIndex).map((o) => o.length));
      if (correct.length - longestOther >= 12 && correct.length > longestOther * 1.5) {
        warn('correct', 'Зөв хариулт бусдаасаа хамаагүй урт — тоглогч уншилгүй таана');
      }
    }

    const item: ContentQuestion = {
      line: row.line,
      key,
      format,
      eraKey,
      difficulty,
      body: question,
      options,
      correctIndex,
      explanation,
      sourceRef: source,
      status,
      reviewedBy: reviewer || null,
    };
    questions.push(item);
    if (status === 'published' && reviewer.toUpperCase().includes(UNREVIEWED_MARKER)) unreviewed.push(item);
  }

  // Мөр бүрээр давтвал чухал анхааруулгыг дарна — нэг хураангуй
  const [firstUnreviewed] = unreviewed;
  if (firstUnreviewed) {
    const keys = unreviewed.slice(0, 5).map((q) => q.key).join(', ');
    warnings.push({
      line: firstUnreviewed.line,
      key: null,
      column: 'reviewer',
      message: `${unreviewed.length} нийтлэгдсэн асуулт түүхчээр хянуулаагүй (${keys}${unreviewed.length > 5 ? ', …' : ''})`,
    });
  }

  return { questions, errors, warnings };
}

/** Өдөрт хүндрэл тус бүрээс хэдэн асуулт — core-ийн төлөвлөгөөнөөс (2 амархан, 2 дунд, 1 хүнд) */
export const DAILY_NEED: Record<Difficulty, number> = DAILY_DIFFICULTY_PLAN.reduce(
  (acc, d) => ({ ...acc, [d]: acc[d] + 1 }),
  { easy: 0, medium: 0, hard: 0 } as Record<Difficulty, number>
);

/** Хэдэн өдрийн ШИНЭ асуулт байна — аль нэг хүндрэл дуусахад давталт эхэлнэ */
export function freshDays(unused: Record<Difficulty, number>): number {
  const days = (Object.keys(DAILY_NEED) as Difficulty[])
    .filter((d) => DAILY_NEED[d] > 0)
    .map((d) => Math.floor(unused[d] / DAILY_NEED[d]));
  return Math.min(...days);
}
