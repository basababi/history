/**
 * «Өдрийн тав»-ын серверийн үйлчилгээ — route-ууд энэ давхаргаар л ӨС-д хүрнэ.
 *
 * ══ ХУГАЦААНЫ ГЭРЭЭ ══
 *
 *   нээх (/next)  ── servedAt ──►  хариулах (/answer) ── answeredAt
 *                     └──── responseMs = answeredAt − servedAt ────┘
 *
 *   • Асуулт НЭГ НЭГЭЭР нээгдэнэ — дараагийнхыг урьдчилж харах боломжгүй.
 *   • Хуудсаа сэргээхэд таймер шинээр ЭХЛЭХГҮЙ (servedAt хадгалагдсан).
 *   • Хугацаа хэтэрсэн асуулт дараагийн нээлтэд автоматаар «хугацаа
 *     дууссан» болно — таб хааж зугтах боломжгүй.
 *
 * Бүх цагийг АППЫН цагаар (Date.now) бичнэ — ӨС-ийн `now()`-оор биш.
 * Ингэснээр тест цагийг хянаж, хугацааны дүрмийг бодитоор шалгана.
 */
import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import {
  advanceStreak,
  ANSWER_GRACE_MS,
  DAILY_QUESTION_COUNT,
  dayNumber,
  DEFAULT_LAUNCH_DAY,
  detectAnomaly,
  generateShareCode,
  isQuestionFormat,
  isValidDayKey,
  optionOrder,
  pickDailySet,
  QUESTION_TIME_LIMIT_MS,
  shouldShuffleOptions,
  todayInUlaanbaatar,
  type DailyCandidate,
  type Difficulty,
  type QuestionFormat,
} from '@nomad/core';
import type { DailyQuestion, PlayProgress } from '@nomad/contracts';
import { dailyAnswers, dailyPlays, dailySets, eras, profiles, questions } from '@nomad/db';
import { db } from './db';
import { cryptoRandom } from './guest';
import { isUniqueViolation } from './pgError';
import { ensureRivalry } from './social';

export type PlayRow = typeof dailyPlays.$inferSelect;
export type AnswerRow = typeof dailyAnswers.$inferSelect;

/** Асуултын зөв хувийг харуулах доод түүвэр — цөөн бол утгагүй, нууцлал алдагдана */
export const CORRECT_RATE_MIN_SAMPLE = 3;

// ─── Өдөр ───

export function launchDay(): string {
  const fromEnv = process.env.DAILY_LAUNCH_DAY;
  return fromEnv && isValidDayKey(fromEnv) ? fromEnv : DEFAULT_LAUNCH_DAY;
}

export function todayKey(now = Date.now()): string {
  return todayInUlaanbaatar(now);
}

export function dayNo(dayKey: string): number {
  return dayNumber(dayKey, launchDay());
}

// ─── Өдрийн багц ───

export type DailySetResult =
  | { ok: true; questionIds: number[] }
  | { ok: false; reason: 'FUTURE_DAY' | 'NO_SUCH_DAY' | 'NO_QUESTIONS' | 'BAD_DAY' };

/**
 * Өдрийн багц. Өнөөдрийнх байхгүй бол үүсгэнэ; өнгөрсөн өдрийнхийг
 * ЗӨВХӨН уншина (хэн нэгэн тоглосон өдөр л сорилтын линктэй байна).
 *
 * Зэрэг ирсэн хүсэлтүүд `ON CONFLICT DO NOTHING`-оор нэг мөрөнд нийлнэ.
 */
export async function getDailySet(dayKey: string, now = Date.now()): Promise<DailySetResult> {
  if (!isValidDayKey(dayKey)) return { ok: false, reason: 'BAD_DAY' };
  const today = todayKey(now);
  if (dayKey > today) return { ok: false, reason: 'FUTURE_DAY' };

  const [existing] = await db.select().from(dailySets).where(eq(dailySets.dayKey, dayKey)).limit(1);
  if (existing) return { ok: true, questionIds: existing.questionIds };
  if (dayKey !== today) return { ok: false, reason: 'NO_SUCH_DAY' };

  const pool = await db
    .select({ id: questions.id, difficulty: questions.difficulty, eraId: questions.eraId })
    .from(questions)
    .where(eq(questions.status, 'published'));
  if (pool.length < DAILY_QUESTION_COUNT) return { ok: false, reason: 'NO_QUESTIONS' };

  // Асуулт бүр хамгийн сүүлд аль өдөр орсныг — өдөрт нэг мөр тул бага хүснэгт
  const history = await db.select().from(dailySets);
  const lastUsed = new Map<number, string>();
  for (const h of history) {
    for (const id of h.questionIds) {
      const prev = lastUsed.get(id);
      if (!prev || prev < h.dayKey) lastUsed.set(id, h.dayKey);
    }
  }

  const candidates: DailyCandidate[] = pool.map((q) => ({
    id: q.id,
    difficulty: q.difficulty as Difficulty,
    eraId: q.eraId,
    lastUsedDay: lastUsed.get(q.id) ?? null,
  }));

  const ids = pickDailySet(candidates, dayKey);
  await db
    .insert(dailySets)
    .values({ dayKey, questionIds: ids, createdAt: new Date(now) })
    .onConflictDoNothing();

  const [row] = await db.select().from(dailySets).where(eq(dailySets.dayKey, dayKey)).limit(1);
  return { ok: true, questionIds: row?.questionIds ?? ids };
}

// ─── Тоглолт ───

export async function findPlay(userId: number, dayKey: string): Promise<PlayRow | null> {
  const [row] = await db
    .select()
    .from(dailyPlays)
    .where(and(eq(dailyPlays.userId, userId), eq(dailyPlays.dayKey, dayKey)))
    .limit(1);
  return row ?? null;
}

export async function findPlayByShareCode(code: string): Promise<PlayRow | null> {
  const [row] = await db.select().from(dailyPlays).where(eq(dailyPlays.shareCode, code)).limit(1);
  return row ?? null;
}

/**
 * Тоглолтыг олно эсвэл үүсгэнэ. Сорилтын код зөвхөн ҮҮСГЭХ үед л
 * хэрэглэгдэнэ — дараа нь өөр линкээр орсон ч анхны сорьсон хүн хэвээр.
 */
export async function findOrCreatePlay(
  userId: number,
  dayKey: string,
  opts: { now: number; challengedByPlayId: number | null }
): Promise<PlayRow> {
  const existing = await findPlay(userId, dayKey);
  if (existing) return existing;

  try {
    const [created] = await db
      .insert(dailyPlays)
      .values({
        userId,
        dayKey,
        onTime: dayKey === todayKey(opts.now),
        challengedByPlayId: opts.challengedByPlayId,
        startedAt: new Date(opts.now),
      })
      .returning();
    if (created) return created;
  } catch (err) {
    // Зэрэг ирсэн хоёр хүсэлт — нөгөө нь аль хэдийн үүсгэсэн
    if (!isUniqueViolation(err, 'daily_plays_user_day_uq')) throw err;
  }

  const again = await findPlay(userId, dayKey);
  if (!again) throw new Error('Тоглолт үүсгэж чадсангүй');
  return again;
}

export async function answersOf(playId: number): Promise<AnswerRow[]> {
  return db
    .select()
    .from(dailyAnswers)
    .where(eq(dailyAnswers.playId, playId))
    .orderBy(asc(dailyAnswers.position));
}

/** Олон тоглолтын зөв/буруу тэмдэгт — нэг асуулгаар */
export async function marksFor(playIds: number[]): Promise<Map<number, boolean[]>> {
  const out = new Map<number, boolean[]>();
  if (playIds.length === 0) return out;
  const rows = await db
    .select({ playId: dailyAnswers.playId, position: dailyAnswers.position, isCorrect: dailyAnswers.isCorrect })
    .from(dailyAnswers)
    .where(and(inArray(dailyAnswers.playId, playIds), isNotNull(dailyAnswers.answeredAt)))
    .orderBy(asc(dailyAnswers.playId), asc(dailyAnswers.position));
  for (const r of rows) {
    const list = out.get(r.playId) ?? [];
    list.push(r.isCorrect === true);
    out.set(r.playId, list);
  }
  return out;
}

export function progressOf(play: PlayRow | null, answers: AnswerRow[], total: number): PlayProgress {
  if (!play) {
    return { status: 'not_started', answered: 0, correct: 0, total, totalMs: 0, marks: [], shareCode: null };
  }
  const done = answers.filter((a) => a.answeredAt !== null);
  return {
    status: play.finishedAt ? 'finished' : 'in_progress',
    answered: done.length,
    correct: done.filter((a) => a.isCorrect === true).length,
    total,
    totalMs: done.reduce((sum, a) => sum + (a.responseMs ?? 0), 0),
    marks: done.map((a) => a.isCorrect === true),
    shareCode: play.shareCode,
  };
}

// ─── Хугацаа ───

/** Асуултын хугацаа (нөөцтэй) хэтэрсэн эсэх — СЕРВЕРИЙН цагаар */
export function isExpired(servedAt: Date, now: number): boolean {
  return now - servedAt.getTime() > QUESTION_TIME_LIMIT_MS + ANSWER_GRACE_MS;
}

/**
 * Нээгдсэн боловч хариулаагүй, хугацаа хэтэрсэн асуултыг «хугацаа
 * дууссан» гэж тэмдэглэнэ. `answered_at IS NULL` нөхцөл нь зэрэг ирсэн
 * жинхэнэ хариултыг дарж бичихээс сэргийлнэ.
 */
export async function expireIfStale(answer: AnswerRow, now: number): Promise<boolean> {
  if (answer.answeredAt !== null || !isExpired(answer.servedAt, now)) return false;
  const updated = await db
    .update(dailyAnswers)
    .set({
      answeredAt: new Date(answer.servedAt.getTime() + QUESTION_TIME_LIMIT_MS),
      selectedIndex: -1,
      isCorrect: false,
      responseMs: QUESTION_TIME_LIMIT_MS,
    })
    .where(
      and(
        eq(dailyAnswers.playId, answer.playId),
        eq(dailyAnswers.position, answer.position),
        isNull(dailyAnswers.answeredAt)
      )
    )
    .returning({ position: dailyAnswers.position });
  return updated.length > 0;
}

// ─── Асуулт ───

export interface QuestionRecord {
  id: number;
  format: QuestionFormat;
  difficulty: Difficulty;
  eraName: string;
  body: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceRef: string;
}

export async function loadQuestion(questionId: number): Promise<QuestionRecord | null> {
  const [q] = await db
    .select({
      id: questions.id,
      format: questions.format,
      difficulty: questions.difficulty,
      eraName: eras.name,
      body: questions.body,
      options: questions.options,
      correctIndex: questions.correctIndex,
      explanation: questions.explanation,
      sourceRef: questions.sourceRef,
    })
    .from(questions)
    .innerJoin(eras, eq(questions.eraId, eras.id))
    .where(eq(questions.id, questionId))
    .limit(1);
  if (!q) return null;
  return {
    ...q,
    format: isQuestionFormat(q.format) ? q.format : 'classic',
    difficulty: q.difficulty as Difficulty,
    options: q.options as string[],
  };
}

/** Тухайн өдрийн харагдах дараалал */
export function displayOrder(dayKey: string, q: Pick<QuestionRecord, 'id' | 'options' | 'format'>): number[] {
  return optionOrder(dayKey, q.id, q.options.length, shouldShuffleOptions(q.format));
}

/** Клиент рүү явах асуулт — зөв хариулт ОГТ орохгүй */
export function servedQuestion(
  dayKey: string,
  position: number,
  total: number,
  q: QuestionRecord,
  servedAt: Date,
  now: number
): DailyQuestion {
  const order = displayOrder(dayKey, q);
  return {
    dayKey,
    position,
    total,
    questionId: q.id,
    format: q.format,
    difficulty: q.difficulty,
    eraName: q.eraName,
    body: q.body,
    options: order.map((i) => q.options[i] ?? ''),
    timeLimitMs: QUESTION_TIME_LIMIT_MS,
    remainingMs: Math.max(0, QUESTION_TIME_LIMIT_MS - (now - servedAt.getTime())),
  };
}

// ─── Статистик ───

/** Байрлал тус бүрийн зөв хувь (тухайн өдрийн бүх тоглогчоор) */
export async function correctRates(dayKey: string): Promise<Map<number, number | null>> {
  const rows = await db
    .select({
      position: dailyAnswers.position,
      n: sql<number>`count(*)::int`,
      c: sql<number>`(count(*) filter (where ${dailyAnswers.isCorrect}))::int`,
    })
    .from(dailyAnswers)
    .innerJoin(dailyPlays, eq(dailyAnswers.playId, dailyPlays.id))
    .where(and(eq(dailyPlays.dayKey, dayKey), isNotNull(dailyAnswers.answeredAt)))
    .groupBy(dailyAnswers.position);

  const out = new Map<number, number | null>();
  for (const r of rows) {
    out.set(r.position, r.n >= CORRECT_RATE_MIN_SAMPLE ? r.c / r.n : null);
  }
  return out;
}

export async function finishedCount(dayKey: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(dailyPlays)
    .where(and(eq(dailyPlays.dayKey, dayKey), isNotNull(dailyPlays.finishedAt)));
  return row?.n ?? 0;
}

/** Өдрийн байр: илүү зөв, эсвэл ижил зөвтэй боловч хурдан тоглогчдын тоо + 1 */
export async function dayRank(
  dayKey: string,
  correct: number,
  totalMs: number
): Promise<{ position: number; players: number }> {
  const [row] = await db
    .select({
      players: sql<number>`count(*)::int`,
      better: sql<number>`(count(*) filter (where ${dailyPlays.correctCount} > ${correct} or (${dailyPlays.correctCount} = ${correct} and ${dailyPlays.totalMs} < ${totalMs})))::int`,
    })
    .from(dailyPlays)
    .where(and(eq(dailyPlays.dayKey, dayKey), isNotNull(dailyPlays.finishedAt)));
  return { position: (row?.better ?? 0) + 1, players: row?.players ?? 0 };
}

// ─── Дуусгах ───

/**
 * Бүх асуултад хариулсан бол тоглолтыг хаана: оноо, сорилтын код,
 * цуврал, өрсөлдөгчийн холбоос. ИДЕМПОТЕНТ — дахин дуудахад юу ч
 * өөрчлөгдөхгүй (`finished_at IS NULL` нөхцөл).
 */
export async function finishIfComplete(play: PlayRow, total: number, now: number): Promise<PlayRow> {
  if (play.finishedAt) return play;

  const answers = await answersOf(play.id);
  const answered = answers.filter((a) => a.answeredAt !== null);
  if (answered.length < total) return play;

  const correct = answered.filter((a) => a.isCorrect === true).length;
  const totalMs = answered.reduce((sum, a) => sum + (a.responseMs ?? 0), 0);

  let finished: PlayRow | undefined;
  for (let attempt = 0; attempt < 6 && !finished; attempt++) {
    try {
      const [row] = await db
        .update(dailyPlays)
        .set({
          finishedAt: new Date(now),
          correctCount: correct,
          totalMs,
          shareCode: generateShareCode(cryptoRandom),
        })
        .where(and(eq(dailyPlays.id, play.id), isNull(dailyPlays.finishedAt)))
        .returning();
      if (!row) {
        // Зэрэг ирсэн хүсэлт аль хэдийн дуусгасан
        const [current] = await db.select().from(dailyPlays).where(eq(dailyPlays.id, play.id));
        return current ?? play;
      }
      finished = row;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Сорилтын код давхардлаа (40 бит — маш ховор) — шинээр үүсгэнэ
    }
  }
  if (!finished) throw new Error('Сорилтын код үүсгэж чадсангүй');

  // Цуврал — зөвхөн тухайн өдөрт нь тоглосон бол
  if (finished.onTime) {
    const [profile] = await db
      .select({
        streakDays: profiles.streakDays,
        bestStreak: profiles.bestStreak,
        lastActiveDate: profiles.lastActiveDate,
      })
      .from(profiles)
      .where(eq(profiles.userId, finished.userId));
    if (profile) {
      const next = advanceStreak(profile, finished.dayKey);
      if (next.increased) {
        await db
          .update(profiles)
          .set({ streakDays: next.streakDays, bestStreak: next.bestStreak, lastActiveDate: next.lastActiveDate })
          .where(eq(profiles.userId, finished.userId));
      }
    }
  }

  // Сорилтоор орж ирсэн бол — хоёулаа өрсөлдөгч болно
  if (finished.challengedByPlayId !== null) {
    const [challenger] = await db
      .select({ userId: dailyPlays.userId })
      .from(dailyPlays)
      .where(eq(dailyPlays.id, finished.challengedByPlayId));
    if (challenger) await ensureRivalry(finished.userId, challenger.userId);
  }

  // Аномали (Бүлэг 6.1): хэт хурдан бөгөөд бараг бүгд зөв — гараар хянана
  const anomaly = detectAnomaly({ responseMsList: answered.map((a) => a.responseMs ?? 0), correctCount: correct });
  if (anomaly.flagged) {
    console.warn(
      `[anomaly] user=${finished.userId} day=${finished.dayKey} avgMs=${Math.round(anomaly.avgMs)} acc=${anomaly.accuracy}`
    );
  }

  return finished;
}
