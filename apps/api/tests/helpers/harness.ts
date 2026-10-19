/**
 * API route-уудыг БОДИТ Postgres (PGlite) дээр ажиллуулах тестийн орчин.
 *
 * `@/lib/db`-г PGlite рүү сольж, route handler-үүдийг жинхэнэ `Request`-ээр
 * дуудна. Ингэснээр урсгал бүхэлдээ — token, ӨС-ийн хязгаарлалт, оноолт,
 * unlock — бодитоор шалгагдана.
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(here, '../../../../packages/db/drizzle');

export async function makeDb() {
  const client = new PGlite();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  if (files.length === 0) {
    throw new Error('Migration олдсонгүй — `npm run db:migrate` ажиллуулна уу.');
  }

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    for (const raw of sql.split('--> statement-breakpoint')) {
      const stmt = raw.trim();
      if (stmt.length > 0) await client.exec(stmt);
    }
  }

  return { client, db: drizzle(client) };
}

/** JSON body-той POST хүсэлт (dev auth толгойтой) */
export function postReq(url: string, body: unknown, userId = 1): Request {
  return new Request(`http://test.local${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-dev-user': String(userId) },
    body: JSON.stringify(body),
  });
}

export function getReq(url: string, userId = 1): Request {
  return new Request(`http://test.local${url}`, {
    method: 'GET',
    headers: { 'x-dev-user': String(userId) },
  });
}


export async function json<T = Record<string, unknown>>(
  res: Response
): Promise<T> {
  return (await res.json()) as T;
}
