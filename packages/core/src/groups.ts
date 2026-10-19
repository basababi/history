/**
 * Найзын бүлэг — найзууд, гэр бүл, анги, клуб
 *
 * Бүлгийн гишүүд өдөр бүр ижил тавыг тоглоод долоо хоногоор жагсана.
 * ЧӨЛӨӨТ БИЧВЭР БАЙХГҮЙ (чат, сэтгэгдэл) — модерацийн эрсдэл нэмэгдэхгүй.
 */
import { normalizeDisplayName } from './mongolian';

export const GROUP_MAX_MEMBERS = 50;
export const GROUP_MAX_PER_USER = 10;
export const GROUP_NAME_MIN = 2;
export const GROUP_NAME_MAX = 40;

export function normalizeGroupName(raw: string): string {
  return normalizeDisplayName(raw).slice(0, GROUP_NAME_MAX);
}

export function isValidGroupName(name: string): boolean {
  const n = normalizeGroupName(name);
  return [...n].length >= GROUP_NAME_MIN && /\p{L}|\p{N}/u.test(n);
}

export interface WeekTally {
  userId: number;
  /** Энэ долоо хоногийн нийт зөв хариулт */
  correct: number;
  /** Энэ долоо хоногт тоглосон өдөр */
  daysPlayed: number;
  /** Нийт хугацаа (мс) — зөвхөн эрэмбийн тэнцлийг шийднэ */
  totalMs: number;
}

export interface RankedTally extends WeekTally {
  rank: number;
}

/**
 * Долоо хоногийн чансаа.
 *
 *   1. Нийт зөв хариулт (их нь дээр)
 *   2. Тоглосон өдөр (тогтвортой тоглосон нь дээр)
 *   3. Хугацаа (хурдан нь дээр) — зөвхөн дараалалд, байранд биш
 *
 * ⚠ Тоглоогүй гишүүн ч 0-ээр ЖАГСААЛТАД ОРНО — өөрийгөө олж харахгүй
 *   хүн дараагийн өдөр эргэж ирэхгүй.
 */
export function rankWeek(tallies: readonly WeekTally[]): RankedTally[] {
  const sorted = [...tallies].sort(
    (a, b) =>
      b.correct - a.correct ||
      b.daysPlayed - a.daysPlayed ||
      a.totalMs - b.totalMs ||
      a.userId - b.userId
  );

  const out: RankedTally[] = [];
  sorted.forEach((t, i) => {
    const prev = out[i - 1];
    const sameAsPrev =
      prev !== undefined && prev.correct === t.correct && prev.daysPlayed === t.daysPlayed;
    out.push({ ...t, rank: sameAsPrev ? prev.rank : i + 1 });
  });
  return out;
}
