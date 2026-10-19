/**
 * Redis — Upstash (ADR-003): ZSET чансаа, streak кэш, rate limit
 * Бүлэг 5.3-ын түлхүүрийн бүтэц яг баримт бичгийн дагуу.
 *
 * Redis байхгүй/унасан үед graceful degradation — Postgres руу шилжинэ
 * (Бүлэг 6.6). Rate limit нь Redis-гүй үед хаахгүй, зөвхөн бүртгэхгүй.
 */
import Redis from 'ioredis';
import { RATE_LIMIT_PER_HOUR } from '@nomad/core';

let client: Redis | null = null;
let unavailable = false;

function getRedis(): Redis | null {
  if (unavailable) return null;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!client) {
    client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    client.on('error', () => {
      unavailable = true;
    });
  }
  return client;
}

/** Redis дуудлагыг аюулгүй хийнэ — унасан бол null буцаана */
export async function safeRedis<T>(
  fn: (r: Redis) => Promise<T>
): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    return await fn(r);
  } catch {
    unavailable = true;
    return null;
  }
}

// ─── Түлхүүрүүд (Бүлэг 5.3) ───

/** league:2026-W35:gold:b42 */
export function leagueKey(weekKey: string, tier: string, bucketNo: number): string {
  return `league:${weekKey}:${tier}:b${bucketNo}`;
}

/** rl:answer:8891:2026-08-24T11 */
function rateLimitKey(userId: number, now: Date): string {
  return `rl:answer:${userId}:${now.toISOString().slice(0, 13)}`;
}

/** mentor:user:8891:2026-08-24 — өдөрт 10 мессеж (Бүлэг 6.4) */
function mentorQuotaKey(userId: number, ubDate: string): string {
  return `mentor:user:${userId}:${ubDate}`;
}

// ─── Rate limit (Бүлэг 6.1: цагт 120 хариулт) ───

export async function checkRateLimit(
  userId: number,
  now = new Date()
): Promise<{ allowed: boolean; remaining: number; enforced: boolean }> {
  const key = rateLimitKey(userId, now);
  const count = await safeRedis(async (r) => {
    const c = await r.incr(key);
    if (c === 1) await r.expire(key, 3600);
    return c;
  });

  // Redis байхгүй — хязгаарлахгүй, гэхдээ үүнийг ил тэмдэглэнэ
  if (count === null) {
    return { allowed: true, remaining: RATE_LIMIT_PER_HOUR, enforced: false };
  }

  return {
    allowed: count <= RATE_LIMIT_PER_HOUR,
    remaining: Math.max(0, RATE_LIMIT_PER_HOUR - count),
    enforced: true,
  };
}

// ─── Mentor-ийн өдрийн лимит (Бүлэг 6.4: өдөрт 10) ───

const MENTOR_DAILY_LIMIT = 10;

export async function consumeMentorQuota(
  userId: number,
  ubDate: string
): Promise<{ allowed: boolean; remaining: number }> {
  const key = mentorQuotaKey(userId, ubDate);
  const count = await safeRedis(async (r) => {
    const c = await r.incr(key);
    if (c === 1) await r.expire(key, 60 * 60 * 30); // 30 цаг — UB өдрийг бүрэн хамарна
    return c;
  });

  if (count === null) {
    // Redis-гүй үед лимит хэрэгжүүлж чадахгүй тул чатыг ХААНА (зардлын хамгаалалт)
    return { allowed: false, remaining: 0 };
  }

  return {
    allowed: count <= MENTOR_DAILY_LIMIT,
    remaining: Math.max(0, MENTOR_DAILY_LIMIT - count),
  };
}

export async function peekMentorQuota(
  userId: number,
  ubDate: string
): Promise<number> {
  const used = await safeRedis(async (r) => {
    const v = await r.get(mentorQuotaKey(userId, ubDate));
    return v ? Number(v) : 0;
  });
  if (used === null) return 0;
  return Math.max(0, MENTOR_DAILY_LIMIT - used);
}
