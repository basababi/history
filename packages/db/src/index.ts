/**
 * @nomad/db — Drizzle схем ба seed
 *
 * Гүн зам (`@nomad/db/src/...`) руу импорт хийхгүй — энэ файл л нийтийн
 * гарц. Ингэснээр дотоод бүтэц өөрчлөгдөхөд хэрэглэгчид эвдрэхгүй.
 */
export * from './schema';
export { seedAll, type SeedResult } from './seed/run';
