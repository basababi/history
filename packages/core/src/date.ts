/**
 * Asia/Ulaanbaatar (UTC+8) огнооны туслагчид — Бүлэг 5.4
 *
 * Дүрэм: бүх timestamp UTC-ээр хадгална; streak-ийн «өдөр»-ийг UB бүсээр тооцно.
 * Монгол 2017 оноос зуны цагийн шилжилтийг хассан тул офсет тогтмол +8.
 */

export const UB_OFFSET_MS = 8 * 60 * 60 * 1000;

/** UTC epoch ms → UB огноо (YYYY-MM-DD) */
export function ubDate(epochMs: number): string {
  return new Date(epochMs + UB_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC epoch ms → UB сар (YYYY-MM) — streak shield болон урилгын лимитэд */
export function ubMonth(epochMs: number): string {
  return new Date(epochMs + UB_OFFSET_MS).toISOString().slice(0, 7);
}

/** UB-аар «өнөөдөр» */
export function todayInUlaanbaatar(now = Date.now()): string {
  return ubDate(now);
}

/** UB-аар «өчигдөр» */
export function yesterdayInUlaanbaatar(now = Date.now()): string {
  return ubDate(now - 24 * 60 * 60 * 1000);
}

/** UB огноог (YYYY-MM-DD) UTC epoch ms болгож буцаана (тухайн UB өдрийн 00:00) */
export function ubDateToUtcMs(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`) - UB_OFFSET_MS;
}

/** Хоёр UB огнооны хоорондох өдрийн зөрүү */
export function daysBetweenUb(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / (24 * 60 * 60 * 1000));
}
