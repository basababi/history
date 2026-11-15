/* eslint-disable no-console -- CLI seed скрипт: гаралт нь зориудын */
/**
 * Seed CLI — Бүлэг 7.1 (Phase 0, ажил 0.2 + 0.5)
 * Ажиллуулах: npm run db:seed
 *
 * Логик нь `seed/run.ts` дотор — бодит Postgres дээр тесттэй.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { postgresConnectOptions, requireDatabaseUrl } from '../env';
import { seedAll } from './run';

async function main() {
  const url = requireDatabaseUrl();
  const client = postgres(url, postgresConnectOptions(url));
  const db = drizzle(client);

  console.log('Seed эхэлж байна…');
  const r = await seedAll(db);

  console.log(`  ✓ ${r.eras} эрин`);
  console.log(`  ✓ ${r.heroes} баатар`);
  console.log(`  ✓ ${r.artifacts} олдвор`);
  console.log(`  ✓ ${r.questions} асуулт`);
  console.log(`  ✓ ${r.knowledge} мэдлэгийн хэсэг`);
  console.log(`  ✓ ${r.gerItems} гэрийн эд зүйл`);

  for (const name of r.skippedKnowledge) {
    console.warn(`  ⚠ Баатар олдсонгүй, chunk алгаслаа: ${name}`);
  }

  console.log('\n✓ Seed дууслаа.');
  console.log(
    '\n⚠ АНХААР: Бүлэг 6.2-ын дагуу асуулт бүрийг МЭРГЭЖЛИЙН ТҮҮХЧЭЭР\n' +
      '  хянуулах шаардлагатай. Одоогийн багц нь Phase 0-ийн суурь бөгөөд\n' +
      `  ажиллах бүтээгдэхүүнд 300–500 асуулт хэрэгтэй (одоо ${r.questions}).`
  );

  await client.end();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
