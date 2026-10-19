/**
 * Сургалтын тогтвортой байдлын хэмжилт — Бүлэг 8.5
 *
 * Салбарын судалгааны зөвхөн 11.1% нь үүнийг хэмждэг (López-Enríquez нар, 2026).
 * Хойшлуулсан шалгалтыг KPI-ийн бүрэлдэхүүн болгосон нь энэ төслийн
 * эрдэм шинжилгээний гол хувь нэмэр.
 *
 * Загвар: Wu & Wang (2026) экспоненциал бууралт (R² = 0.94)
 *   R(t) = exp(−λ · t),  t = долоо хоног
 */

/** Хэмжих цэгүүд (долоо хоног) */
export const PROBE_WEEKS = [2, 4, 8, 12] as const;
export type ProbeWeek = (typeof PROBE_WEEKS)[number];

/** Зорилтот утгууд — Бүлэг 8.5 */
export const RETENTION_TARGETS: Record<ProbeWeek, number> = {
  2: 0.85,
  4: 0.75,
  8: 0.6,
  12: 0.5,
};

export interface ProbeResult {
  week: ProbeWeek;
  /** Анх зөв хариулсан асуултуудаас дахин зөв хариулсан хувь (0..1) */
  retained: number;
  sampleSize: number;
}

/** Хэмжсэн цэгээс λ (бууралтын коэффициент) тооцоолох */
export function lambdaFromProbe(week: number, retained: number): number | null {
  if (week <= 0 || retained <= 0 || retained > 1) return null;
  const l = -Math.log(retained) / week;
  return l === 0 ? 0 : l; // -0 -ийг +0 болгоно
}

/**
 * Олон цэгээс λ-г хамгийн бага квадратын аргаар тохируулна.
 * ln R(t) = −λ·t  →  сөрөг налуу нь λ (эх дундуур дайрсан шулуун).
 */
export function fitDecayLambda(probes: readonly ProbeResult[]): {
  lambda: number | null;
  rSquared: number | null;
} {
  const pts = probes.filter((p) => p.retained > 0 && p.retained <= 1 && p.sampleSize > 0);
  if (pts.length < 2) return { lambda: null, rSquared: null };

  // y = ln(R), x = t; эх дундуур: λ = −Σ(x·y)/Σ(x²)
  let sxy = 0;
  let sxx = 0;
  for (const p of pts) {
    const y = Math.log(p.retained);
    sxy += p.week * y;
    sxx += p.week * p.week;
  }
  if (sxx === 0) return { lambda: null, rSquared: null };
  const raw = -sxy / sxx;
  const lambda = raw === 0 ? 0 : raw;

  // R²
  const ys = pts.map((p) => Math.log(p.retained));
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  let ssRes = 0;
  let ssTot = 0;
  pts.forEach((p, i) => {
    const pred = -lambda * p.week;
    const actual = ys[i] ?? 0;
    ssRes += (actual - pred) ** 2;
    ssTot += (actual - meanY) ** 2;
  });
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { lambda, rSquared };
}

/** Зорилтод хүрсэн эсэх */
export function meetsTarget(probe: ProbeResult): boolean {
  return probe.retained >= RETENTION_TARGETS[probe.week];
}

/**
 * «Багажгүй үргэлжлэл» — Бүлэг 3.7, 8.5
 * Streak-ийн даралт унтраасны дараа 2 долоо хоногт эргэж ирсэн хувь.
 * Зорилт ≥ 25%. Энэ бол жинхэнэ ДОТООД сэдлийн шалгуур.
 */
export const UNGAMIFIED_CONTINUATION_TARGET = 0.25;

export function ungamifiedContinuationRate(params: {
  usersWhoDisabledStreak: number;
  returnedWithin2Weeks: number;
}): number {
  if (params.usersWhoDisabledStreak === 0) return 0;
  return params.returnedWithin2Weeks / params.usersWhoDisabledStreak;
}

// ─── Контентийн чанарын KPI (Бүлэг 8.4) ───

/**
 * «Асуултын дундаж зөв хариултын хувь: 65–75% — хэт амархан ч биш,
 *  хэт хүнд ч биш.»
 *
 * `question_stats`-ийн batch job энэ хүрээгээр хүндрэлийг тохируулна.
 */
export const KPI_ACCURACY_MIN = 0.65;
export const KPI_ACCURACY_MAX = 0.75;

/** Асуулт хэт амархан / хэт хүнд эсэх */
export function classifyDifficulty(
  correctCount: number,
  attempts: number
): 'too-easy' | 'too-hard' | 'balanced' | 'insufficient' {
  const MIN_SAMPLE = 20;
  if (attempts < MIN_SAMPLE) return 'insufficient';
  const acc = correctCount / attempts;
  if (acc > KPI_ACCURACY_MAX) return 'too-easy';
  if (acc < KPI_ACCURACY_MIN) return 'too-hard';
  return 'balanced';
}
