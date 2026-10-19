/**
 * Seed-ийн integration тест — БОДИТ Postgres дээр (PGlite).
 * Идемпотент байдал, FK бүрэн бүтэн байдал, RAG корпусын холбоос шалгана.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  artifacts,
  eras,
  heroes,
  knowledgeChunks,
  questions,
} from '../src/schema';
import { seedAll, type SeedResult } from '../src/seed/run';
import { createTestDb, type TestDb } from './helpers/testDb';

let db: TestDb;
let close: () => Promise<void>;
let first: SeedResult;

beforeAll(async () => {
  const t = await createTestDb();
  db = t.db;
  close = t.close;
  first = await seedAll(db);
}, 60_000);

afterAll(async () => {
  await close?.();
});

describe('Seed бодит ӨС дээр ажиллана', () => {
  it('бүх төрлийн контент орсон', () => {
    expect(first.eras).toBe(3);
    expect(first.heroes).toBe(7);
    expect(first.artifacts).toBe(10);
    expect(first.questions).toBe(21);
    expect(first.knowledge).toBe(18);
    expect(first.gerItems).toBe(12);
    expect(first.stories).toBe(1);
  });

  it('нэг ч RAG chunk алгасагдаагүй — бүх баатар таарсан', () => {
    expect(first.skippedKnowledge).toEqual([]);
  });

  it('асуултууд published төлөвтэй, эх сурвалжтай', async () => {
    const rows = await db.select().from(questions);
    expect(rows).toHaveLength(21);
    for (const q of rows) {
      expect(q.status).toBe('published');
      expect(q.sourceRef.length).toBeGreaterThan(0);
      const opts = q.options as string[];
      expect(q.correctIndex).toBeLessThan(opts.length);
    }
  });

  it('tier бүрт баатартай — platinum багтана', async () => {
    for (const tier of ['bronze', 'silver', 'gold', 'platinum']) {
      const rows = await db.select().from(heroes).where(eq(heroes.rankTier, tier));
      expect(rows.length, `${tier} баатаргүй`).toBeGreaterThan(0);
    }
  });

  it('RAG chunk бүр баатартай холбогдсон (FK хүчинтэй)', async () => {
    const chunks = await db.select().from(knowledgeChunks);
    expect(chunks).toHaveLength(18);
    const heroRows = await db.select({ id: heroes.id }).from(heroes);
    const ids = new Set(heroRows.map((h) => h.id));
    for (const c of chunks) {
      expect(ids.has(c.personaHeroId)).toBe(true);
    }
  });

  it('баатар бүр дор хаяж нэг chunk-тай — «мэдэхгүй» гэж л хариулахгүй', async () => {
    const heroRows = await db.select().from(heroes);
    for (const h of heroRows) {
      const chunks = await db
        .select()
        .from(knowledgeChunks)
        .where(eq(knowledgeChunks.personaHeroId, h.id));
      expect(chunks.length, `${h.name}-д мэдлэг байхгүй`).toBeGreaterThan(0);
    }
  });

  it('Ану хатан өөрийн эриндээ багтана (он цагийн зөрчил засагдсан)', async () => {
    const [anu] = await db.select().from(heroes).where(eq(heroes.name, 'Ану хатан'));
    expect(anu).toBeDefined();
    const [era] = await db.select().from(eras).where(eq(eras.id, anu!.eraId));
    // 1696 он — эрин XVII зуунаас эхлэх ёстой
    expect(era!.startYear).toBe('XVII зуун');
  });

  it('алтан жишиг асуултууд тэмдэглэгдсэн (Бүлэг 6.3)', async () => {
    const golden = await db
      .select()
      .from(questions)
      .where(eq(questions.isGoldenStandard, true));
    expect(golden.length).toBe(3);
  });
});

describe('🔴 Идемпотент байдал — дахин ажиллуулахад давхардуулахгүй', () => {
  it('хоёр дахь удаа ажиллуулахад тоо өөрчлөгдөхгүй', async () => {
    const second = await seedAll(db);
    expect(second.eras).toBe(first.eras);
    expect(second.heroes).toBe(first.heroes);
    expect(second.questions).toBe(first.questions);
    expect(second.knowledge).toBe(first.knowledge);
  });

  it('ӨС дэх мөрийн тоо хэвээр', async () => {
    expect(await db.select().from(eras)).toHaveLength(3);
    expect(await db.select().from(heroes)).toHaveLength(7);
    expect(await db.select().from(artifacts)).toHaveLength(10);
    expect(await db.select().from(questions)).toHaveLength(21);
    expect(await db.select().from(knowledgeChunks)).toHaveLength(18);
  });

  it('гурав дахь удаа ч тогтвортой', async () => {
    await seedAll(db);
    expect(await db.select().from(questions)).toHaveLength(21);
  });
});

describe('Quiz-ийн асуулга бодитоор ажиллана', () => {
  it('published шүүлтүүр + эринээр татна (partial index ашиглана)', async () => {
    const [hunnu] = await db.select().from(eras).where(eq(eras.orderIndex, 1));
    const rows = await db
      .select()
      .from(questions)
      .where(
        and(eq(questions.status, 'published'), eq(questions.eraId, hunnu!.id))
      );
    expect(rows.length).toBe(6); // Хүннү 6 асуулт
  });
});
