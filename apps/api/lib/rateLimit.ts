/**
 * Хурдны хязгаар — Redis байвал түүгээр, үгүй бол процессын санах ойд
 *
 * ⚠ Санах ойн нөөц нь serverless-д instance бүрд тусдаа тул хатуу
 *   хамгаалалт БИШ — Redis тохируулаагүй орчинд л ашиглагдана. Гэхдээ
 *   нэг instance руу ирэх хөнгөн халдлагыг (зочны бүртгэл олноор үүсгэх)
 *   зогсооход хангалттай. Production-д `REDIS_URL` тохируулна.
 */
import { safeRedis } from './redis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Цонх дуусах хүртэлх секунд */
  resetSec: number;
}

const memory = new Map<string, { count: number; resetAt: number }>();
const MEMORY_MAX_KEYS = 10_000;

function memoryHit(key: string, limit: number, windowSec: number, now: number): RateLimitResult {
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    // Санах ой хэт томрохоос сэргийлж хуучирсныг цэвэрлэнэ
    if (memory.size >= MEMORY_MAX_KEYS) {
      for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    }
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { allowed: true, remaining: limit - 1, resetSec: windowSec };
  }
  entry.count += 1;
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetSec: Math.ceil((entry.resetAt - now) / 1000),
  };
}

/**
 * `key`-ээр `windowSec` секундэд `limit`-ээс илүү хүсэлтийг хаана.
 * @param key жишээ нь `guest:ip:1.2.3.4`
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
  now = Date.now()
): Promise<RateLimitResult> {
  const bucket = Math.floor(now / (windowSec * 1000));
  const redisKey = `rl:${key}:${bucket}`;

  const count = await safeRedis(async (r) => {
    const c = await r.incr(redisKey);
    if (c === 1) await r.expire(redisKey, windowSec);
    return c;
  });

  if (count === null) return memoryHit(key, limit, windowSec, now);

  const resetSec = Math.ceil(((bucket + 1) * windowSec * 1000 - now) / 1000);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetSec };
}

/** Тестэд санах ойн төлөвийг цэвэрлэнэ */
export function resetMemoryRateLimits(): void {
  memory.clear();
}

/** Хүсэлтийн IP — Vercel/прокси толгойгоос */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}
