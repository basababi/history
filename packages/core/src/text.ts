/**
 * Кирилл текстийн normalize + Levenshtein — Бүлэг 5.4
 * ө/о, ү/у, ё/е бичлэгийн алдааг нэгтгэж, зай ≤1 бол зөв гэж тооцно.
 */

/** Кирилл normalize: жижиглэх + ө→о, ү→у, ё→е */
export function normalizeMongolian(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/ө/g, 'о')
    .replace(/ү/g, 'у')
    .trim();
}

/** Levenshtein зай — O(min(m,n)) санах ойтой */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length] ?? 0;
}

/**
 * Бичвэрийн хариултын шалгалт: normalize хийсний дараа
 * Levenshtein зай ≤ tolerance бол зөв гэж тооцно (Бүлэг 5.4).
 */
export function isTextAnswerCorrect(
  given: string,
  expected: string,
  tolerance = 1
): boolean {
  const g = normalizeMongolian(given);
  const e = normalizeMongolian(expected);
  return levenshtein(g, e) <= tolerance;
}