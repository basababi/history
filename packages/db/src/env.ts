/**
 * Орчны хувьсагч ачаалагч — repo-ийн ҮНДСЭН `.env` файлыг уншина.
 *
 * `packages/db` нь Next.js-ийн гадна ажилладаг (drizzle-kit, tsx seed) тул
 * `.env`-ийг өөрөө ачаалах ёстой. Үгүй бол баримтжуулсан урсгал
 * (`cp .env.example .env` → `npm run db:seed`) ажиллахгүй.
 */
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../../..');

/** Repo-ийн үндсэн .env-ийг ачаална (аль хэдийн тохирсныг дарж бичихгүй) */
export function loadEnv(): void {
  for (const name of ['.env.local', '.env']) {
    const file = path.join(ROOT, name);
    if (fs.existsSync(file)) config({ path: file });
  }
}

/** DATABASE_URL-ыг шаардана; байхгүй эсвэл буруу бол тодорхой заавартай алдаа */
export function requireDatabaseUrl(): string {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL тохируулагдаагүй байна.\n\n' +
        '  1) cp .env.example .env\n' +
        '  2) .env дотор DATABASE_URL-аа бичнэ үү\n\n' +
        'Локал ӨС-гүй бол:  npm run db:dev   (суулгах шаардлагагүй Postgres)\n' +
        'Railway production:  npm run db:deploy:prod'
    );
  }
  return assertPostgresUrl(url);
}

/** postgres.js-д өгөх URL — буруу мөрөнд `Invalid URL` биш, заавар өгнө */
export function assertPostgresUrl(url: string): string {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      'DATABASE_URL буруу (Invalid URL). Clipboard дээр бүтэн postgresql://… холбоос байх ёстой.\n' +
        'Railway → Postgres → Variables → DATABASE_PUBLIC_URL-ийг хуулаад:\n' +
        '  npm run db:deploy:prod'
    );
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error(
      `DATABASE_URL postgres:// эсвэл postgresql://-ээр эхлэх ёстой (одоо: ${parsed.protocol}).`
    );
  }
  if (!parsed.hostname) {
    throw new Error('DATABASE_URL-д PostgreSQL серверийн hostname алга.');
  }
  return trimmed;
}

export function isLocalDatabaseHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === '127.0.0.1' || host === 'localhost';
  } catch {
    return false;
  }
}

/** Алсын Postgres (Railway public proxy) SSL шаарддаг; локал PGlite/Postgres үгүй */
export function postgresConnectOptions(url: string): { max: 1; ssl: false | 'require' } {
  return {
    max: 1,
    ssl: isLocalDatabaseHost(url) ? false : 'require',
  };
}
