/**
 * Агуулгын импорт — БОДИТ Postgres (PGlite) дээр
 *
 *   seed-ийн түлхүүргүй мөрийг өөртөө авах → идемпотент → засвар →
 *   🔴 өдрийн тавд гарсан асуултын хариултыг хамгаалах → нөөц
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, isNull } from 'drizzle-orm';
import { dailySets, eras, questions } from '../src/schema';
import { seedAll } from '../src/seed/run';
import { contentRunway, importQuestions } from '../src/content/importer';
import { readQuestionCsv, type ContentQuestion } from '../src/content/questions';
import { createTestDb, type TestDb } from './helpers/testDb';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_CSV = path.resolve(here, '../../../content/questions.csv');

let db: TestDb;
let close: () => Promise<void>;
let bank: ContentQuestion[];

beforeAll(async () => {
  const t = await createTestDb();
  db = t.db;
  close = t.close;
  await seedAll(db);
  bank = readQuestionCsv(fs.readFileSync(REPO_CSV, 'utf8')).questions;
}, 60_000);

afterAll(async () => {
  await close?.();
});

const byKey = async (key: string) =>
  (await db.select().from(questions).where(eq(questions.contentKey, key)).limit(1))[0];

describe('Анхны импорт — seed-ээр орсон ӨС', () => {
  it('dry-run юу ч бичихгүй', async () => {
    const report = await importQuestions(db, bank, { dryRun: true });
    expect(report.adopted).toHaveLength(21);
    expect(await db.select().from(questions).where(isNull(questions.contentKey))).toHaveLength(21);
  });

  it('seed-ийн 21 мөрийг ДАВХАРДУУЛАХГҮЙ, түлхүүртэй болгоно', async () => {
    const report = await importQuestions(db, bank);
    expect(report.inserted).toEqual([]);
    expect(report.adopted).toHaveLength(21);
    const rows = await db.select().from(questions);
    expect(rows).toHaveLength(21);
    expect(rows.every((r) => r.contentKey)).toBe(true);
    expect((await byKey('Q-0001'))?.reviewedBy).toContain('ХЯНАГДААГҮЙ');
  });

  it('🔴 дахин ажиллуулахад юу ч өөрчлөгдөхгүй (идемпотент)', async () => {
    const report = await importQuestions(db, bank);
    expect(report).toMatchObject({ applied: true, inserted: [], updated: [], adopted: [], blocked: [], unchanged: 21 });
  });
});

describe('Засвар ба нэмэлт', () => {
  it('шинэ асуулт нэмэгдэнэ, шинэ эрин ӨС-д автоматаар үүснэ', async () => {
    const fresh: ContentQuestion = {
      ...bank[0]!,
      key: 'Q-1001',
      eraKey: 'modern',
      body: '1990 оны ардчилсан хувьсгалын өлсгөлөн зарласан газар аль вэ?',
      options: ['Сүхбаатарын талбай', 'Зайсан', 'Гандан', 'Их тойруу'],
      correctIndex: 0,
      status: 'draft',
      reviewedBy: null,
    };
    const report = await importQuestions(db, [...bank, fresh]);
    expect(report.inserted).toEqual(['Q-1001']);
    const row = await byKey('Q-1001');
    const [era] = await db.select().from(eras).where(eq(eras.id, row!.eraId));
    expect(era?.name).toBe('Ардчилсан Монгол');
    expect(row?.status).toBe('draft');
  });

  it('тайлбар засахад тэр мөр л шинэчлэгдэнэ', async () => {
    const edited = bank.map((q) => (q.key === 'Q-0002' ? { ...q, explanation: q.explanation + ' (засвар)' } : q));
    const report = await importQuestions(db, edited);
    expect(report.updated).toEqual(['Q-0002']);
    expect((await byKey('Q-0002'))?.explanation).toContain('(засвар)');
  });

  it('CSV-ээс хасагдсан асуултыг УСТГАХГҮЙ, зөвхөн мэдээлнэ', async () => {
    const report = await importQuestions(db, bank.filter((q) => q.key !== 'Q-0021'));
    expect(report.missingFromCsv).toContain('Q-0021');
    expect(await byKey('Q-0021')).toBeDefined();
  });

  it('нийтлэлээс хасах — draft болгоно', async () => {
    const report = await importQuestions(db, bank.map((q) => (q.key === 'Q-0021' ? { ...q, status: 'draft' as const } : q)));
    expect(report.updated).toContain('Q-0021');
    expect((await byKey('Q-0021'))?.status).toBe('draft');
  });
});

describe('🔴 Өдрийн тавд гарсан асуултын хариултыг хамгаална', () => {
  it('гарсан асуултын зөв хариултыг өөрчлөхийг ХААЖ, БҮХ импортыг буцаана', async () => {
    const served = await byKey('Q-0003');
    await db.insert(dailySets).values({ dayKey: '2026-10-20', questionIds: [served!.id] });

    const changed = bank.map((q) => {
      if (q.key === 'Q-0003') return { ...q, correctIndex: (q.correctIndex + 1) % 4 };
      if (q.key === 'Q-0004') return { ...q, explanation: q.explanation + ' Хамт ирсэн засвар.' };
      return q;
    });
    const report = await importQuestions(db, changed);
    expect(report.applied).toBe(false);
    expect(report.blocked.map((b) => b.key)).toEqual(['Q-0003']);
    expect((await byKey('Q-0003'))?.correctIndex).toBe(served!.correctIndex);
    // Хамт ирсэн бусад засвар ч бичигдээгүй — хагас төлөв үлдэхгүй
    expect((await byKey('Q-0004'))?.explanation).not.toContain('Хамт ирсэн засвар');
  });

  it('гарсан асуултын текст, тайлбарын засварыг зөвшөөрнө', async () => {
    const edited = bank.map((q) => (q.key === 'Q-0003' ? { ...q, explanation: q.explanation + ' Нэмэлт.' } : q));
    const report = await importQuestions(db, edited);
    expect(report.blocked).toEqual([]);
    expect(report.updated).toContain('Q-0003');
  });

  it('түүхч алдааг баталсан бол --allow-answer-change', async () => {
    const before = await byKey('Q-0003');
    const changed = bank.map((q) => (q.key === 'Q-0003' ? { ...q, correctIndex: (q.correctIndex + 1) % 4 } : q));
    const report = await importQuestions(db, changed, { allowAnswerChange: true });
    expect(report.blocked).toEqual([]);
    expect((await byKey('Q-0003'))?.correctIndex).not.toBe(before!.correctIndex);
  });

  it('CSV-г ӨС-тэй тааруулбал дахин хэвийн импортлогдоно', async () => {
    const current = await byKey('Q-0003');
    const synced = bank.map((q) => (q.key === 'Q-0003' ? { ...q, correctIndex: current!.correctIndex } : q));
    const report = await importQuestions(db, synced);
    expect(report.applied).toBe(true);
    expect(report.blocked).toEqual([]);
  });
});

describe('Нөөц (runway)', () => {
  it('нийтлэгдсэн, гараагүй асуултыг хүндрэлээр тоолно', async () => {
    const runway = await contentRunway(db);
    const published = await db.select().from(questions).where(eq(questions.status, 'published'));
    expect(runway.published.easy + runway.published.medium + runway.published.hard).toBe(published.length);
    // Q-0003 өдрийн багцад орсон тул «шинэ»-д тооцогдохгүй
    const total = runway.unused.easy + runway.unused.medium + runway.unused.hard;
    expect(total).toBe(published.length - 1);
    expect(runway.unreviewedPublished).toBe(published.length);
  });
});
