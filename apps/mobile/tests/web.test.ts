/**
 * Вэб-д суурилсан клиент — нэг домэйн, 401-ийн дараах чимээгүй сэргээлт,
 * вэб URL-ийн холболт, монгол формат.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiRequest, configureApi, setAuthRefresher, webBaseUrl } from '../src/api/client';
import { buildLinking } from '../src/navigation/routes';
import { formatDayLabel, formatDayLong, formatPercent, formatRank, formatRecord, formatSeconds } from '../src/lib/format';

describe('webBaseUrl — production вэб API-тай нэг домэйн', () => {
  it('тохиргоогүй эсвэл same-origin → хуудасны гарал', () => {
    expect(webBaseUrl(undefined, 'https://ertniiov.mn')).toBe('https://ertniiov.mn');
    expect(webBaseUrl('same-origin', 'https://ertniiov.mn')).toBe('https://ertniiov.mn');
  });

  it('🔴 dev-ийн localhost production bundle-д үлдсэн ч сайт эвдрэхгүй', () => {
    expect(webBaseUrl('http://localhost:3001', 'https://ertniiov.mn')).toBe('https://ertniiov.mn');
  });

  it('локал дээр туршихад localhost-ыг хэвээр', () => {
    expect(webBaseUrl('http://localhost:3001', 'http://localhost:8081')).toBe('http://localhost:3001');
  });

  it('тусдаа API домэйн тохируулбал түүнийг', () => {
    expect(webBaseUrl('https://api.ertniiov.mn/', 'https://ertniiov.mn')).toBe('https://api.ertniiov.mn');
  });
});

describe('401 — сэргээх кодоор чимээгүй дахин нэвтэрнэ', () => {
  const Ok = z.object({ ok: z.boolean() });

  afterEach(() => {
    setAuthRefresher(null);
    vi.unstubAllGlobals();
  });

  it('хүчингүй токен → шинэ токен авч НЭГ удаа давтана', async () => {
    configureApi({ baseUrl: 'http://api.test', token: 'old' });
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { headers: Record<string, string> }) => {
        seen.push(init.headers.authorization ?? '');
        if (init.headers.authorization === 'Bearer old') {
          return new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Нэвтэрнэ үү', retryable: false } }), {
            status: 401,
          });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      })
    );
    // Апп: refresher шинэ токеныг өөрөө тохируулна. Вэб: cookie — токен огт хөндөхгүй.
    const refresher = vi.fn(async () => {
      configureApi({ token: 'fresh' });
      return true;
    });
    setAuthRefresher(refresher);

    await expect(apiRequest('/api/me', Ok)).resolves.toEqual({ ok: true });
    expect(refresher).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['Bearer old', 'Bearer fresh']);
  });

  it('сэргээж чадахгүй бол 401 алдаагаа буцаана (мөнхийн давталт байхгүй)', async () => {
    configureApi({ baseUrl: 'http://api.test', token: 'old' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Нэвтэрнэ үү', retryable: false } }), {
          status: 401,
        })
      )
    );
    setAuthRefresher(async () => false);
    await expect(apiRequest('/api/me', Ok)).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
  });
});

describe('Вэб URL — Messenger-ээр ирэх линк зөв дэлгэц рүү очно', () => {
  const linking = buildLinking(['https://ertniiov.mn']);
  const screens = linking.config?.screens as Record<string, unknown>;

  it('сорилт ба бүлгийн урилгын зам', () => {
    expect(screens.Challenge).toBe('c/:code');
    expect(screens.GroupJoin).toBe('g/:code');
    expect(linking.config?.initialRouteName).toBe('Tabs');
  });

  it('бүлгийн ID тоо болж задлагдана', () => {
    const detail = screens.GroupDetail as { parse: { id: (v: string) => number } };
    expect(detail.parse.id('42')).toBe(42);
  });
});

describe('Монгол формат', () => {
  it('огноо', () => {
    expect(formatDayLabel('2026-10-20')).toBe('10-р сарын 20');
    expect(formatDayLong('2026-10-20')).toBe('Мягмар, 10-р сарын 20');
  });

  it('хувь, секунд, тулаан, байр', () => {
    expect(formatPercent(0.624)).toBe('62%');
    expect(formatSeconds(4210)).toBe('4.2 сек');
    expect(formatSeconds(14_600)).toBe('15 сек');
    expect(formatRecord({ wins: 3, losses: 2, ties: 0, days: 5 })).toBe('3–2');
    expect(formatRecord({ wins: 3, losses: 2, ties: 1, days: 6 })).toBe('3–2–1');
    expect(formatRank(23, 128)).toBe('128 хүнээс 23-р байр');
    expect(formatRank(1, 1)).toBe('Өнөөдрийн анхны тоглогч');
  });
});
