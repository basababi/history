/**
 * «Өдрийн тав»-ын схем — БОДИТ Postgres (PGlite) дээрх хязгаарлалтууд.
 *
 * Програмын шалгалт бүтэлгүйтсэн ч ӨС шударга байдлыг барих ёстой:
 * нэг өдрийг хоёр тоглох, нэг асуултад хоёр хариулах, нэг хосыг хоёр
 * өрсөлдөгч болгох — бүгд ӨС-ийн түвшинд ХААГДАНА.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  dailyAnswers,
  dailyPlays,
  dailySets,
  eras,
  friendGroupMembers,
  friendGroups,
  profiles,
  questions,
  rivalries,
  users,
} from '../src/schema';
import { createTestDb, type TestDb } from './helpers/testDb';

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

async function expectPgError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
  } catch (err) {
    expect(pgCode(err)).toBe(code);
    return;
  }
  throw new Error(`PG алдаа ${code} хүлээгдэж байсан`);
}

let db: TestDb;
let close: () => Promise<void>;
let alice: number;
let bob: number;
let questionId: number;

beforeAll(async () => {
  const t = await createTestDb();
  db = t.db;
  close = t.close;

  const [a] = await db.insert(users).values({ provider: 'guest', providerId: 'hash-a' }).returning();
  const [b] = await db.insert(users).values({ provider: 'guest', providerId: 'hash-b' }).returning();
  alice = a!.id;
  bob = b!.id;

  // Нэргүй зочин — display_name NULL байж болно
  await db.insert(profiles).values({ userId: alice, displayName: null });
  await db.insert(profiles).values({ userId: bob, displayName: 'Бат' });

  const [era] = await db.insert(eras).values({ name: 'Их Монгол Улс', orderIndex: 2 }).returning();
  const [q] = await db
    .insert(questions)
    .values({
      eraId: era!.id,
      difficulty: 'easy',
      format: 'myth_or_fact',
      body: 'Тест асуулт',
      options: ['Үнэн', 'Домог'],
      correctIndex: 1,
      explanation: 'Тайлбар',
      sourceRef: 'Эх сурвалж',
      status: 'published',
    })
    .returning();
  questionId = q!.id;

  await db.insert(dailySets).values({ dayKey: '2026-10-19', questionIds: [questionId] });
}, 60_000);

afterAll(async () => {
  await close();
});

describe('Хэрэглэгч ба профайл', () => {
  it('нэргүй зочин хадгалагдана, дээд амжилт 0-ээс эхэлнэ', async () => {
    const [p] = await db.select().from(profiles).where(eq(profiles.userId, alice));
    expect(p?.displayName).toBeNull();
    expect(p?.bestStreak).toBe(0);
  });

  it('🔴 нэг провайдерын ID давхардахгүй (сэргээх кодын хэш)', async () => {
    await expectPgError(db.insert(users).values({ provider: 'guest', providerId: 'hash-a' }), '23505');
  });

  it('асуултын хэлбэр хадгалагдана, анхдагч нь classic', async () => {
    const [q] = await db.select().from(questions).where(eq(questions.id, questionId));
    expect(q?.format).toBe('myth_or_fact');
  });
});

describe('Өдрийн тоглолт', () => {
  it('🔴 нэг хэрэглэгч нэг өдрийг НЭГ л удаа тоглоно', async () => {
    await db.insert(dailyPlays).values({ userId: alice, dayKey: '2026-10-19', onTime: true });
    await expectPgError(
      db.insert(dailyPlays).values({ userId: alice, dayKey: '2026-10-19' }),
      '23505'
    );
  });

  it('🔴 байхгүй өдрийн багцад тоглолт үүсгэхгүй (FK)', async () => {
    await expectPgError(db.insert(dailyPlays).values({ userId: bob, dayKey: '2099-01-01' }), '23503');
  });

  it('🔴 сорилтын код давтагдахгүй', async () => {
    await db.update(dailyPlays).set({ shareCode: 'ABCD2345' }).where(eq(dailyPlays.userId, alice));
    await db.insert(dailySets).values({ dayKey: '2026-10-20', questionIds: [questionId] });
    await expectPgError(
      db.insert(dailyPlays).values({ userId: bob, dayKey: '2026-10-20', shareCode: 'ABCD2345' }),
      '23505'
    );
  });

  it('🔴 нэг байрлалд НЭГ л хариулт', async () => {
    const [play] = await db.select().from(dailyPlays).where(eq(dailyPlays.userId, alice));
    await db.insert(dailyAnswers).values({ playId: play!.id, position: 0, questionId });
    await expectPgError(
      db.insert(dailyAnswers).values({ playId: play!.id, position: 0, questionId }),
      '23505'
    );
  });

  it('сорилтоор орж ирснийг холбож хадгална', async () => {
    const [aliceplay] = await db.select().from(dailyPlays).where(eq(dailyPlays.userId, alice));
    const [bobplay] = await db
      .insert(dailyPlays)
      .values({ userId: bob, dayKey: '2026-10-19', challengedByPlayId: aliceplay!.id })
      .returning();
    expect(bobplay?.challengedByPlayId).toBe(aliceplay!.id);
  });
});

describe('Нийгмийн холбоос', () => {
  it('🔴 өрсөлдөгчийн хос нэг л дараалалтай (low < high)', async () => {
    const [low, high] = alice < bob ? [alice, bob] : [bob, alice];
    await db.insert(rivalries).values({ userLow: low, userHigh: high });
    await expectPgError(db.insert(rivalries).values({ userLow: high, userHigh: low }), '23514');
    await expectPgError(db.insert(rivalries).values({ userLow: low, userHigh: high }), '23505');
  });

  it('🔴 бүлэгт нэг хүн нэг л удаа', async () => {
    const [g] = await db.insert(friendGroups).values({ code: 'ABC234', name: 'Найзууд', ownerId: alice }).returning();
    await db.insert(friendGroupMembers).values({ groupId: g!.id, userId: alice });
    await expectPgError(db.insert(friendGroupMembers).values({ groupId: g!.id, userId: alice }), '23505');
  });

  it('🔴 бүлгийн код давтагдахгүй', async () => {
    await expectPgError(
      db.insert(friendGroups).values({ code: 'ABC234', name: 'Өөр', ownerId: bob }),
      '23505'
    );
  });
});
