/**
 * Бодит Postgres дээр ажилладаг тестийн орчин (PGlite — WASM Postgres).
 *
 * Энэ нь mock БИШ: жинхэнэ migration ажиллаж, жинхэнэ хязгаарлалт,
 * индекс, FK, partial index бүгд хүчинтэй байна. Тиймээс
 * `UNIQUE(session_id, question_id)` зэрэг ӨС-ийн түвшний хамгаалалт
 * бодитоор шалгагдана (Бүлэг 6.1).
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../../src/schema';

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(here, '../../drizzle');

export type TestDb = PgliteDatabase<typeof schema>;

/** Migration SQL-ийг уншиж, statement-breakpoint-оор салгана */
function migrationStatements(): string[] {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    throw new Error(
      'Migration олдсонгүй. Эхлээд `npm run db:migrate` ажиллуулна уу.'
    );
  }

  const out: string[] = [];
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    for (const raw of sql.split('--> statement-breakpoint')) {
      const stmt = raw.trim();
      if (stmt.length > 0) out.push(stmt);
    }
  }
  return out;
}

/** Шинэ, хоосон ӨС үүсгэж migration ажиллуулна */
export async function createTestDb(): Promise<{
  db: TestDb;
  client: PGlite;
  close: () => Promise<void>;
}> {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  for (const stmt of migrationStatements()) {
    await client.exec(stmt);
  }

  return {
    db,
    client,
    close: async () => {
      await client.close();
    },
  };
}
