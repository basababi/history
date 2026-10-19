/* eslint-disable no-console -- CLI: гаралт нь зориудын */
/**
 * Production migration — `npm run db:deploy` (docs/DEPLOY.md)
 *
 * Drizzle-ийн migrator: хэрэгжсэн migration-ыг `drizzle.__drizzle_migrations`
 * хүснэгтэд бүртгэж, зөвхөн ШИНИЙГ ажиллуулна. Гараар SQL хуулж
 * ажиллуулах шаардлагагүй — алгасах, давхар ажиллуулах эрсдэлгүй.
 *
 * ⚠ Neon-ий pooler (PgBouncer) дээр DDL найдваргүй тул шууд холболтыг
 *   (`DATABASE_URL_UNPOOLED` — Vercel–Neon интеграц автоматаар тавьдаг)
 *   түрүүлж ашиглана.
 * ⚠ Локал `npm run db:dev` өөрийн бүртгэлтэй — энэ тушаал түүнд хэрэггүй.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { loadEnv, requireDatabaseUrl } from './env';

const here = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_FOLDER = path.resolve(here, '../drizzle');

async function appliedCount(db: ReturnType<typeof drizzle>): Promise<number> {
  try {
    const rows = await db.execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
    return rows[0]?.n ?? 0;
  } catch {
    return 0; // Анхны удаа — бүртгэлийн хүснэгт хараахан алга
  }
}

async function main() {
  loadEnv();
  const url = process.env.DATABASE_URL_UNPOOLED || requireDatabaseUrl();
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return '(буруу URL)';
    }
  })();

  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client);
  try {
    const before = await appliedCount(db);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    const after = await appliedCount(db);
    console.log(`${host}: ${after - before} шинэ migration хэрэглэгдлээ (нийт ${after}).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration амжилтгүй:', err instanceof Error ? err.message : err);
  process.exit(1);
});
