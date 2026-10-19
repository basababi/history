/**
 * @nomad/core — Хуваалцсан домэйн логик (ADR-005)
 * API болон клиент хоёулаа ашиглана. ЦЭВЭР функц — I/O байхгүй, тесттэй.
 *
 * АНХААРУУЛГА: Эцсийн оноолтыг зөвхөн СЕРВЕР гүйцэтгэнэ (Бүлэг 6.1).
 * Клиент энэ логикийг зөвхөн харагдуулалтад ашиглана.
 */

// ─── «Өдрийн тав» (вэб-д суурилсан бүтээгдэхүүн) ───
export * from './question';
export * from './daily';
export * from './codes';
export * from './groups';
export * from './titles';
export * from './mongolian';
export * from './share';
export * from './date';
export * from './anticheat';

// ─── ⚠ ХУУЧИН модулиуд — шилжилтийн хугацаанд л үлдэнэ ───
// Шинэ код эдгээрээс ИМПОРТЛОХГҮЙ. Хуучин дэлгэц/маршрут устгагдахад
// хамт устгагдана (ROADMAP: «Хуучин кодыг цэвэрлэх»).
export * from './xp';
export * from './rank';
export * from './streak';
export * from './perk';
export * from './text';
export * from './unlock';
export * from './league';
export * from './voice';
export * from './retention';
export * from './battle';
export * from './mediation';
export * from './script';
export * from './contribution';
export * from './playerPath';
export * from './classroom';
export * from './story';
