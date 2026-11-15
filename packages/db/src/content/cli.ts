/* eslint-disable no-console -- CLI: гаралт нь зориудын */
/**
 * Агуулгын CLI — docs/CONTENT.md
 *
 *   npm run content:check                  CSV-г шалгана (ӨС хэрэггүй — CI)
 *   npm run content:import -- --dry-run    юу өөрчлөгдөхийг харуулна
 *   npm run content:import                 DATABASE_URL руу оруулна
 *   npm run content:runway                 шинэ асуултын нөөц хэдэн өдөр
 *
 * Файл заагаагүй бол `content/questions.csv`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eras } from '../schema';
import { postgresConnectOptions, requireDatabaseUrl } from '../env';
import { railwayPublicUrl } from '../railwayPublicUrl';
import { contentRunway, importQuestions } from './importer';
import { DAILY_NEED, freshDays, readQuestionCsv, type ContentIssue, type ContentReadResult } from './questions';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../../../..');
const DEFAULT_FILE = path.join(ROOT, 'content', 'questions.csv');

/** Шинэ асуултын нөөц үүнээс доош бол анхааруулна (docs/CONTENT.md: 30 хоног) */
const RUNWAY_TARGET_DAYS = 30;

function resolveFile(arg: string | undefined): string {
  if (!arg) return DEFAULT_FILE;
  // `npm run -w` cwd-г багц руу шилжүүлдэг — хэрэглэгчийн байсан хавтаснаас
  return path.resolve(process.env.INIT_CWD ?? process.cwd(), arg);
}

function printIssues(title: string, issues: ContentIssue[], limit = 50) {
  if (issues.length === 0) return;
  console.log(`\n${title} (${issues.length}):`);
  for (const i of issues.slice(0, limit)) {
    const where = [`мөр ${i.line}`, i.key, i.column].filter(Boolean).join(' · ');
    console.log(`  ${where}: ${i.message}`);
  }
  if (issues.length > limit) console.log(`  … дахиад ${issues.length - limit}`);
}

function check(file: string): ContentReadResult {
  if (!fs.existsSync(file)) {
    console.error(`Файл олдсонгүй: ${file}`);
    process.exit(1);
  }
  const result = readQuestionCsv(fs.readFileSync(file, 'utf8'));
  const { questions, errors, warnings } = result;

  const count = (pred: (q: (typeof questions)[number]) => boolean) => questions.filter(pred).length;
  console.log(`${path.relative(ROOT, file)} — ${questions.length} асуулт`);
  console.log(
    `  төлөв:     нийтэлсэн ${count((q) => q.status === 'published')} · хянасан ${count((q) => q.status === 'reviewed')} · ноорог ${count((q) => q.status === 'draft')}`
  );
  console.log(
    `  хүндрэл:   амархан ${count((q) => q.difficulty === 'easy')} · дунд ${count((q) => q.difficulty === 'medium')} · хүнд ${count((q) => q.difficulty === 'hard')}`
  );
  console.log(
    `  хэлбэр:    сонгодог ${count((q) => q.format === 'classic')} · үнэн/домог ${count((q) => q.format === 'myth_or_fact')} · зүйр үг ${count((q) => q.format === 'proverb')} · хэрэв ${count((q) => q.format === 'what_if')}`
  );

  printIssues('АЛДАА — засахгүй бол импорт хийгдэхгүй', errors);
  printIssues('Анхааруулга', warnings, 20);
  if (errors.length === 0) console.log('\n✓ Алдаагүй.');
  return result;
}

function contentDatabaseUrl(): string {
  if (process.argv.includes('--from-railway')) return railwayPublicUrl();
  return requireDatabaseUrl();
}

async function withDb<T>(fn: (db: ReturnType<typeof drizzle>) => Promise<T>): Promise<T> {
  const url = contentDatabaseUrl();
  const client = postgres(url, postgresConnectOptions(url));
  try {
    return await fn(drizzle(client));
  } finally {
    await client.end();
  }
}

async function main() {
  const [command = 'check', ...rest] = process.argv.slice(2);
  const flags = new Set(rest.filter((a) => a.startsWith('--')));
  const file = resolveFile(rest.find((a) => !a.startsWith('--')));

  if (command === 'check') {
    const { errors } = check(file);
    process.exit(errors.length > 0 ? 1 : 0);
  }

  if (command === 'import') {
    const { questions, errors } = check(file);
    if (errors.length > 0) process.exit(1);
    const dryRun = flags.has('--dry-run');
    const report = await withDb((db) =>
      importQuestions(db, questions, { dryRun, allowAnswerChange: flags.has('--allow-answer-change') })
    );
    const title = dryRun ? 'Төлөвлөгөө (бичээгүй)' : report.applied ? 'Импорт дууслаа' : 'ИМПОРТ ЦУЦЛАГДЛАА — юу ч бичигдээгүй';
    console.log(`\n${title}:`);
    console.log(
      `  + шинэ ${report.inserted.length} · ~ шинэчилсэн ${report.updated.length} · ⇄ түлхүүртэй болсон ${report.adopted.length} · = өөрчлөлтгүй ${report.unchanged}`
    );
    if (report.updated.length > 0) console.log(`  шинэчилсэн: ${report.updated.join(', ')}`);
    for (const b of report.blocked) console.log(`  ✗ ${b.key}: ${b.reason}`);
    if (report.missingFromCsv.length > 0) {
      console.log(`  ⚠ ӨС-д байгаа боловч CSV-д алга (хөндөөгүй): ${report.missingFromCsv.join(', ')}`);
    }
    process.exit(report.blocked.length > 0 ? 1 : 0);
  }

  if (command === 'runway') {
    const { runway, eraNames } = await withDb(async (db) => ({
      runway: await contentRunway(db),
      eraNames: new Map((await db.select({ id: eras.id, name: eras.name }).from(eras)).map((e) => [e.id, e.name])),
    }));
    const days = freshDays(runway.unused);
    const p = runway.published;
    const u = runway.unused;
    console.log('Нийтлэгдсэн асуулт:');
    console.log(`  амархан ${p.easy} (шинэ ${u.easy}) · дунд ${p.medium} (шинэ ${u.medium}) · хүнд ${p.hard} (шинэ ${u.hard})`);
    console.log(`  хэлбэр: ${Object.entries(runway.byFormat).map(([f, n]) => `${f} ${n}`).join(' · ')}`);
    console.log(
      `  эрин:   ${Object.entries(runway.byEra).map(([id, n]) => `${eraNames.get(Number(id)) ?? id} ${n}`).join(' · ')}`
    );
    console.log(
      `\nШИНЭ АСУУЛТЫН НӨӨЦ: ${days} өдөр (өдөрт ${DAILY_NEED.easy} амархан + ${DAILY_NEED.medium} дунд + ${DAILY_NEED.hard} хүнд)`
    );
    if (runway.unreviewedPublished > 0) {
      console.log(`⚠ ${runway.unreviewedPublished} нийтлэгдсэн асуулт түүхчээр хянуулаагүй`);
    }
    if (days < RUNWAY_TARGET_DAYS) {
      console.log(`⚠ ${RUNWAY_TARGET_DAYS} хоногоос бага — дараа нь систем хуучин асуултыг давтана. Агуулга нэмнэ үү.`);
      process.exit(2);
    }
    process.exit(0);
  }

  console.error(`Танихгүй тушаал: ${command}. check | import | runway`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
