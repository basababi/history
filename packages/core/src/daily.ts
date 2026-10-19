/**
 * «Өдрийн тав» — бүх хүнд ижил таван асуулт (Wordle загвар)
 *
 * ══ ЗАРЧИМ ══
 *
 *   • Өдөр бүр ЯГ НЭГ багц. Улаанбаатарын цагаар 00:00-д солигдоно.
 *   • Багцыг ӨС-д хадгална (сонгох логик нь энд). Асуулт нэмэгдсэн ч
 *     өнгөрсөн өдрийн багц ӨӨРЧЛӨГДӨХГҮЙ — хуучин сорилтын линк эвдрэхгүй.
 *   • Сонголтын дараалал өдөр + асуулт бүрд тогтмолоор холилдоно. Зөв
 *     хариулт ХЭЗЭЭ Ч нэг байрлалд тогтохгүй (seed-ийн бүх асуултын зөв
 *     хариулт «А» байсан нь тоглоомыг утгагүй болгож байсан).
 *   • Хугацааг СЕРВЕР хэмжинэ: асуулт бүр нээгдсэн мөчөөс хариулт ирэх
 *     хүртэл. Тайлбар унших хугацаа тооцогдохгүй — суралцахыг шийтгэхгүй.
 *
 * Энэ файлд I/O байхгүй — цэвэр функц, тест бүрэн.
 */
import { daysBetweenUb, ubDate, ubDateToUtcMs } from './date';
import type { Difficulty } from './question';

// ─── Тогтмолууд ───

export const DAILY_QUESTION_COUNT = 5;

/** Асуулт тус бүрийн хугацаа */
export const QUESTION_TIME_LIMIT_MS = 20_000;

/** Сүлжээний хоцрогдлын нөөц — хугацаа дууссаныг сервер ингэж шийднэ */
export const ANSWER_GRACE_MS = 2_500;

/**
 * Эхний өдөр (#1). Production-д `DAILY_LAUNCH_DAY` env-ээр дарж болно —
 * дугаар нь зөвхөн шошго, логикт нөлөөлөхгүй.
 */
export const DEFAULT_LAUNCH_DAY = '2026-10-19';

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── Өдөр ───

/** `YYYY-MM-DD` хэлбэртэй, бодит огноо мөн эсэх */
export function isValidDayKey(value: string): boolean {
  if (!DAY_KEY_RE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

/** Өдрийн дугаар: эхний өдөр = 1 */
export function dayNumber(dayKey: string, launchDay: string = DEFAULT_LAUNCH_DAY): number {
  return daysBetweenUb(launchDay, dayKey) + 1;
}

/** Дараагийн UB өдөр эхлэх хүртэлх хугацаа (мс) */
export function msUntilNextDay(now = Date.now()): number {
  const nextStart = ubDateToUtcMs(ubDate(now)) + DAY_MS;
  return Math.max(0, nextStart - now);
}

/** UB огнооноос `n` өдрийн өмнөх/дараах огноо */
export function shiftDay(dayKey: string, deltaDays: number): string {
  return new Date(Date.parse(`${dayKey}T00:00:00Z`) + deltaDays * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Тухайн өдрийн долоо хоногийн Даваа гараг (UB) — бүлгийн долоо хоногийн чансаанд */
export function weekStartDay(dayKey: string): string {
  const weekday = (new Date(`${dayKey}T00:00:00Z`).getUTCDay() + 6) % 7; // Даваа = 0
  return shiftDay(dayKey, -weekday);
}

// ─── Тогтмол санамсаргүй байдал ───

/** FNV-1a 32 бит — тогтвортой, хурдан хэш */
export function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — нэг seed-ээс ижил 0..1 дараалал */
export function seededRandom(seed: string): () => number {
  let state = hash32(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates, seed-тэй — оролтыг өөрчлөхгүй */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const rand = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

// ─── Сонголтын дараалал ───

/**
 * Харагдах дараалал: `order[displayIndex] = canonicalIndex`.
 *
 * Өдөр + асуулт бүрд ТОГТМОЛ — найзууд «В-г сонгосон» гэж ярихад ижил
 * сонголтыг хэлнэ, мөн сервер нэмэлт төлөв хадгалахгүйгээр буцаан
 * хөрвүүлж чадна.
 */
export function optionOrder(
  dayKey: string,
  questionId: number,
  optionCount: number,
  shuffle = true
): number[] {
  const identity = Array.from({ length: optionCount }, (_, i) => i);
  return shuffle ? seededShuffle(identity, `opt:${dayKey}:${questionId}`) : identity;
}

/** Харагдах индекс → хадгалсан индекс. Хүчингүй бол null */
export function toCanonicalIndex(order: readonly number[], displayIndex: number): number | null {
  if (!Number.isInteger(displayIndex) || displayIndex < 0 || displayIndex >= order.length) {
    return null;
  }
  return order[displayIndex] ?? null;
}

/** Хадгалсан индекс → харагдах индекс */
export function toDisplayIndex(order: readonly number[], canonicalIndex: number): number {
  return order.indexOf(canonicalIndex);
}

// ─── Өдрийн багц сонгох ───

export interface DailyCandidate {
  id: number;
  difficulty: Difficulty;
  eraId: number;
  /** Хамгийн сүүлд аль өдрийн багцад орсон (null = хэзээ ч ороогүй) */
  lastUsedDay: string | null;
}

/** Хүндрэлийн хэмнэл — амархнаас хүнд рүү, сэтгэл хөдөлгөөн өснө */
export const DAILY_DIFFICULTY_PLAN: readonly Difficulty[] = [
  'easy',
  'easy',
  'medium',
  'medium',
  'hard',
];

const DIFFICULTY_RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

/**
 * Давтагдахгүй байх хоног — сангийн хэмжээнд тааруулна.
 * 21 асуулт → 3 хоног, 150 асуулт → 29 хоног, 300+ → 30 хоног.
 */
export function cooldownDays(poolSize: number, count = DAILY_QUESTION_COUNT): number {
  return Math.max(0, Math.min(30, Math.floor(poolSize / count) - 1));
}

/**
 * Өдрийн багцыг сонгоно. Ижил сан + ижил өдөр → ҮРГЭЛЖ ижил үр дүн.
 *
 * Эрэмбэ:
 *   1. Сүүлийн `cooldownDays` хоногт ороогүй асуултаас, төлөвлөгөөний
 *      хүндрэлтэй тааруулж, аль болох өөр эринээс
 *   2. Хүндрэл таарахгүй бол — мөн давтагдаагүйгээс
 *   3. Сан хэт бага бол — хамгийн эрт ашигласнаас
 *
 * Буцаах дараалал нь хүндрэлээр өсөх (амархан → хүнд).
 */
export function pickDailySet(
  candidates: readonly DailyCandidate[],
  dayKey: string,
  count = DAILY_QUESTION_COUNT
): number[] {
  if (count <= 0 || candidates.length === 0) return [];

  // ⚠ ӨС-ийн мөрийн дараалал баталгаатай биш — эхлээд ID-аар эрэмбэлэхгүй
  // бол ижил сангаас өөр багц гарч, «бүх хүнд ижил» зарчим эвдэрнэ.
  const canonical = [...candidates].sort((a, b) => a.id - b.id);

  // Тэнцүү шинэлэг байдалтай асуултууд seed-ээр санамсаргүй эрэмбэлэгдэнэ;
  // `sort` нь тогтвортой тул энэ дараалал хадгалагдана.
  const shuffled = seededShuffle(canonical, `set:${dayKey}`);
  const byFreshness = [...shuffled].sort((a, b) => {
    if (a.lastUsedDay === b.lastUsedDay) return 0;
    if (a.lastUsedDay === null) return -1;
    if (b.lastUsedDay === null) return 1;
    return a.lastUsedDay < b.lastUsedDay ? -1 : 1;
  });

  const cutoff = shiftDay(dayKey, -cooldownDays(candidates.length, count));
  const rested = (c: DailyCandidate) => c.lastUsedDay === null || c.lastUsedDay < cutoff;

  const plan = Array.from(
    { length: count },
    (_, i) => DAILY_DIFFICULTY_PLAN[i % DAILY_DIFFICULTY_PLAN.length] as Difficulty
  );

  const chosen: DailyCandidate[] = [];
  const taken = new Set<number>();
  const usedEras = new Set<number>();

  const take = (c: DailyCandidate | undefined): boolean => {
    if (!c) return false;
    chosen.push(c);
    taken.add(c.id);
    usedEras.add(c.eraId);
    return true;
  };
  const free = (c: DailyCandidate) => !taken.has(c.id);

  // 1-р шат: хүндрэл таарсан, амарсан, аль болох шинэ эринээс
  const unfilled: number[] = [];
  plan.forEach((want, slot) => {
    const ok =
      take(byFreshness.find((c) => free(c) && rested(c) && c.difficulty === want && !usedEras.has(c.eraId))) ||
      take(byFreshness.find((c) => free(c) && rested(c) && c.difficulty === want));
    if (!ok) unfilled.push(slot);
  });

  // 2-р шат: хүндрэл үл хамааран, амарсан асуултаар нөхнө
  // 3-р шат: сан бага бол хамгийн эрт ашигласнаар
  for (let k = 0; k < unfilled.length; k++) {
    if (!take(byFreshness.find((c) => free(c) && rested(c)))) {
      take(byFreshness.find(free));
    }
  }

  return chosen
    .map((c, i) => ({ c, i }))
    .sort((a, b) => DIFFICULTY_RANK[a.c.difficulty] - DIFFICULTY_RANK[b.c.difficulty] || a.i - b.i)
    .map(({ c }) => c.id);
}

// ─── Оноо ба харьцуулалт ───

export interface DayScore {
  correct: number;
  /** Серверийн хэмжсэн нийт хариулах хугацаа (мс) */
  totalMs: number;
}

export type DuelOutcome = 'win' | 'loss' | 'tie';

/** Хугацааны зөрүү үүнээс бага бол «тэнцсэн» — 40 мс-ээр ялах нь утгагүй */
export const TIME_TIEBREAK_MIN_MS = 1_000;

export interface ScoreComparison {
  outcome: DuelOutcome;
  /** Юугаар шийдэгдсэн */
  decidedBy: 'correct' | 'time' | 'none';
  /** Миний зөв − тэдний зөв */
  correctDiff: number;
  /** Тэдний хугацаа − миний хугацаа (эерэг = би хурдан) */
  msDiff: number;
}

/** Нэг өдрийн дүнг харьцуулна: эхлээд зөв хариулт, дараа нь хугацаа */
export function compareScores(mine: DayScore, theirs: DayScore): ScoreComparison {
  const correctDiff = mine.correct - theirs.correct;
  const msDiff = theirs.totalMs - mine.totalMs;

  if (correctDiff !== 0) {
    return { outcome: correctDiff > 0 ? 'win' : 'loss', decidedBy: 'correct', correctDiff, msDiff };
  }
  if (Math.abs(msDiff) >= TIME_TIEBREAK_MIN_MS) {
    return { outcome: msDiff > 0 ? 'win' : 'loss', decidedBy: 'time', correctDiff, msDiff };
  }
  return { outcome: 'tie', decidedBy: 'none', correctDiff, msDiff };
}

export interface HeadToHead {
  wins: number;
  losses: number;
  ties: number;
  /** Хоёулаа тоглосон өдрийн тоо */
  days: number;
}

/**
 * Хоёр тоглогчийн нийт тулааны тоо — хоёулаа тоглосон өдрүүдээр.
 * «Бат 3 – Чи 2» мэт ээлжлэн сорьдог тулааны оноо.
 */
export function headToHead(
  mine: ReadonlyMap<string, DayScore>,
  theirs: ReadonlyMap<string, DayScore>
): HeadToHead {
  const result: HeadToHead = { wins: 0, losses: 0, ties: 0, days: 0 };
  for (const [day, my] of mine) {
    const their = theirs.get(day);
    if (!their) continue;
    result.days += 1;
    const { outcome } = compareScores(my, their);
    if (outcome === 'win') result.wins += 1;
    else if (outcome === 'loss') result.losses += 1;
    else result.ties += 1;
  }
  return result;
}

// ─── Цуврал (streak) ───

export interface StreakState {
  streakDays: number;
  bestStreak: number;
  /** Сүүлд ӨӨРИЙН өдрийн тавыг тоглосон UB огноо */
  lastActiveDate: string | null;
}

/**
 * Өнөөдрийн тавыг дуусгасны дараах цуврал.
 *
 * ⚠ Зөвхөн ТУХАЙН ӨДРИЙН багцыг тэр өдөрт нь тоглоход тооцогдоно.
 *   Найзын өчигдрийн сорилтыг өнөөдөр тоглох нь цувралд нөлөөлөхгүй.
 */
export function advanceStreak(
  state: StreakState,
  todayKey: string
): StreakState & { increased: boolean } {
  if (state.lastActiveDate === todayKey) return { ...state, increased: false };

  let streakDays = 1;
  if (state.lastActiveDate !== null) {
    const gap = daysBetweenUb(state.lastActiveDate, todayKey);
    // Ирээдүйн огноо — цаг хуурсан байж болзошгүй, өөрчлөхгүй
    if (gap <= 0) return { ...state, increased: false };
    if (gap === 1) streakDays = state.streakDays + 1;
  }

  return {
    streakDays,
    bestStreak: Math.max(state.bestStreak, streakDays),
    lastActiveDate: todayKey,
    increased: true,
  };
}

/**
 * Дэлгэцэд харуулах цуврал. Өчигдөр тоглоод өнөөдөр хараахан тоглоогүй бол
 * цуврал «амьд» хэвээр; түүнээс өмнө бол тасарсан.
 */
export function visibleStreak(state: StreakState, todayKey: string): number {
  if (state.lastActiveDate === null) return 0;
  const gap = daysBetweenUb(state.lastActiveDate, todayKey);
  return gap === 0 || gap === 1 ? state.streakDays : 0;
}

// ─── Форматлалт ───

/** 38 сек · 1 мин 05 сек */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec} сек`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min} мин ${String(sec).padStart(2, '0')} сек`;
}
