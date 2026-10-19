/**
 * Офлайн дараалал — Бүлэг 6.6
 *
 * «Орон нутгийн интернэт холболт тогтворгүй, цахилгааны тасалдал байдаг
 *  нөхцөлийг архитектурт тусгана. Энэ нь техникийн шаардлага төдийгүй
 *  бодит ялгарах давуу тал.» — SDG 4-ийн шууд хувь нэмэр (Бүлэг 8.5).
 *
 * Урсгал: офлайн хариулт → SQLite дараалал → холболт сэргэхэд sync →
 * сервер СЕРВЕРИЙН цагаар дахин баталгаажуулна (≤24 цаг).
 */
import * as SQLite from 'expo-sqlite';
import type { OfflineAttempt, ServedQuestion } from '@nomad/contracts';

const DB_NAME = 'nomad-offline.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS pending_attempts (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          question_id   INTEGER NOT NULL,
          selected_index INTEGER NOT NULL,
          confidence    INTEGER,
          answered_at   INTEGER NOT NULL,
          response_ms   INTEGER NOT NULL,
          UNIQUE(question_id, answered_at)
        );

        CREATE TABLE IF NOT EXISTS cached_pack (
          question_id INTEGER PRIMARY KEY,
          era_id      INTEGER NOT NULL,
          difficulty  TEXT NOT NULL,
          body        TEXT NOT NULL,
          options     TEXT NOT NULL,
          pack_date   TEXT NOT NULL,
          expires_at  INTEGER NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

// ─── Хүлээгдэж буй хариултууд ───

export async function enqueueAttempt(attempt: OfflineAttempt): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO pending_attempts
       (question_id, selected_index, confidence, answered_at, response_ms)
     VALUES (?, ?, ?, ?, ?)`,
    attempt.questionId,
    attempt.selectedIndex,
    attempt.confidenceLevel ?? null,
    attempt.answeredAt,
    attempt.responseMs
  );
}

export async function getPendingAttempts(): Promise<
  Array<OfflineAttempt & { rowId: number }>
> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number;
    question_id: number;
    selected_index: number;
    confidence: number | null;
    answered_at: number;
    response_ms: number;
  }>('SELECT * FROM pending_attempts ORDER BY answered_at ASC LIMIT 200');

  return rows.map((r) => ({
    rowId: r.id,
    questionId: r.question_id,
    selectedIndex: r.selected_index,
    confidenceLevel:
      r.confidence === 1 || r.confidence === 2 || r.confidence === 3
        ? r.confidence
        : undefined,
    answeredAt: r.answered_at,
    responseMs: r.response_ms,
  }));
}

export async function clearAttempts(rowIds: number[]): Promise<void> {
  if (rowIds.length === 0) return;
  const db = await getDb();
  const placeholders = rowIds.map(() => '?').join(',');
  await db.runAsync(
    `DELETE FROM pending_attempts WHERE id IN (${placeholders})`,
    ...rowIds
  );
}

export async function pendingCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM pending_attempts'
  );
  return row?.n ?? 0;
}

/**
 * 24 цагаас хэтэрсэн хариултуудыг устгана — сервер ямар ч байсан
 * татгалзах тул дарааллыг хуримтлуулах утгагүй (Бүлэг 6.6).
 */
export async function pruneStaleAttempts(now = Date.now()): Promise<number> {
  const db = await getDb();
  const cutoff = now - 24 * 60 * 60 * 1000;
  const result = await db.runAsync(
    'DELETE FROM pending_attempts WHERE answered_at < ?',
    cutoff
  );
  return result.changes;
}

// ─── Кэшлэсэн багц ───

export async function saveOfflinePack(
  packDate: string,
  expiresAt: number,
  questions: ServedQuestion[]
): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM cached_pack');
  for (const q of questions) {
    await db.runAsync(
      `INSERT OR REPLACE INTO cached_pack
         (question_id, era_id, difficulty, body, options, pack_date, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      q.id,
      q.eraId,
      q.difficulty,
      q.body,
      JSON.stringify(q.options),
      packDate,
      expiresAt
    );
  }
}

export async function loadOfflinePack(
  now = Date.now()
): Promise<ServedQuestion[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    question_id: number;
    era_id: number;
    difficulty: string;
    body: string;
    options: string;
    expires_at: number;
  }>('SELECT * FROM cached_pack WHERE expires_at > ?', now);

  return rows.map((r) => ({
    id: r.question_id,
    eraId: r.era_id,
    difficulty: r.difficulty as 'easy' | 'medium' | 'hard',
    body: r.body,
    options: JSON.parse(r.options) as string[],
    servedAt: now,
  }));
}

export async function clearOfflineData(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM pending_attempts; DELETE FROM cached_pack;');
}
