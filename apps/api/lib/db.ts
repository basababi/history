/**
 * PostgreSQL холболт — Railway (Сингапур, Vercel-ийн `sin1`-тэй нэг бүс), Drizzle ORM.
 * Neon эсвэл өөр Postgres-т ч өөрчлөлтгүй ажиллана — зөвхөн DATABASE_URL.
 *
 * ⚠ Холболтыг ЗАЛХУУ (lazy) үүсгэнэ. Модуль ачаалагдах үед холбогдвол:
 *   - `next build`-ийн «Collecting page data» алхам унана
 *   - env дутуу үед импортын үед л задарч, цэвэр алдаа буцаах боломжгүй болно
 * Тиймээс эхний асуулга хийх үед л pool үүснэ.
 */
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { assertPostgresUrl, postgresConnectOptions } from '@nomad/db';

/** Холболтын мөр байгаа эсэх — route дотор урьдчилж шалгаж болно */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

const globalForDb = globalThis as unknown as {
  __nomadSql?: ReturnType<typeof postgres>;
  __nomadDb?: PostgresJsDatabase;
};

function connect(): PostgresJsDatabase {
  if (globalForDb.__nomadDb) return globalForDb.__nomadDb;

  const configuredUrl = process.env.DATABASE_URL;
  if (!configuredUrl) {
    throw new Error(
      'DATABASE_URL тохируулагдаагүй байна. apps/api/.env файлаа шалгана уу.'
    );
  }
  const url = assertPostgresUrl(configuredUrl);

  // `max: 1` — serverless instance бүр НЭГ холболт. Railway-д pooler байхгүй тул
  //   олон instance зэрэг асахад Postgres-ийн холболтын хязгаар (100) дүүрэхээс
  //   сэргийлнэ. `idle_timeout` — сул instance холболтоо 20 секундэд суллана.
  const sql =
    globalForDb.__nomadSql ??
    postgres(url, { ...postgresConnectOptions(url), idle_timeout: 20 });

  const instance = drizzle(sql);

  // ⚠ АЛДААНЫ ЗАСВАР (2026-10): өмнө нь зөвхөн production БИШ үед кэшилдэг
  //   байсан тул production-д `db.*` хандалт БҮРТ шинэ холболтын pool үүсч
  //   байв — асуулга бүрт шинэ TCP/TLS холболт, Neon-ы холболтын хязгаар
  //   хурдан дүүрнэ. Одоо instance бүрд НЭГ pool (serverless instance
  //   дахин ашиглагдахад ч хэвээр), dev-ийн hot reload-д ч мөн адил.
  globalForDb.__nomadSql = sql;
  globalForDb.__nomadDb = instance;

  return instance;
}

/**
 * `db` нь Proxy — эхний ашиглалт хүртэл холбогдохгүй.
 * Дуудлагын хэлбэр өөрчлөгдөхгүй: `db.select()...` хэвээр.
 */
export const db = new Proxy({} as PostgresJsDatabase, {
  get(_target, prop, receiver) {
    const real = connect();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});
