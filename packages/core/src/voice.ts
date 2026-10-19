/**
 * Voice Battle оноолт — ADR-006 (forced alignment)
 *
 * Монгол хэлний ASR 10–25% WER бүсэд байгаа тул free transcription-ийг
 * ЯГ тааруулж оноо өгвөл ЗӨВ хэлсэн хэрэглэгчийн 20–30% нь буруу үнэлгээ авна.
 *
 * Шийдэл: зорилтот текст урьдчилж мэдэгдэж байгаа тул CTC phoneme
 * forced alignment хийж, гурван бүрэлдэхүүнээр оноолно:
 *   alignment confidence × 0.5 + pacing × 0.3 + duration fit × 0.2
 *
 * Гол зарчим: pass/fail БИШ, «хөгжилтэй оноо» 0–100.
 * Алдааны засвар №12: 0–100 БҮТЭН мужийг ашиглана (өмнөх ×0.85 таслалт устсан).
 */

export interface TongueTwister {
  id: number;
  text: string;
  /** Хэвийн уншлагын доод/дээд хугацаа (сек) */
  minSeconds: number;
  maxSeconds: number;
}

export interface AlignmentInput {
  /** FastAPI үйлчилгээнээс ирсэн phoneme alignment confidence 0..1 */
  confidence: number;
  /** Бодит уншсан хугацаа (сек) */
  durationSec: number;
  /** Үе хоорондын завсрын стандарт хазайлт (сек) — бага нь тогтвортой хэмнэл */
  pauseStdDev?: number;
}

export interface VoiceScore {
  /** 0–100 */
  score: number;
  confidenceScore: number;
  pacingScore: number;
  durationScore: number;
  durationSec: number;
  feedback: string;
}

export const VOICE_WEIGHTS = {
  confidence: 0.5,
  pacing: 0.3,
  duration: 0.2,
} as const;

/** Хугацааны тохирол: хэвийн бүсийн голд ойр байх тусам 100 */
export function durationFitScore(
  durationSec: number,
  minSeconds: number,
  maxSeconds: number
): number {
  if (maxSeconds <= minSeconds) return 0;
  const mid = (minSeconds + maxSeconds) / 2;
  const halfSpan = (maxSeconds - minSeconds) / 2;

  if (durationSec >= minSeconds && durationSec <= maxSeconds) {
    // Бүсийн дотор: голоос хол байх тусам 100 → 70
    return clamp(100 - (Math.abs(durationSec - mid) / halfSpan) * 30);
  }
  if (durationSec < minSeconds) {
    // Хэт хурдан — тодорхой бус уншсан байх магадлалтай
    return clamp((durationSec / minSeconds) * 60);
  }
  // Хэт удаан — хэт хэтэрсэн тусам буурна
  const overshoot = (durationSec - maxSeconds) / maxSeconds;
  return clamp(70 - overshoot * 70);
}

/** Хэмнэлийн тогтвортой байдал: завсрын хазайлт бага байх тусам өндөр */
export function pacingScoreFromStdDev(pauseStdDev: number | undefined): number {
  if (pauseStdDev === undefined) return 70; // хэмжигдээгүй → саармаг
  // 0 сек хазайлт = 100, 0.5 сек = 50, 1 сек+ = 0
  return clamp(100 - pauseStdDev * 100);
}

/**
 * Эцсийн оноо. Сервер талаас (FastAPI-ийн хариу дээр) дуудна.
 */
export function scoreReading(
  twister: TongueTwister,
  input: AlignmentInput
): VoiceScore {
  const confidenceScore = clamp(input.confidence * 100);
  const pacingScore = pacingScoreFromStdDev(input.pauseStdDev);
  const durationScore = durationFitScore(
    input.durationSec,
    twister.minSeconds,
    twister.maxSeconds
  );

  const score = Math.round(
    confidenceScore * VOICE_WEIGHTS.confidence +
      pacingScore * VOICE_WEIGHTS.pacing +
      durationScore * VOICE_WEIGHTS.duration
  );

  return {
    score: clamp(score),
    confidenceScore: Math.round(confidenceScore),
    pacingScore: Math.round(pacingScore),
    durationScore: Math.round(durationScore),
    durationSec: input.durationSec,
    feedback: feedbackFor(score),
  };
}

/** Pass/fail биш — урам хугалахгүй эерэг хэллэг (ADR-006) */
export function feedbackFor(score: number): string {
  if (score >= 85) return '🔥 Гайхалтай! Түргэн хэллэгийн мастер!';
  if (score >= 70) return '🐎 Сайхан уншлаа! Бараг төгс.';
  if (score >= 50) return '🌱 Сайн эхлэл — тодорхой, тогтмол хэмнэлээр дахин.';
  return '💪 Сургуулилт хэрэгтэй байна. Дахин оролдоод үзээрэй!';
}

function clamp(n: number): number {
  return Math.min(100, Math.max(0, n));
}
