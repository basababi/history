/**
 * Production migration — drizzle-ийн АЛБАН migrator-оор (PGlite)
 *
 * Бусад тест migration SQL-ийг шууд `exec` хийдэг. Энэ тест харин
 * `npm run db:deploy`-ийн ашигладаг замыг шалгана: журнал (_journal.json)
 * SQL файлуудтай таарч байгаа эсэх, хоёр дахь ажиллагаа юу ч хийхгүй эсэх.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = path.resolve(here, '../drizzle');

const client = new PGlite();
const db = drizzle(client);

afterAll(async () => {
  await client.close();
});

async function applied(): Promise<number> {
  const r = await client.query<{ n: number }>('select count(*)::int as n from drizzle.__drizzle_migrations');
  return r.rows[0]?.n ?? 0;
}

describe('db:deploy — албан migrator', () => {
  it('хоосон ӨС дээр бүх migration журналын дагуу хэрэгжинэ', async () => {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    const journal = (await import('../drizzle/meta/_journal.json')).default as { entries: unknown[] };
    expect(await applied()).toBe(journal.entries.length);
  });

  it('«Өдрийн тав» ба агуулгын хүснэгт, багана бий', async () => {
    const cols = await client.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_name = 'questions'"
    );
    const names = cols.rows.map((r) => r.column_name);
    expect(names).toEqual(expect.arrayContaining(['content_key', 'reviewed_by', 'format']));
    const tables = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'"
    );
    expect(tables.rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining(['daily_sets', 'daily_plays', 'daily_answers', 'friend_groups', 'rivalries'])
    );
  });

  it('🔴 дахин ажиллуулахад юу ч хийхгүй (deploy бүрт аюулгүй)', async () => {
    const before = await applied();
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    expect(await applied()).toBe(before);
  });
});
