/**
 * Quiz session token — HMAC-SHA256 (Бүлэг 6.1)
 *
 * Гурван алхамт server-authoritative урсгал:
 *   1) Сервер асуулт + гарын үсэгтэй token илгээнэ — зөв хариулт ХЭЗЭЭ Ч явахгүй
 *   2) Клиент зөвхөн сонголтоо буцаана
 *   3) Сервер: token шалгах → хугацаа → давхар хариулт биш эсэх → оноолох
 *
 * Алдааны засвар №4: асуулт бүрийн `servedAt`-ыг token дотор хадгална,
 * ингэснээр хурдан бонус (< 5 сек) АСУУЛТ ТУС БҮРД зөв ажиллана.
 * Алдааны засвар №3: expiry нь тайлбар уншихад хангалттай урт бөгөөд
 * дуусахад клиент сэргээх урсгалтай (SESSION_EXPIRED алдааны код).
 */
import crypto from 'node:crypto';
import { timingSafeEqualStr } from './auth';

/** Асуулт тус бүрд өгөх хугацаа (сек) — тайлбар уншихыг оруулсан */
const PER_QUESTION_BUDGET_SEC = 90;

/** Суурь нөөц (сек) */
const BASE_BUDGET_SEC = 60;

export interface SessionPayload {
  sessionId: number;
  userId: number;
  questionIds: number[];
  /** questionId → серверийн served epoch ms */
  servedAt: Record<string, number>;
  issuedAt: number;
  expiresAt: number;
  mode: 'daily' | 'free' | 'battle';
  /** Идэвхтэй баатрын эрин — эриний бонусыг сервер талаас баталгаажуулна */
  heroEraId: number | null;
  eraBonusMultiplier: number | null;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET тохируулагдаагүй байна');
    }
    return 'dev-only-secret-change-me';
  }
  return s;
}

export function signSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export type SessionVerifyError = 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED';

export function verifySession(
  token: string
): { ok: true; payload: SessionPayload } | { ok: false; error: SessionVerifyError } {
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return { ok: false, error: 'MALFORMED' };

  const body = token.slice(0, idx);
  const sig = token.slice(idx + 1);

  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (!timingSafeEqualStr(sig, expected)) {
    return { ok: false, error: 'BAD_SIGNATURE' };
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, error: 'MALFORMED' };
  }

  // Хугацааг ЗӨВХӨН серверийн цагаар шалгана (Бүлэг 6.1)
  if (Date.now() > payload.expiresAt) {
    return { ok: false, error: 'EXPIRED' };
  }

  return { ok: true, payload };
}

/**
 * Сессийн хугацааны нөөц.
 * 10 асуулт → 60 + 900 = 960 сек (16 мин). Хэрэглэгч тайлбар уншиж
 * удаан бодох зай өгнө — өмнөх 230 секундын түгжрэл давтагдахгүй.
 */
export function makeExpiry(questionCount: number): {
  issuedAt: number;
  expiresAt: number;
} {
  const issuedAt = Date.now();
  const ttlMs = (BASE_BUDGET_SEC + questionCount * PER_QUESTION_BUDGET_SEC) * 1000;
  return { issuedAt, expiresAt: issuedAt + ttlMs };
}
