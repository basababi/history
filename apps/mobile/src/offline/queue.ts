/**
 * Офлайн дараалал — ВЭБ хувилбар (Бүлэг 6.6)
 *
 * `expo-sqlite` нь вэб дээр байхгүй тул `localStorage` ашиглана.
 * Metro нь native платформ дээр `queue.native.ts`-ийг автоматаар сонгоно;
 * энэ файл зөвхөн вэб дээр ачаалагдана.
 *
 * Интерфэйс нь native хувилбартай ЯГ ИЖИЛ — дуудагч тал ялгааг мэдэхгүй.
 *
 * ⚠ `localStorage` нь SQLite шиг найдвартай биш (5–10MB хязгаартай, хувийн
 * цонхонд хоосон байж болно) тул бүх уншилт/бичилтийг хамгаалсан.
 */
import type { OfflineAttempt, ServedQuestion } from '@nomad/contracts';

const ATTEMPTS_KEY = 'nomad.offline.attempts';
const PACK_KEY = 'nomad.offline.pack';

interface StoredAttempt extends OfflineAttempt {
  rowId: number;
}

interface StoredPack {
  packDate: string;
  expiresAt: number;
  questions: ServedQuestion[];
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Хадгалах зай дүүрсэн эсвэл хувийн цонх — чимээгүй алгасна
  }
}

// ─── Хүлээгдэж буй хариултууд ───

export async function enqueueAttempt(attempt: OfflineAttempt): Promise<void> {
  const list = read<StoredAttempt[]>(ATTEMPTS_KEY, []);

  // UNIQUE(question_id, answered_at) — native SQLite-тай ижил дүрэм
  const exists = list.some(
    (a) => a.questionId === attempt.questionId && a.answeredAt === attempt.answeredAt
  );
  if (exists) return;

  const rowId = list.reduce((max, a) => Math.max(max, a.rowId), 0) + 1;
  list.push({ ...attempt, rowId });
  write(ATTEMPTS_KEY, list);
}

export async function getPendingAttempts(): Promise<StoredAttempt[]> {
  return read<StoredAttempt[]>(ATTEMPTS_KEY, [])
    .slice()
    .sort((a, b) => a.answeredAt - b.answeredAt)
    .slice(0, 200);
}

export async function clearAttempts(rowIds: number[]): Promise<void> {
  if (rowIds.length === 0) return;
  const drop = new Set(rowIds);
  write(
    ATTEMPTS_KEY,
    read<StoredAttempt[]>(ATTEMPTS_KEY, []).filter((a) => !drop.has(a.rowId))
  );
}

export async function pendingCount(): Promise<number> {
  return read<StoredAttempt[]>(ATTEMPTS_KEY, []).length;
}

/** 24 цагаас хэтэрсэн хариултууд — сервер ямар ч байсан татгалзана */
export async function pruneStaleAttempts(now = Date.now()): Promise<number> {
  const cutoff = now - 24 * 60 * 60 * 1000;
  const list = read<StoredAttempt[]>(ATTEMPTS_KEY, []);
  const kept = list.filter((a) => a.answeredAt >= cutoff);
  if (kept.length !== list.length) write(ATTEMPTS_KEY, kept);
  return list.length - kept.length;
}

// ─── Кэшлэсэн багц ───

export async function saveOfflinePack(
  packDate: string,
  expiresAt: number,
  questions: ServedQuestion[]
): Promise<void> {
  write(PACK_KEY, { packDate, expiresAt, questions } satisfies StoredPack);
}

export async function loadOfflinePack(
  now = Date.now()
): Promise<ServedQuestion[]> {
  const pack = read<StoredPack | null>(PACK_KEY, null);
  if (!pack || pack.expiresAt <= now) return [];
  return pack.questions;
}

export async function clearOfflineData(): Promise<void> {
  try {
    globalThis.localStorage?.removeItem(ATTEMPTS_KEY);
    globalThis.localStorage?.removeItem(PACK_KEY);
  } catch {
    // алгасна
  }
}
