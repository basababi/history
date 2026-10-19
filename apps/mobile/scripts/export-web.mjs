/* eslint-disable no-console -- build скрипт: гаралт нь зориудын */
/**
 * Вэб аппыг экспортолж Next (apps/api)-ийн `public/`-д байрлуулна.
 *
 *   npm run build:web
 *
 * Үр дүн: нэг домэйн дээр вэб апп + API. `apps/api/public/` нь build-ийн
 * бүтээгдэхүүн (git-д орохгүй).
 *
 * Орчны хувьсагч:
 *   PUBLIC_WEB_URL  — сайтын хаяг (https://ertniiov.mn). Нүүр хуудасны OG
 *                     зурагт абсолют хаяг хэрэгтэй. Байхгүй бол Vercel-ийн
 *                     VERCEL_PROJECT_PRODUCTION_URL → VERCEL_URL.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mobileDir = path.resolve(here, '..');
const outDir = path.resolve(mobileDir, '../api/public');

console.log(`Вэб экспорт → ${path.relative(process.cwd(), outDir) || outDir}`);

execSync(`npx expo export --platform web --output-dir "${outDir}"`, {
  cwd: mobileDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    // Вэб нь API-тай нэг домэйн дээр — клиент өөрийн гарлыг ашиглана
    EXPO_PUBLIC_API_URL: 'same-origin',
    NODE_ENV: 'production',
  },
});

const indexFile = path.join(outDir, 'index.html');
if (!fs.existsSync(indexFile)) {
  console.error('index.html үүссэнгүй — экспорт бүтэлгүйтэв');
  process.exit(1);
}

/**
 * Сайтын абсолют хаяг. Vercel дээр тохируулаагүй бол төслийн production
 * домэйн, эсвэл тухайн deploy-ийн хаяг (staging-д ч OG карт ажиллана).
 */
function resolvePublicUrl() {
  if (process.env.PUBLIC_WEB_URL) return process.env.PUBLIC_WEB_URL;
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return vercelHost ? `https://${vercelHost}` : '';
}

const publicUrl = resolvePublicUrl().replace(/\/$/, '');
if (!publicUrl) console.warn('⚠ PUBLIC_WEB_URL байхгүй — нүүр хуудасны OG зураг харьцангуй хаягтай (Messenger харуулахгүй)');
const html = fs.readFileSync(indexFile, 'utf8').replaceAll('__PUBLIC_WEB_URL__', publicUrl);
fs.writeFileSync(indexFile, html);

const bundles = fs
  .readdirSync(path.join(outDir, '_expo/static/js/web'))
  .map((f) => fs.statSync(path.join(outDir, '_expo/static/js/web', f)).size)
  .reduce((a, b) => a + b, 0);

console.log(`✓ Вэб апп бэлэн (JS ${(bundles / 1024 / 1024).toFixed(2)} MB${publicUrl ? `, ${publicUrl}` : ''})`);
