/* eslint-disable no-console -- CLI хэрэгсэл: гаралт нь зориудын */
/**
 * Локал хөгжүүлэлтийн Postgres — суулгах шаардлагагүй.
 *
 * PGlite (WASM Postgres)-ийг TCP socket дээр үйлчлүүлснээр `postgres-js`,
 * `psql` зэрэг ердийн клиент холбогдоно. Neon-д бүртгүүлэхгүйгээр бүх
 * стекийг ажиллуулах боломж өгнө.
 *
 *   npm run db:dev
 *
 * Өгөгдөл `packages/db/.pgdata` дотор хадгалагдана (git-д орохгүй).
 * Эхний ажиллагаанд migration + seed автоматаар хийгдэнэ.
 */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { drizzle } from 'drizzle-orm/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedAll } from './seed/run';

const here = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(here, '..');
const DATA_DIR = path.join(PKG_ROOT, '.pgdata');
const MIGRATIONS_DIR = path.join(PKG_ROOT, 'drizzle');

const HOST = '127.0.0.1';

/**
 * Оролдох портууд.
 *
 * ⚠ Windows дээр Hyper-V / WSL / Docker / Android эмулятор нь портын
 * мужуудыг динамикаар нөөцөлдөг (`netsh interface ipv4 show
 * excludedportrange`). Нөөцлөгдсөн порт нь СУЛ харагдавч `EACCES`
 * буцаадаг тул нэг порт хатуу кодлох нь эмзэг.
 */
const PORT_CANDIDATES = process.env.DB_DEV_PORT
  ? [Number(process.env.DB_DEV_PORT)]
  : [54321, 55432, 49152, 45432, 5433];

/**
 * Хийгдсэн migration-ы бүртгэл.
 *
 * ⚠ АЛДААНЫ ЗАСВАР: өмнө нь энэ функц бүх `.sql` файлыг ажиллах болгондоо
 * дахин гүйцэтгэдэг байсан бөгөөд юу хийгдсэнийг огт бүртгэдэггүй байв.
 * Энэ нь зөвхөн АЗААР ажиллаж байсан — `0000` нь хуучин drizzle-kit-ээр
 * үүссэн тул `CREATE TABLE IF NOT EXISTS` хэлбэртэй байлаа. `0001`-ээс
 * хойш drizzle-kit нь `IF NOT EXISTS`-гүй `CREATE TABLE` үүсгэдэг тул
 * ХОЁР ДАХЬ ажиллагаанд `42P07 relation already exists` алдаа өгдөг байв.
 *
 * Одоо тагийг бүртгэж, шинээр нэмэгдсэнийг л гүйцэтгэнэ.
 */
const MIGRATIONS_TABLE = '_dev_migrations';

async function appliedTags(client: PGlite): Promise<Set<string>> {
  await client.exec(`
    CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
      tag        text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  const res = await client.query<{ tag: string }>(`SELECT tag FROM "${MIGRATIONS_TABLE}"`);
  return new Set(res.rows.map((r) => r.tag));
}

async function applyMigrations(client: PGlite): Promise<number> {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error('Migration олдсонгүй — `npm run db:migrate` ажиллуулна уу.');
  }
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const done = await appliedTags(client);

  /**
   * ⚠ Хуучин `.pgdata`-г аврах: бүртгэл хоосон мөртлөө хүснэгтүүд аль
   * хэдийн байвал энэ нь засвараас ӨМНӨ үүссэн сан гэсэн үг. Дахин
   * үүсгэвэл унана — тиймээс бүх файлыг «хийгдсэн» гэж тэмдэглээд
   * алгасна. Схем нь аль хэдийн бүрэн байгаа тул өгөгдөл алдагдахгүй.
   */
  if (done.size === 0) {
    const existing = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name <> '${MIGRATIONS_TABLE}'`
    );
    if ((existing.rows[0]?.n ?? 0) > 0) {
      for (const file of files) {
        await client.query(`INSERT INTO "${MIGRATIONS_TABLE}" (tag) VALUES ($1)`, [file]);
      }
      console.log(
        `  ↻ Хуучин .pgdata илрэв — ${files.length} migration бүртгэлд нэмэгдэв (дахин ажиллуулаагүй)`
      );
      return 0;
    }
  }

  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    for (const raw of sql.split('--> statement-breakpoint')) {
      const stmt = raw.trim();
      if (stmt.length > 0) await client.exec(stmt);
    }
    await client.query(`INSERT INTO "${MIGRATIONS_TABLE}" (tag) VALUES ($1)`, [file]);
    applied += 1;
  }
  return applied;
}

/**
 * ӨС-ийг нээнэ. Өгөгдлийн хавтас эвдэрсэн бол (процесс албадан хаагдсан,
 * бичиж байх үед унтарсан г.м.) PGlite ойлгомжгүй `RuntimeError: Aborted()`
 * шидэж, апп бүрмөсөн ажиллахаа болино.
 *
 * Тиймээс эвдэрсэн хавтсыг УСТГАХГҮЙ, хажуу тийш зөөгөөд шинийг үүсгэнэ —
 * dev өгөгдөл ямар ч байсан seed-ээс сэргэдэг тул алдагдах зүйлгүй.
 */
async function openDb(): Promise<{ client: PGlite; recreated: boolean }> {
  try {
    const client = new PGlite(DATA_DIR);
    await client.waitReady;
    return { client, recreated: false };
  } catch (err) {
    if (!fs.existsSync(DATA_DIR)) throw err;

    console.warn('');
    console.warn('  ⚠ Өгөгдлийн хавтас эвдэрсэн байна (процесс албадан хаагдсан байх).');

    // Windows дээр унасан PGlite файлын бариулаа шууд суллахгүй тул
    // rename/rm хоёулаа EPERM өгч болно. Гурван шатлалаар оролдоно.
    const backup = `${DATA_DIR}.corrupt-${Date.now()}`;
    let cleared = false;

    try {
      fs.renameSync(DATA_DIR, backup);
      console.warn(`    Хуучныг хадгаллаа: ${path.basename(backup)}`);
      cleared = true;
    } catch {
      try {
        fs.rmSync(DATA_DIR, { recursive: true, force: true });
        console.warn('    Эвдэрсэн хавтсыг устгав.');
        cleared = true;
      } catch {
        // доор тодорхой заавар өгнө
      }
    }

    if (!cleared) {
      console.warn('');
      throw new Error(
        'Эвдэрсэн өгөгдлийн хавтсыг цэвэрлэж чадсангүй (файл ашиглагдаж байна).\n\n' +
          '  1) Бүх node процессыг хаа (энэ терминал болон бусад)\n' +
          '  2) npm run db:reset\n' +
          '  3) npm run db:dev'
      );
    }

    console.warn('    Шинэ ӨС үүсгэж, seed-ийг дахин ажиллуулна.');
    console.warn('');

    const client = new PGlite(DATA_DIR);
    await client.waitReady;
    return { client, recreated: true };
  }
}

/**
 * Сул бөгөөд ЗӨВШӨӨРӨГДСӨН порт дээр сонсоно.
 *
 * `EADDRINUSE` — порт эзлэгдсэн; `EACCES` — Windows нөөцөлсөн муж.
 * Хоёуланд нь дараагийн нэр дэвшигч рүү шилжинэ.
 */
async function listenOnFreePort(
  client: PGlite
): Promise<{ server: PGLiteSocketServer; port: number }> {
  const failures: string[] = [];

  for (const port of PORT_CANDIDATES) {
    const server = new PGLiteSocketServer({ db: client, port, host: HOST });
    try {
      await server.start();
      return { server, port };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'EADDRINUSE' || code === 'EACCES') {
        failures.push(
          `${port} — ${code === 'EACCES' ? 'систем нөөцөлсөн' : 'ашиглагдаж байна'}`
        );
        continue;
      }
      await client.close();
      throw err;
    }
  }

  await client.close();
  throw new Error(
    'Сул порт олдсонгүй:\n' +
      failures.map((f) => `    ${f}`).join('\n') +
      '\n\n  1) npm run dev:stop        — өлгөгдсөн процессыг зогсооно\n' +
      '  2) DB_DEV_PORT=5555 npm run db:dev   — өөрөө порт зааж өгнө'
  );
}

/**
 * Локал ӨС-ийн порт сонгогдсоны дараа `.env`-ийг тааруулна.
 *
 * ЗӨВХӨН манай локал PGlite хаягийг шинэчилнэ. Neon зэрэг бодит
 * холболтын мөрийг ХЭЗЭЭ Ч хөндөхгүй.
 */
function syncEnvPort(url: string): 'updated' | 'matches' | 'external' {
  const repoRoot = path.resolve(PKG_ROOT, '../..');
  const file = path.join(repoRoot, '.env');
  if (!fs.existsSync(file)) return 'external';

  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.trim().startsWith('DATABASE_URL='));
  if (idx < 0) return 'external';

  const current = lines[idx]!.slice(lines[idx]!.indexOf('=') + 1).trim();
  if (current === url) return 'matches';

  // Зөвхөн локал PGlite хэв маягтай мөрийг л солино
  if (!/^postgres:\/\/postgres@127\.0\.0\.1:\d+\/postgres$/.test(current)) {
    return 'external';
  }

  lines[idx] = `DATABASE_URL=${url}`;
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  return 'updated';
}

async function main() {
  const existedBefore = fs.existsSync(DATA_DIR);

  console.log(
    existedBefore
      ? `Локал ӨС ачаалж байна (${path.relative(process.cwd(), DATA_DIR)})…`
      : 'Локал ӨС үүсгэж байна…'
  );

  const { client } = await openDb();

  // Зөвхөн ШИНЭ migration хэрэглэгдэнэ — бүртгэлээр хянана
  const migrations = await applyMigrations(client);
  console.log(
    migrations > 0
      ? `  ✓ ${migrations} шинэ migration хэрэглэгдлээ`
      : '  ✓ Migration шинэчлэлт байхгүй'
  );

  /**
   * Seed-ийг ҮРГЭЛЖ ажиллуулна. `seedAll` нь идемпотент (integration тест
   * 3 удаа дуудаж баталдаг) тул давхардал үүсэхгүй, харин ХУУЧИН `.pgdata`-д
   * шинээр нэмэгдсэн контент (гэрийн эд, өгүүлэмж) орж ирнэ.
   * Өмнө нь зөвхөн `firstRun` үед seed хийдэг байсан тул хуучин сан
   * шинэ контентоос үүрд хоцордог байв.
   */
  const r = await seedAll(drizzle(client));
  console.log(
    `  ✓ Seed: ${r.eras} эрин · ${r.heroes} баатар · ${r.artifacts} олдвор · ` +
      `${r.questions} асуулт · ${r.knowledge} мэдлэг · ${r.gerItems} гэрийн эд`
  );

  const { server, port } = await listenOnFreePort(client);
  const PORT = port;

  const url = `postgres://postgres@${HOST}:${PORT}/postgres`;

  console.log('');
  console.log('  Локал Postgres бэлэн:');
  console.log(`    ${url}`);
  console.log('');

  switch (syncEnvPort(url)) {
    case 'matches':
      console.log('  ✓ .env энэ ӨС рүү заасан байна');
      break;
    case 'updated':
      console.log(`  ✓ .env-ийн DATABASE_URL-ыг ${PORT} порт руу шинэчиллээ`);
      console.log('    (өмнөх порт систем нөөцөлсөн эсвэл эзлэгдсэн байсан)');
      break;
    case 'external':
      console.log('  ⚠ .env өөр ӨС рүү заасан байна — хөндөөгүй.');
      console.log('    Локал ӨС ашиглах бол дараах мөрийг тавина уу:');
      console.log(`      DATABASE_URL=${url}`);
      break;
  }

  console.log('');
  console.log('  Дараагийн алхам — ӨӨР терминал дээр:');
  console.log('      npm run dev:api        http://localhost:3001');
  console.log('      npm run dev:mobile     Expo (эмулятор/утас)');
  console.log('      npm run dev:web        хөтөч');

  console.log('');
  console.log('  Зогсоох: Ctrl+C');

  const shutdown = async () => {
    console.log('\nЗогсож байна…');
    await server.stop();
    await client.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Локал ӨС эхлүүлэхэд алдаа гарлаа:', err);
  process.exit(1);
});
