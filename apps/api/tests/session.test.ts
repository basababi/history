/**
 * Anti-cheat integration тест — Бүлэг 6.1
 * «Чансаанд итгэх итгэл алдагдвал бүтээгдэхүүн үхнэ.»
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { makeExpiry, signSession, verifySession, type SessionPayload } from '../lib/session';
import { signJwt, verifyJwt } from '../lib/auth';

beforeAll(() => {
  process.env.SESSION_SECRET = 'test-secret-key-for-vitest-only';
});

function payload(over: Partial<SessionPayload> = {}): SessionPayload {
  const { issuedAt, expiresAt } = makeExpiry(10);
  return {
    sessionId: 42,
    userId: 7,
    questionIds: [101, 102, 103],
    servedAt: { '101': issuedAt, '102': issuedAt, '103': issuedAt },
    issuedAt,
    expiresAt,
    mode: 'daily',
    heroEraId: null,
    eraBonusMultiplier: null,
    ...over,
  };
}

describe('Session token — HMAC-SHA256 (Бүлэг 6.1)', () => {
  it('гарын үсэг зурж, буцаан уншина', () => {
    const p = payload();
    const result = verifySession(signSession(p));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.sessionId).toBe(42);
      expect(result.payload.userId).toBe(7);
      expect(result.payload.questionIds).toEqual([101, 102, 103]);
    }
  });

  it('🔴 засварласан token-ыг ТАТГАЛЗАНА', () => {
    const token = signSession(payload());
    const [body, sig] = token.split('.');
    // userId-г 7 → 999 болгож оролдоно
    const tampered = Buffer.from(
      JSON.stringify({ ...payload(), userId: 999 })
    ).toString('base64url');
    const result = verifySession(`${tampered}.${sig}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('BAD_SIGNATURE');
    expect(body).toBeTruthy();
  });

  it('🔴 өөр нууц түлхүүрээр зурсныг татгалзана', () => {
    const token = signSession(payload());
    process.env.SESSION_SECRET = 'a-different-secret';
    const result = verifySession(token);
    process.env.SESSION_SECRET = 'test-secret-key-for-vitest-only';
    expect(result.ok).toBe(false);
  });

  it('🔴 хугацаа дууссан token-ыг СЕРВЕРИЙН цагаар татгалзана', () => {
    const expired = payload({
      issuedAt: Date.now() - 10 * 60_000,
      expiresAt: Date.now() - 60_000,
    });
    const result = verifySession(signSession(expired));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('EXPIRED');
  });

  it('гэмтсэн форматыг татгалзана', () => {
    for (const bad of ['', 'no-dot', 'a.b.c.d.', '.']) {
      expect(verifySession(bad).ok).toBe(false);
    }
  });

  it('servedAt асуулт ТУС БҮРД хадгалагдана (алдааны засвар №4)', () => {
    const t0 = Date.now();
    const p = payload({ servedAt: { '101': t0, '102': t0 + 30_000 } });
    const result = verifySession(signSession(p));
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 2-р асуултын хэмжилт сессийн эхлэлээс БИШ, өөрийн servedAt-аас
      expect(result.payload.servedAt['102']! - result.payload.servedAt['101']!).toBe(30_000);
    }
  });

  it('сессийн хугацаа тайлбар уншихад хангалттай (алдааны засвар №3)', () => {
    const { issuedAt, expiresAt } = makeExpiry(10);
    const ttlMinutes = (expiresAt - issuedAt) / 60_000;
    // Өмнөх хувилбар 230 сек (3.8 мин) байсан нь түгжрэл үүсгэдэг байв
    expect(ttlMinutes).toBeGreaterThan(10);
  });
});

describe('JWT нэвтрэлт', () => {
  it('зурж, буцаан уншина', () => {
    expect(verifyJwt(signJwt(123))?.userId).toBe(123);
  });

  it('хугацаа дууссаныг татгалзана', () => {
    expect(verifyJwt(signJwt(123, -10))).toBeNull();
  });

  it('засварласан JWT-г татгалзана', () => {
    const parts = signJwt(123).split('.');
    const fake = Buffer.from(JSON.stringify({ sub: 999, exp: 9e9 })).toString('base64url');
    expect(verifyJwt(`${parts[0]}.${fake}.${parts[2]}`)).toBeNull();
  });

  it('хог оролтыг татгалзана', () => {
    for (const bad of ['', 'x', 'a.b', 'a.b.c']) {
      expect(verifyJwt(bad)).toBeNull();
    }
  });
});
