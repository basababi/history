/* eslint-disable no-console -- CLI хэрэгсэл */
/**
 * Локал хөгжүүлэлтийн ӨС-ийг цэвэрлэнэ: `npm run db:reset`
 * Дараагийн `npm run db:dev` шинээр үүсгэж, seed-ийг дахин ажиллуулна.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(here, '..');

let removed = 0;
for (const name of fs.readdirSync(PKG_ROOT)) {
  if (name === '.pgdata' || name.startsWith('.pgdata.corrupt-')) {
    fs.rmSync(path.join(PKG_ROOT, name), { recursive: true, force: true });
    console.log(`  ✓ устгав: ${name}`);
    removed += 1;
  }
}

console.log(
  removed === 0
    ? 'Цэвэрлэх зүйл олдсонгүй.'
    : '\nДараагийн `npm run db:dev` шинэ ӨС үүсгэж seed-ийг ажиллуулна.'
);
