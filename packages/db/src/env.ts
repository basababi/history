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

/** DATABASE_URL-ыг шаардана; байхгүй бол тодорхой заавартай алдаа */
export function requireDatabaseUrl(): string {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL тохируулагдаагүй байна.\n\n' +
        '  1) cp .env.example .env\n' +
        '  2) .env дотор DATABASE_URL-аа бичнэ үү\n\n' +
        'Локал ӨС-гүй бол:  npm run db:dev   (суулгах шаардлагагүй Postgres)'
    );
  }
  return url;
}
