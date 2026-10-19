/**
 * Нэвтрэлт — JWT bearer token (Бүлэг 4.3: Auth.js)
 *
 * Бүлэг 6.5: бүртгэлд зөвхөн OAuth ID + дэлгэцийн нэр. Бодит нэр,
 * төрсөн огноо, регистр ШААРДАХГҮЙ (14–18 насны хэрэглэгч).
 */
import crypto from 'node:crypto';

export interface AuthedUser {
  userId: number;
}

/** HMAC нууц түлхүүр — production-д заавал тохируулсан байх ёстой */
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

interface JwtPayload {
  sub: number;
  exp: number;
}

/** Энгийн HS256 JWT — Auth.js-ийн session token-той нийцнэ */
export function signJwt(userId: number, ttlSec = 60 * 60 * 24 * 30): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + ttlSec })
  );
  const sig = crypto
    .createHmac('sha256', secret())
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${sig}`;
}

export function verifyJwt(token: string): AuthedUser | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  if (!header || !payload || !sig) return null;

  const expected = crypto
    .createHmac('sha256', secret())
    .update(`${header}.${payload}`)
    .digest('base64url');

  if (!timingSafeEqualStr(sig, expected)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as JwtPayload;
    if (typeof parsed.sub !== 'number') return null;
    if (parsed.exp * 1000 < Date.now()) return null;
    return { userId: parsed.sub };
  } catch {
    return null;
  }
}

/**
 * Хүсэлтээс нэвтэрсэн хэрэглэгчийг гаргана.
 * Dev горимд `X-Dev-User` толгойгоор хялбар туршилт хийж болно.
 */
export function getAuthedUser(req: Request): AuthedUser | null {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    return verifyJwt(auth.slice(7));
  }
  if (process.env.NODE_ENV !== 'production') {
    const devUser = req.headers.get('x-dev-user');
    if (devUser && /^\d+$/.test(devUser)) {
      return { userId: Number(devUser) };
    }
  }
  return null;
}

function b64url(s: string): string {
  return Buffer.from(s).toString('base64url');
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
