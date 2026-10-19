/**
 * Схемийн integration тест — БОДИТ Postgres дээр (PGlite).
 *
 * Энэ нь migration, FK, UNIQUE хязгаарлалт, partial index бүгд ажиллаж
 * байгааг батална. Бүлэг 6.1-ийн «давхар хариултаас ӨС-ийн түвшинд
 * хамгаалах» шаардлага энд бодитоор шалгагдана.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import {
  artifacts,
  attempts,
  eras,
  heroes,
  profiles,
  questions,
  quizSessions,
  userArtifacts,
  userHeroes,
  users,
} from '../src/schema';
import { createTestDb, type TestDb } from './helpers/testDb';

/**
 * PG алдааны SQLSTATE-ыг гаргана.
 * ⚠ Drizzle 0.45 алдааг `DrizzleQueryError` дотор боодог тул мессежээр
 * шалгах нь эвдэрнэ — `.cause` гинжийг гүйлгэж кодоор шалгана.
 */
function pgCode(err: unknown): string | undefined {
  let cur: unknown = err;
  for (let i = 0; i < 8 && cur; i++) {
    if (typeof cur !== 'object') break;
    const e = cur as { code?: unknown; cause?: unknown };
    if (typeof e.code === 'string') return e.code;
    cur = e.cause;
  }
  return undefined;
}

let db: TestDb;
let close: () => Promise<void>;

let userId: number;
let eraId: number;
let questionId: number;
let sessionId: number;

beforeAll(async () => {
  const t = await createTestDb();
  db = t.db;
  close = t.close;

  const [u] = await db
    .insert(users)
    .values({ email: 'test@nomad.mn', provider: 'google' })
    .returning();
  userId = u!.id;

  await db.insert(profiles).values({ userId, displayName: 'Тэст' });

  const [e] = await db
    .insert(eras)
    .values({ name: 'Хүннү гүрэн', orderIndex: 1 })
    .returning();
  eraId = e!.id;

  const [q] = await db
    .insert(questions)
    .values({
      eraId,
      difficulty: 'easy',
      body: 'Тест асуулт?',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
      explanation: 'Тайлбар',
      sourceRef: 'Ши цзи',
      status: 'published',
    })
    .returning();
  questionId = q!.id;

  const [s] = await db
    .insert(quizSessions)
    .values({
      userId,
      expiresAt: new Date(Date.now() + 600_000),
      questionIds: [questionId],
      serverNonce: 'nonce-1',
    })
    .returning();
  sessionId = s!.id;
}, 60_000);

afterAll(async () => {
  await close?.();
});

describe('Migration бодитоор ажиллана', () => {
  it('34 хүснэгт үүссэн (хуучин 28 + «Өдрийн тав»-ын 6)', async () => {
    const res = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const names = (res.rows as Array<{ table_name: string }>).map((r) => r.table_name);
    expect(names).toHaveLength(34);
    for (const t of [
      'users', 'profiles', 'eras', 'questions', 'question_stats', 'attempts',
      'quiz_sessions', 'heroes', 'user_heroes', 'artifacts', 'user_artifacts',
      'leagues', 'league_members', 'content_reviews', 'knowledge_chunks',
      'mentor_cache', 'retention_probes', 'offline_sync_log', 'subscriptions',
      'ger_items', 'user_ger_items', 'mediation_attempts', 'elder_contributions', 'classrooms', 'classroom_members', 'stories', 'story_nodes', 'story_completions',
      'daily_sets', 'daily_plays', 'daily_answers', 'friend_groups', 'friend_group_members', 'rivalries',
    ]) {
      expect(names, `${t} хүснэгт дутуу`).toContain(t);
    }
  });

  it('published асуултын partial index үүссэн (Бүлэг 5.2)', async () => {
    const res = await db.execute(
      sql`SELECT indexdef FROM pg_indexes WHERE indexname = 'questions_quiz_idx'`
    );
    const def = (res.rows[0] as { indexdef: string } | undefined)?.indexdef ?? '';
    expect(def).toContain('WHERE');
    expect(def).toContain("'published'");
  });

  it('attempts(user_id, created_at DESC) индекс үүссэн', async () => {
    const res = await db.execute(
      sql`SELECT indexdef FROM pg_indexes WHERE indexname = 'attempts_user_created_idx'`
    );
    expect((res.rows[0] as { indexdef: string } | undefined)?.indexdef).toContain('DESC');
  });
});

describe('🔴 Давхар хариултын ӨС-ийн түвшний хамгаалалт (Бүлэг 6.1)', () => {
  it('нэг session+question хосд эхний хариулт бичигдэнэ', async () => {
    await db.insert(attempts).values({
      userId,
      questionId,
      sessionId,
      isCorrect: true,
      responseMs: 3200,
      xpAwarded: 15,
    });
    const rows = await db.select().from(attempts).where(eq(attempts.sessionId, sessionId));
    expect(rows).toHaveLength(1);
  });

  it('ХОЁР ДАХЬ хариултыг ӨС ТАТГАЛЗАНА — програмын алдаа ч гэсэн барина', async () => {
    await expect(
      db.insert(attempts).values({
        userId,
        questionId,
        sessionId,
        isCorrect: false,
        responseMs: 900,
        xpAwarded: 0,
      })
    ).rejects.toSatisfy(
      (err: unknown) => pgCode(err) === '23505',
      'UNIQUE зөрчил (SQLSTATE 23505) байх ёстой'
    );
  });

  it('өөр сесст ижил асуулт зөвшөөрөгдөнө', async () => {
    const [s2] = await db
      .insert(quizSessions)
      .values({
        userId,
        expiresAt: new Date(Date.now() + 600_000),
        questionIds: [questionId],
        serverNonce: 'nonce-2',
      })
      .returning();

    await expect(
      db.insert(attempts).values({
        userId,
        questionId,
        sessionId: s2!.id,
        isCorrect: true,
        responseMs: 2000,
        xpAwarded: 10,
      })
    ).resolves.toBeDefined();
  });
});

describe('Unlock идемпотент байдал ӨС-ийн түвшинд', () => {
  it('нэг баатрыг давхар олгохгүй (user_heroes_uq)', async () => {
    const [h] = await db
      .insert(heroes)
      .values({
        name: 'Модун шаньюй',
        eraId,
        rankTier: 'bronze',
        perk: { extraSeconds: 5 },
        lore: 'Тест',
        sourceRef: 'Ши цзи',
        chronologicalOrder: 1,
      })
      .returning();

    await db.insert(userHeroes).values({ userId, heroId: h!.id });

    // onConflictDoNothing — API-ийн ашигладаг хэлбэр
    await db.insert(userHeroes).values({ userId, heroId: h!.id }).onConflictDoNothing();

    const rows = await db.select().from(userHeroes).where(eq(userHeroes.userId, userId));
    expect(rows).toHaveLength(1);
  });

  it('нэг олдворыг давхар олгохгүй (user_artifacts_uq)', async () => {
    const [a] = await db
      .insert(artifacts)
      .values({
        name: 'Хүннүгийн сум',
        eraId,
        rarity: 'common',
        description: 'Тест',
        sourceRef: 'Каталог',
      })
      .returning();

    await db.insert(userArtifacts).values({ userId, artifactId: a!.id });
    await db
      .insert(userArtifacts)
      .values({ userId, artifactId: a!.id })
      .onConflictDoNothing();

    const rows = await db
      .select()
      .from(userArtifacts)
      .where(eq(userArtifacts.userId, userId));
    expect(rows).toHaveLength(1);
  });
});

describe('Контентийн засаглалын хязгаарлалт (Бүлэг 6.2)', () => {
  it('source_ref-гүй асуулт ОРОХГҮЙ (NOT NULL)', async () => {
    await expect(
      db.execute(
        sql`INSERT INTO questions (era_id, difficulty, body, options, correct_index, explanation, status)
            VALUES (${eraId}, 'easy', 'Эх сурвалжгүй', '["A","B"]'::jsonb, 0, 'Тайлбар', 'published')`
      )
    ).rejects.toSatisfy(
      (err: unknown) => pgCode(err) === '23502',
      'NOT NULL зөрчил (SQLSTATE 23502) байх ёстой'
    );
  });

  it('шинэ асуулт үндсэн байдлаар draft төлөвтэй', async () => {
    const [q] = await db
      .insert(questions)
      .values({
        eraId,
        difficulty: 'medium',
        body: 'Статус тест',
        options: ['A', 'B'],
        correctIndex: 0,
        explanation: 'Т',
        sourceRef: 'Эх сурвалж',
      })
      .returning();
    expect(q!.status).toBe('draft');
  });

  it('quiz зөвхөн published асуулт татна', async () => {
    const rows = await db
      .select()
      .from(questions)
      .where(eq(questions.status, 'published'));
    // Дээр 1 published нэмсэн; draft-ууд орохгүй
    expect(rows.every((r) => r.status === 'published')).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('FK бүрэн бүтэн байдал', () => {
  it('байхгүй хэрэглэгчид профайл үүсгэхгүй', async () => {
    await expect(
      db.insert(profiles).values({ userId: 999_999, displayName: 'Хий' })
    ).rejects.toThrow();
  });

  it('байхгүй эринд асуулт үүсгэхгүй', async () => {
    await expect(
      db.insert(questions).values({
        eraId: 999_999,
        difficulty: 'easy',
        body: 'Хий эрин',
        options: ['A'],
        correctIndex: 0,
        explanation: 'Т',
        sourceRef: 'Э',
      })
    ).rejects.toThrow();
  });

  it('serverNonce давхардахгүй', async () => {
    await expect(
      db.insert(quizSessions).values({
        userId,
        expiresAt: new Date(),
        questionIds: [],
        serverNonce: 'nonce-1',
      })
    ).rejects.toThrow();
  });
});
