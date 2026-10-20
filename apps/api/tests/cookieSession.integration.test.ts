/**
 * Вэбийн HttpOnly session cookie — БОДИТ Postgres (PGlite) дээр
 *
 *   эхлэл (cookie / сэргээх код / шинэ зочин) → cookie-оор нэвтрэх →
 *   CSRF хамгаалалт → гулсах сунгалт → сэргээх код шинэчлэх
 *
 * Safari localStorage-ийг цэвэрлэсэн ч хэрэглэгч алдагдахгүй гэдэг нь
 * энэ файлын гол баталгаа.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatRecoveryCode } from '@nomad/core';
import { makeDb } from './helpers/harness';

process.env.SESSION_SECRET = 'integration-test-secret';

const { db } = await makeDb();

vi.mock('@/lib/db', () => ({
  get db() {
    return db;
  },
  isDbConfigured: () => true,
}));

const { POST: session } = await import('../app/api/auth/session/route');
const { POST: guest } = await import('../app/api/auth/guest/route');
const { POST: restore } = await import('../app/api/auth/restore/route');
const { POST: rotate } = await import('../app/api/me/recovery/route');
const meRoute = await import('../app/api/me/route');
const { signJwt } = await import('../lib/auth');
const { resetMemoryRateLimits } = await import('../lib/rateLimit');

const ORIGIN = 'https://ertniiov.mn';
let ip = 0;

/** Хөтчийн хүсэлт — ижил сайтаас, cookie-тэй. IP бүр шинэ (хурдны хязгаар). */
function browser(
  method: string,
  path: string,
  opts: { cookie?: string; body?: unknown; site?: string; origin?: string; bearer?: string } = {}
): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-forwarded-proto': 'https',
    'x-forwarded-for': `10.0.0.${++ip % 250}`,
    host: 'ertniiov.mn',
  };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.site !== undefined) headers['sec-fetch-site'] = opts.site;
  else headers['sec-fetch-site'] = 'same-origin';
  if (opts.origin) headers.origin = opts.origin;
  if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`;
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

/** `Set-Cookie` → дараагийн хүсэлтийн `Cookie` толгой */
function cookieFrom(res: Response): string | null {
  const raw = res.headers.get('set-cookie');
  if (!raw) return null;
  return raw.split(';')[0] ?? null;
}

async function start(body: Record<string, unknown> = {}, cookie?: string) {
  const res = await session(browser('POST', '/api/auth/session', { body, cookie }));
  const json = (await res.json()) as { userId: number; created: boolean; recoveryCode: string | null; token: string };
  return { res, json, cookie: cookieFrom(res) };
}

async function me(cookie: string | undefined, extra: { site?: string } = {}) {
  return meRoute.GET(browser('GET', '/api/me', { cookie, ...extra }));
}

afterEach(() => {
  vi.useRealTimers();
  resetMemoryRateLimits();
});

describe('Cookie-ийн шинж чанар', () => {
  it('HttpOnly · Secure · SameSite=Lax · __Host- угтвар · 90 хоног', async () => {
    const { res } = await start();
    const raw = res.headers.get('set-cookie') ?? '';
    expect(raw).toMatch(/^__Host-ov_session=[\w-]+\.[\w-]+\.[\w-]+;/);
    expect(raw).toContain('HttpOnly');
    expect(raw).toContain('Secure');
    expect(raw).toContain('SameSite=Lax');
    expect(raw).toContain('Path=/');
    expect(raw).toContain(`Max-Age=${60 * 60 * 24 * 90}`);
    expect(raw).not.toMatch(/Domain=/i);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('локал http дээр угтваргүй нэр, Secure-гүй (хөтөч хүлээж авна)', async () => {
    const res = await session(
      new Request('http://localhost:8081/api/auth/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', 'x-forwarded-for': '10.9.9.9' },
        body: '{}',
      })
    );
    const raw = res.headers.get('set-cookie') ?? '';
    expect(raw).toMatch(/^ov_session=/);
    expect(raw).not.toContain('Secure');
  });
});

describe('POST /api/auth/session — нэг дуудлагат эхлэл', () => {
  it('юу ч байхгүй → шинэ зочин, сэргээх кодтой', async () => {
    const { res, json, cookie } = await start();
    expect(res.status).toBe(200);
    expect(json.created).toBe(true);
    expect(json.recoveryCode).toMatch(/^[A-Z2-9]{25}$/);
    expect(cookie).not.toBeNull();
  });

  it('🔴 Safari localStorage цэвэрлэсэн ч cookie үлдсэн → ИЖИЛ хэрэглэгч, шинэ бүртгэл үүсэхгүй', async () => {
    const first = await start();
    const again = await start({}, first.cookie ?? undefined);
    expect(again.json.userId).toBe(first.json.userId);
    expect(again.json.created).toBe(false);
    // Код илгээгээгүй тул хадгалах код байхгүй — клиент «шинэ код авах»-ыг санал болгоно
    expect(again.json.recoveryCode).toBeNull();
  });

  it('cookie хүчинтэй + өөрийнх нь код → кодыг буцаана (клиент хадгална)', async () => {
    const first = await start();
    const again = await start({ recoveryCode: first.json.recoveryCode }, first.cookie ?? undefined);
    expect(again.json.userId).toBe(first.json.userId);
    expect(again.json.recoveryCode).toBe(first.json.recoveryCode);
  });

  it('cookie хүчинтэй + ӨӨР хүний код → тэр кодыг хадгалуулахгүй', async () => {
    const a = await start();
    const b = await start();
    const mixed = await start({ recoveryCode: b.json.recoveryCode }, a.cookie ?? undefined);
    expect(mixed.json.userId).toBe(a.json.userId);
    expect(mixed.json.recoveryCode).toBeNull();
  });

  it('cookie дууссан, код бий → сэргээнэ (зураастай бичсэн ч)', async () => {
    const first = await start();
    const code = formatRecoveryCode(first.json.recoveryCode ?? '');
    const restored = await start({ recoveryCode: code });
    expect(restored.json.userId).toBe(first.json.userId);
    expect(restored.json.created).toBe(false);
    expect(restored.cookie).not.toBeNull();
  });

  it('код хүчингүй → шинэ зочин (тоглоом тасрахгүй)', async () => {
    const res = await start({ recoveryCode: 'ABCDEFGHJKLMNPQRSTUVWXYZ2' });
    expect(res.json.created).toBe(true);
    expect(res.json.recoveryCode).not.toBe('ABCDEFGHJKLMNPQRSTUVWXYZ2');
  });

  it('ӨС-д байхгүй хэрэглэгчийн хүчинтэй токен → шинэ зочин', async () => {
    const ghost = `__Host-ov_session=${signJwt(999_999, 3600)}`;
    const res = await start({}, ghost);
    expect(res.json.created).toBe(true);
    expect(res.json.userId).not.toBe(999_999);
  });
});

describe('Cookie-оор нэвтрэх', () => {
  it('GET /api/me cookie-оор ажиллана', async () => {
    const { cookie, json } = await start();
    const res = await me(cookie ?? undefined);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { userId: number }).userId).toBe(json.userId);
  });

  it('cookie байхгүй → 401', async () => {
    expect((await me(undefined)).status).toBe(401);
  });

  it('хуурамч cookie → 401', async () => {
    expect((await me('__Host-ov_session=a.b.c')).status).toBe(401);
  });

  it('апп-ын Bearer хэвээр ажиллана (cookie-гүй)', async () => {
    const res = await guest(browser('POST', '/api/auth/guest', { body: {} }));
    const { token, userId } = (await res.json()) as { token: string; userId: number };
    const r = await meRoute.GET(browser('GET', '/api/me', { bearer: token }));
    expect(((await r.json()) as { userId: number }).userId).toBe(userId);
  });

  it('сэргээх кодоор (өөр төхөөрөмж) нэвтрэхэд тэр хэрэглэгчийн cookie тавина', async () => {
    const owner = await start();
    const res = await restore(browser('POST', '/api/auth/restore', { body: { recoveryCode: owner.json.recoveryCode } }));
    const cookie = cookieFrom(res);
    expect(cookie).not.toBeNull();
    const r = await me(cookie ?? undefined);
    expect(((await r.json()) as { userId: number }).userId).toBe(owner.json.userId);
  });
});

describe('🔴 CSRF — өөр сайтаас cookie-оор бичих хүсэлт', () => {
  it('Sec-Fetch-Site: cross-site → нэвтрээгүй гэж үзнэ (нэр солигдохгүй)', async () => {
    const { cookie } = await start();
    const res = await meRoute.PATCH(
      browser('PATCH', '/api/me', { cookie: cookie ?? undefined, site: 'cross-site', body: { displayName: 'Хакер' } })
    );
    expect(res.status).toBe(401);
  });

  it('Sec-Fetch-Site байхгүй, Origin өөр домэйн → хаана', async () => {
    const { cookie } = await start();
    const res = await meRoute.PATCH(
      browser('PATCH', '/api/me', { cookie: cookie ?? undefined, site: '', origin: 'https://evil.example', body: { displayName: 'Хакер' } })
    );
    expect(res.status).toBe(401);
  });

  it('ижил сайтаас бол зөвшөөрнө', async () => {
    const { cookie } = await start();
    const res = await meRoute.PATCH(
      browser('PATCH', '/api/me', { cookie: cookie ?? undefined, origin: ORIGIN, body: { displayName: 'Тэмүүжин' } })
    );
    expect(res.status).toBe(200);
  });

  it('унших (GET) хүсэлтийг cross-site линкээр нээж болно (Messenger-ээс орж ирэх)', async () => {
    const { cookie } = await start();
    expect((await me(cookie ?? undefined, { site: 'cross-site' })).status).toBe(200);
  });
});

describe('Гулсах сунгалт', () => {
  it('шинэхэн cookie → дахин тавихгүй', async () => {
    const { cookie } = await start();
    const res = await me(cookie ?? undefined);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('31 хоногийн дараа орвол шинэ 90 хоногийн cookie тавина', async () => {
    const { cookie, json } = await start();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 31 * 24 * 3600 * 1000);
    const res = await me(cookie ?? undefined);
    expect(res.status).toBe(200);
    const renewed = cookieFrom(res);
    expect(renewed).not.toBeNull();
    expect(renewed).not.toBe(cookie);
    const again = await me(renewed ?? undefined);
    expect(((await again.json()) as { userId: number }).userId).toBe(json.userId);
  });

  it('91 хоног ороогүй → cookie дууссан (сэргээх код хэрэгтэй)', async () => {
    const { cookie } = await start();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 91 * 24 * 3600 * 1000);
    expect((await me(cookie ?? undefined)).status).toBe(401);
  });
});

describe('POST /api/me/recovery — шинэ сэргээх код', () => {
  it('шинэ код ажиллана, ХУУЧИН нь тэр дороо хүчингүй', async () => {
    const owner = await start();
    const oldCode = owner.json.recoveryCode;
    const res = await rotate(browser('POST', '/api/me/recovery', { cookie: owner.cookie ?? undefined, body: {} }));
    expect(res.status).toBe(200);
    const { recoveryCode } = (await res.json()) as { recoveryCode: string };
    expect(recoveryCode).not.toBe(oldCode);

    const withNew = await restore(browser('POST', '/api/auth/restore', { body: { recoveryCode } }));
    expect(((await withNew.json()) as { userId: number }).userId).toBe(owner.json.userId);

    const withOld = await restore(browser('POST', '/api/auth/restore', { body: { recoveryCode: oldCode } }));
    expect(withOld.status).toBe(404);
  });

  it('нэвтрээгүй → 401', async () => {
    const res = await rotate(browser('POST', '/api/me/recovery', { body: {} }));
    expect(res.status).toBe(401);
  });

  it('цагт 5-аас олон удаа → 429', async () => {
    const owner = await start();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await rotate(browser('POST', '/api/me/recovery', { cookie: owner.cookie ?? undefined, body: {} }));
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
