/**
 * Монгол хэлний харагдах формат — огноо, тулааны оноо, хувь
 */
import type { DuelRecord } from '@nomad/contracts';

const WEEKDAYS = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];

/** 2026-10-20 → «10-р сарын 20» */
export function formatDayLabel(dayKey: string): string {
  const [, m, d] = dayKey.split('-');
  return `${Number(m)}-р сарын ${Number(d)}`;
}

/** 2026-10-20 → «Мягмар, 10-р сарын 20» */
export function formatDayLong(dayKey: string): string {
  const weekday = WEEKDAYS[new Date(`${dayKey}T00:00:00Z`).getUTCDay()] ?? '';
  return `${weekday}, ${formatDayLabel(dayKey)}`;
}

/** 0.62 → «62%» */
export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** 4 210 мс → «4.2 сек» */
export function formatSeconds(ms: number): string {
  const s = ms / 1000;
  return `${s < 10 ? s.toFixed(1) : Math.round(s)} сек`;
}

/** Тулааны оноо — «3–2» (тэнцээ байвал «3–2–1») */
export function formatRecord(r: DuelRecord): string {
  return r.ties > 0 ? `${r.wins}–${r.losses}–${r.ties}` : `${r.wins}–${r.losses}`;
}

/**
 * «128 хүнээс 23-р байр»
 *
 * ⚠ «23-т / 25-д» мэт тийн залгавар тооны дуудлагаас хамаардаг тул эрэмбийн
 *   «-р» хэлбэрийг ашиглана — бүх тоонд зөв.
 */
export function formatRank(position: number, players: number): string {
  if (players <= 1) return 'Өнөөдрийн анхны тоглогч';
  return `${players} хүнээс ${position}-р байр`;
}
