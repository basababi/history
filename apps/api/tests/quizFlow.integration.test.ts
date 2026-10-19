/**
 * Quiz-ийн бүтэн урсгалын integration тест — БОДИТ Postgres дээр.
 *
 * session → answer → finish. Энэ нь Бүлэг 6.1-ийн гурван алхамт
 * server-authoritative урсгалыг бодитоор баталгаажуулна:
 *   1) correctIndex асуулт үйлчлэх үед ЯВАХГҮЙ
 *   2) клиент зөвхөн сонголтоо буцаана
 *   3) сервер оноолж, XP/streak/unlock-ыг шинэчилнэ
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeDb, json, postReq } from './helpers/harness';

process.env.SESSION_SECRET = 'integration-test-secret';
// `x-dev-user` толгой зөвхөн production БИШ үед ажиллана.
// `NODE_ENV` нь readonly тул assign хийхгүй — vitest аль хэдийн 'test' болгосон.

const { db } = await makeDb();

// Бүх route-ийн ашигладаг `@/lib/db`-г PGlite рүү залгана
vi.mock('@/lib/db', () => ({
  get db() {
    return db;
  },
  isDbConfigured: () => true,
}));

const { seedAll } = await import('@nomad/db');
const schema = await import('@nomad/db');
const { POST: createSession } = await import('../app/api/quiz/session/route');
const { POST: submitAnswer } = await import('../app/api/quiz/answer/route');
const { POST: finishSession } = await import('../app/api/quiz/finish/route');
const { GET: getProfile } = await import('../app/api/profile/route');

interface SessionRes {
  sessionId: number;
  token: string;
  expiresAt: number;
  questions: Array<{
    id: number;
    body: string;
    options: string[];
    difficulty: string;
    servedAt: number;
  }>;
  extraSecondsPerQuestion: number;
  fiftyFiftyAvailable: boolean;
}

let userId: number;

beforeAll(async () => {
  await seedAll(db);
  const [u] = await db
    .insert(schema.users)
    .values({ email: 'flow@nomad.mn', provider: 'google' })
    .returning();
  userId = u!.id;
  await db
    .insert(schema.profiles)
    .values({ userId, displayName: 'Аялагч' });
}, 60_000);

beforeEach(async () => {
  // Профайлыг эхлэл рүү буцаана
  await db
    .update(schema.profiles)
    .set({
      xp: 0,
      rankTier: 'bronze',
      streakDays: 0,
      lastActiveDate: null,
      streakShieldUsedMonth: null,
      bonusLedger: {},
      activeHeroId: null,
    })
    .where(eq(schema.profiles.userId, userId));
  await db.delete(schema.userHeroes).where(eq(schema.userHeroes.userId, userId));
  await db
    .delete(schema.userArtifacts)
    .where(eq(schema.userArtifacts.userId, userId));
});

async function startSession(mode = 'daily'): Promise<SessionRes> {
  const res = await createSession(
    postReq('/api/quiz/session', { questionCount: 10, mode }, userId)
  );
  expect(res.status).toBe(200);
  return json<SessionRes>(res);
}

describe('🔴 Алхам 1 — сессийн хариу (Бүлэг 6.1)', () => {
  it('correctIndex ХЭЗЭЭ Ч клиент рүү явахгүй', async () => {
    const s = await startSession();
    expect(s.questions.length).toBe(10);
    for (const q of s.questions) {
      expect(q).not.toHaveProperty('correctIndex');
      expect(q).not.toHaveProperty('explanation');
      expect(Object.keys(q).sort()).toEqual(
        ['body', 'difficulty', 'eraId', 'id', 'options', 'servedAt'].sort()
      );
    }
  });

  it('бүтэн хариунд ямар ч хэлбэрээр correctIndex байхгүй', async () => {
    const res = await createSession(
      postReq('/api/quiz/session', { questionCount: 10 }, userId)
    );
    const raw = await res.text();
    expect(raw).not.toContain('correctIndex');
    expect(raw).not.toContain('correct_index');
  });

  it('сесс ӨС-д бүртгэгдэнэ', async () => {
    const s = await startSession();
    const rows = await db
      .select()
      .from(schema.quizSessions)
      .where(eq(schema.quizSessions.id, s.sessionId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(userId);
  });

  it('нэвтрээгүй хэрэглэгчийг татгалзана', async () => {
    const res = await createSession(
      new Request('http://test.local/api/quiz/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questionCount: 10 }),
      })
    );
    expect(res.status).toBe(401);
  });
});

describe('Алхам 2+3 — оноолт сервер дээр', () => {
  it('зөв хариултад XP олгож, тайлбар + эх сурвалж буцаана', async () => {
    const s = await startSession();
    const q = s.questions[0]!;

    // Зөв индексийг ӨС-ээс шууд авна (клиент үүнийг мэдэхгүй)
    const [row] = await db
      .select({ ci: schema.questions.correctIndex })
      .from(schema.questions)
      .where(eq(schema.questions.id, q.id));

    const res = await submitAnswer(
      postReq(
        '/api/quiz/answer',
        { token: s.token, questionId: q.id, selectedIndex: row!.ci, confidenceLevel: 3 },
        userId
      )
    );
    expect(res.status).toBe(200);

    const body = await json<{
      isCorrect: boolean;
      xpAwarded: number;
      correctIndex: number;
      explanation: string;
      sourceRef: string;
    }>(res);

    expect(body.isCorrect).toBe(true);
    expect(body.xpAwarded).toBeGreaterThan(0);
    expect(body.correctIndex).toBe(row!.ci); // ЗӨВХӨН одоо ирнэ
    expect(body.explanation.length).toBeGreaterThan(0);
    expect(body.sourceRef.length).toBeGreaterThan(0);
  });

  it('буруу хариултад 0 XP', async () => {
    const s = await startSession();
    const q = s.questions[0]!;
    const [row] = await db
      .select({ ci: schema.questions.correctIndex })
      .from(schema.questions)
      .where(eq(schema.questions.id, q.id));

    const wrong = (row!.ci + 1) % q.options.length;
    const body = await json<{ isCorrect: boolean; xpAwarded: number }>(
      await submitAnswer(
        postReq(
          '/api/quiz/answer',
          { token: s.token, questionId: q.id, selectedIndex: wrong },
          userId
        )
      )
    );
    expect(body.isCorrect).toBe(false);
    expect(body.xpAwarded).toBe(0);
  });

  it('🔴 давхар хариултыг 409-өөр татгалзана', async () => {
    const s = await startSession();
    const q = s.questions[0]!;

    await submitAnswer(
      postReq('/api/quiz/answer', { token: s.token, questionId: q.id, selectedIndex: 0 }, userId)
    );
    const second = await submitAnswer(
      postReq('/api/quiz/answer', { token: s.token, questionId: q.id, selectedIndex: 1 }, userId)
    );

    expect(second.status).toBe(409);
    const err = await json<{ error: { code: string } }>(second);
    expect(err.error.code).toBe('ALREADY_ANSWERED');
  });

  it('🔴 сесст байхгүй асуултыг татгалзана', async () => {
    const s = await startSession();
    const res = await submitAnswer(
      postReq('/api/quiz/answer', { token: s.token, questionId: 999_999, selectedIndex: 0 }, userId)
    );
    expect(res.status).toBe(400);
  });

  it('🔴 засварласан token-ыг татгалзана', async () => {
    const s = await startSession();
    const tampered = s.token.slice(0, -4) + 'AAAA';
    const res = await submitAnswer(
      postReq(
        '/api/quiz/answer',
        { token: tampered, questionId: s.questions[0]!.id, selectedIndex: 0 },
        userId
      )
    );
    expect(res.status).toBe(401);
  });

  it('🔴 өөр хэрэглэгчийн token-ыг татгалзана', async () => {
    const s = await startSession();
    const [other] = await db
      .insert(schema.users)
      .values({ email: 'other@nomad.mn', provider: 'google' })
      .returning();
    await db
      .insert(schema.profiles)
      .values({ userId: other!.id, displayName: 'Өөр' })
      .onConflictDoNothing();

    const res = await submitAnswer(
      postReq(
        '/api/quiz/answer',
        { token: s.token, questionId: s.questions[0]!.id, selectedIndex: 0 },
        other!.id
      )
    );
    expect(res.status).toBe(403);
  });

  it('attempts-д хариулт бүр бичигдэнэ (чансааны цорын ганц эх сурвалж)', async () => {
    const s = await startSession();
    for (const q of s.questions.slice(0, 3)) {
      await submitAnswer(
        postReq('/api/quiz/answer', { token: s.token, questionId: q.id, selectedIndex: 0 }, userId)
      );
    }
    const rows = await db
      .select()
      .from(schema.attempts)
      .where(eq(schema.attempts.sessionId, s.sessionId));
    expect(rows).toHaveLength(3);
  });
});

describe('Дүн — XP, streak, unlock (Бүлэг 3.6, 3.7)', () => {
  /** Бүх асуултад ЗӨВ хариулна */
  async function answerAll(s: SessionRes, correct = true) {
    for (const q of s.questions) {
      const [row] = await db
        .select({ ci: schema.questions.correctIndex })
        .from(schema.questions)
        .where(eq(schema.questions.id, q.id));
      const idx = correct ? row!.ci : (row!.ci + 1) % q.options.length;
      await submitAnswer(
        postReq(
          '/api/quiz/answer',
          { token: s.token, questionId: q.id, selectedIndex: idx, confidenceLevel: 3 },
          userId
        )
      );
    }
  }

  it('бүх зөв хариултад XP + өдрийн бонус + streak', async () => {
    const s = await startSession('daily');
    await answerAll(s, true);

    const res = await finishSession(postReq('/api/quiz/finish', { token: s.token }, userId));
    expect(res.status).toBe(200);

    const out = await json<{
      correctCount: number;
      totalQuestions: number;
      baseXp: number;
      bonusXp: number;
      totalXp: number;
      dailyChallengeAwarded: boolean;
      streakDays: number;
      streakIncreased: boolean;
      unlockedHeroIds: number[];
      unlockedArtifactIds: number[];
      eraBreakdown: Array<{ eraName: string; attempted: number; correct: number; accuracy: number }>;
      overconfidentQuestionIds: number[];
    }>(res);

    expect(out.correctCount).toBe(10);
    expect(out.totalQuestions).toBe(10);
    expect(out.baseXp).toBeGreaterThan(0);
    expect(out.dailyChallengeAwarded).toBe(true);
    expect(out.bonusXp).toBe(50); // өдрийн сорил
    expect(out.totalXp).toBe(out.baseXp + 50);
    expect(out.streakDays).toBe(1);
    expect(out.streakIncreased).toBe(true);
  });

  it('bronze баатар нээгдэнэ (fallback ажиллана)', async () => {
    const s = await startSession('daily');
    await answerAll(s, true);
    const out = await json<{ unlockedHeroIds: number[] }>(
      await finishSession(postReq('/api/quiz/finish', { token: s.token }, userId))
    );
    expect(out.unlockedHeroIds.length).toBeGreaterThan(0);

    const owned = await db
      .select()
      .from(schema.userHeroes)
      .where(eq(schema.userHeroes.userId, userId));
    expect(owned.length).toBeGreaterThan(0);
  });

  it('нарийвчлал ≥70% үед олдвор олгогдоно — музей дүүрдэг', async () => {
    const s = await startSession('daily');
    await answerAll(s, true);
    const out = await json<{ unlockedArtifactIds: number[] }>(
      await finishSession(postReq('/api/quiz/finish', { token: s.token }, userId))
    );
    expect(out.unlockedArtifactIds).toHaveLength(1);

    const owned = await db
      .select()
      .from(schema.userArtifacts)
      .where(eq(schema.userArtifacts.userId, userId));
    expect(owned).toHaveLength(1);
  });

  it('нарийвчлал <70% үед олдвор олгохгүй', async () => {
    const s = await startSession('daily');
    await answerAll(s, false);
    const out = await json<{ unlockedArtifactIds: number[]; correctCount: number }>(
      await finishSession(postReq('/api/quiz/finish', { token: s.token }, userId))
    );
    expect(out.correctCount).toBe(0);
    expect(out.unlockedArtifactIds).toHaveLength(0);
  });

  it('эринээр ахиц БОДИТ — сул эрин эхэнд эрэмбэлэгдэнэ', async () => {
    const s = await startSession('daily');
    await answerAll(s, true);
    const out = await json<{
      eraBreakdown: Array<{ eraName: string; attempted: number; correct: number; accuracy: number }>;
    }>(await finishSession(postReq('/api/quiz/finish', { token: s.token }, userId)));

    expect(out.eraBreakdown.length).toBeGreaterThan(0);
    const total = out.eraBreakdown.reduce((n, e) => n + e.attempted, 0);
    expect(total).toBe(10);
    for (const e of out.eraBreakdown) {
      expect(e.eraName).not.toBe('—');
      expect(e.accuracy).toBeGreaterThanOrEqual(0);
      expect(e.accuracy).toBeLessThanOrEqual(1);
    }
    // өсөх дараалалтай (сул нь эхэнд)
    for (let i = 1; i < out.eraBreakdown.length; i++) {
      expect(out.eraBreakdown[i]!.accuracy).toBeGreaterThanOrEqual(
        out.eraBreakdown[i - 1]!.accuracy
      );
    }
  });

  it('итгэлтэй байж алдсаныг тэмдэглэнэ (метакогнитив — Бүлэг 3.7)', async () => {
    const s = await startSession('daily');
    await answerAll(s, false); // бүгд буруу, итгэл = 3
    const out = await json<{ overconfidentQuestionIds: number[] }>(
      await finishSession(postReq('/api/quiz/finish', { token: s.token }, userId))
    );
    expect(out.overconfidentQuestionIds).toHaveLength(10);
  });

  it('🔴 өдрийн бонус өдөрт НЭГ л удаа', async () => {
    const s1 = await startSession('daily');
    await answerAll(s1, true);
    const first = await json<{ dailyChallengeAwarded: boolean }>(
      await finishSession(postReq('/api/quiz/finish', { token: s1.token }, userId))
    );
    expect(first.dailyChallengeAwarded).toBe(true);

    const s2 = await startSession('daily');
    await answerAll(s2, true);
    const second = await json<{ dailyChallengeAwarded: boolean; bonusXp: number }>(
      await finishSession(postReq('/api/quiz/finish', { token: s2.token }, userId))
    );
    expect(second.dailyChallengeAwarded).toBe(false);
    expect(second.bonusXp).toBe(0);
  });

  it('чөлөөт горимд өдрийн бонус олгохгүй', async () => {
    const s = await startSession('free');
    await answerAll(s, true);
    const out = await json<{ dailyChallengeAwarded: boolean }>(
      await finishSession(postReq('/api/quiz/finish', { token: s.token }, userId))
    );
    expect(out.dailyChallengeAwarded).toBe(false);
  });

  it('хариултгүй сессийг татгалзана', async () => {
    const s = await startSession('daily');
    const res = await finishSession(postReq('/api/quiz/finish', { token: s.token }, userId));
    expect(res.status).toBe(400);
  });

  it('XP профайлд бодитоор нэмэгдэнэ', async () => {
    const s = await startSession('daily');
    await answerAll(s, true);
    const out = await json<{ totalXp: number; newXp: number }>(
      await finishSession(postReq('/api/quiz/finish', { token: s.token }, userId))
    );

    const [p] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId));
    expect(p!.xp).toBe(out.newXp);
    expect(p!.xp).toBe(out.totalXp);
  });
});

describe('Профайл серверээс ирнэ', () => {
  it('дүнгийн дараа профайл шинэчлэгдсэн байна', async () => {
    const s = await startSession('daily');
    for (const q of s.questions) {
      const [row] = await db
        .select({ ci: schema.questions.correctIndex })
        .from(schema.questions)
        .where(eq(schema.questions.id, q.id));
      await submitAnswer(
        postReq('/api/quiz/answer', { token: s.token, questionId: q.id, selectedIndex: row!.ci }, userId)
      );
    }
    await finishSession(postReq('/api/quiz/finish', { token: s.token }, userId));

    const { getReq } = await import('./helpers/harness');
    const p = await json<{
      xp: number;
      streakDays: number;
      dailyDone: boolean;
      unlockedHeroIds: number[];
      rankTitle: string;
    }>(await getProfile(getReq('/api/profile', userId)));

    expect(p.xp).toBeGreaterThan(0);
    expect(p.streakDays).toBe(1);
    expect(p.dailyDone).toBe(true);
    expect(p.unlockedHeroIds.length).toBeGreaterThan(0);
    expect(p.rankTitle).toBe('Элч');
  });
});
