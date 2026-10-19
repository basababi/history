/**
 * Anti-cheat туслах логик — Бүлэг 6.1
 *
 * 🔴 КРИТИК: «Чансаанд итгэх итгэл алдагдвал бүтээгдэхүүн үхнэ.»
 *
 * Энд зөвхөн ЦЭВЭР шийдвэрийн логик байна; Redis/ӨС-ийн I/O нь apps/api дээр.
 */

/** Цагт хамгийн ихдээ хэдэн хариулт (Бүлэг 6.1) */
export const RATE_LIMIT_PER_HOUR = 120;

/** Аномалийн босго (Бүлэг 6.1) */
export const ANOMALY_AVG_MS_THRESHOLD = 800;
export const ANOMALY_ACCURACY_THRESHOLD = 0.95;
export const ANOMALY_MIN_SAMPLE = 5;

export interface AnswerWindow {
  /** Серверийн цагаар хэмжсэн хариултын хугацаанууд (мс) */
  responseMsList: readonly number[];
  correctCount: number;
}

/**
 * «Дундаж хариултын хугацаа < 800 мс БӨГӨӨД нарийвчлал > 95% байвал
 *  тэмдэглэж, гараар хянана.» — Бүлэг 6.1
 */
export function detectAnomaly(window: AnswerWindow): {
  flagged: boolean;
  avgMs: number;
  accuracy: number;
} {
  const n = window.responseMsList.length;
  if (n === 0) return { flagged: false, avgMs: 0, accuracy: 0 };

  const avgMs = window.responseMsList.reduce((a, b) => a + b, 0) / n;
  const accuracy = window.correctCount / n;

  const flagged =
    n >= ANOMALY_MIN_SAMPLE &&
    avgMs < ANOMALY_AVG_MS_THRESHOLD &&
    accuracy > ANOMALY_ACCURACY_THRESHOLD;

  return { flagged, avgMs, accuracy };
}

/** Офлайн sync-д хүлээн авах дээд хоцрогдол — Бүлэг 6.6 */
export const MAX_OFFLINE_LAG_MS = 24 * 60 * 60 * 1000;

/**
 * Офлайн хариултыг хүлээн авах эсэх.
 * «Sync хийхдээ серверийн цагаар дахин баталгаажуулна — офлайн байдлыг
 *  ашиглан хууран мэхлэхээс сэргийлнэ (хамгийн ихдээ 24 цагийн хоцрогдол).»
 */
export function acceptOfflineAttempt(params: {
  clientAnsweredAt: number;
  serverNow: number;
}): { accepted: boolean; reason?: string } {
  const lag = params.serverNow - params.clientAnsweredAt;
  if (lag < 0) {
    return { accepted: false, reason: 'FUTURE_TIMESTAMP' };
  }
  if (lag > MAX_OFFLINE_LAG_MS) {
    return { accepted: false, reason: 'TOO_OLD' };
  }
  return { accepted: true };
}

/**
 * Хариултын хугацааг СЕРВЕРИЙН цагаар хэмжинэ (алдааны засвар №4).
 * responseMs = received_at − question.served_at
 * Клиентийн мэдээлсэн хугацаанд ХЭЗЭЭ Ч итгэхгүй.
 */
export function serverResponseMs(servedAt: number, receivedAt: number): number {
  return Math.max(0, receivedAt - servedAt);
}
