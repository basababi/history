/**
 * API клиентийн гэрээ — схем зөрчил, алдааны хөрвүүлэлт
 * Дэлгэц дээр биш, ЭНД илрэх ёстой (Бүлэг 9: чанарын босго).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  adaptApiBaseUrl,
  ApiError,
  apiRequest,
  configureApi,
} from '../src/api/client';

const OkSchema = z.object({ value: z.number() });

describe('adaptApiBaseUrl', () => {
  it('Expo Go бодит утсан дээр localhost-ыг Metro компьютерийн хаяг болгоно', () => {
    expect(
      adaptApiBaseUrl(
        'http://localhost:3001',
        'android',
        true,
        '10.193.91.170:8081',
        true
      )
    ).toBe('http://10.193.91.170:8081');
  });

  it('Android эмуляторын хөгжүүлэлтийн хүсэлтийг Metro прокси руу явуулна', () => {
    expect(
      adaptApiBaseUrl('http://localhost:3001', 'android', false, undefined, true)
    ).toBe('http://10.0.2.2:8081');
  });

  it('production Android эмуляторын API портыг хэвээр хэрэглэнэ', () => {
    expect(
      adaptApiBaseUrl('http://localhost:3001', 'android', false, undefined, false)
    ).toBe('http://10.0.2.2:3001');
  });

  it('production бодит төхөөрөмжийн loopback хаягийг өөрчлөхгүй', () => {
    expect(
      adaptApiBaseUrl(
        'http://localhost:3001',
        'android',
        true,
        '10.193.91.170:8081',
        false
      )
    ).toBe('http://localhost:3001');
  });

  it('IPv6 Metro хостыг зөв хаалттайгаар ашиглана', () => {
    expect(
      adaptApiBaseUrl('http://localhost:3001', 'ios', true, '[2001:db8::1]:8081', true)
    ).toBe('http://[2001:db8::1]:8081');
  });

  it('Android эмулятор дээр хөгжүүлэлтийн Metro порт өөр байвал түүнийг ашиглана', () => {
    expect(
      adaptApiBaseUrl(
        'http://localhost:3001',
        'android',
        false,
        '10.0.0.2:8090',
        true
      )
    ).toBe('http://10.0.2.2:8090');
  });

  it('browser-ийн локал API-г ижил origin Metro проксигоор явуулна', () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:8081' } });
    expect(
      adaptApiBaseUrl('http://192.168.1.7:3001', 'web', false, undefined, true)
    ).toBe('http://localhost:8081');
  });

  it('утасны хуучин LAN API IP-г хөгжүүлэлтийн Metro хаягаар солино', () => {
    expect(
      adaptApiBaseUrl(
        'http://192.168.1.7:3001',
        'android',
        true,
        '172.20.10.2:8081',
        true
      )
    ).toBe('http://172.20.10.2:8081');
  });

  it('production дахь ил тод LAN API хаягийг хэвээр үлдээнэ', () => {
    expect(
      adaptApiBaseUrl(
        'http://192.168.1.7:3001',
        'android',
        true,
        '172.20.10.2:8081',
        false
      )
    ).toBe('http://192.168.1.7:3001');
  });

  it('хөгжүүлэлтийн physical URL өөрийн порттой байсан ч Metro порт руу шилжинэ', () => {
    expect(
      adaptApiBaseUrl(
        'http://127.0.0.1:9000',
        'ios',
        true,
        '10.193.91.170:8081',
        true
      )
    ).toBe('http://10.193.91.170:8081');
  });
});

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as Response);
}

beforeEach(() => {
  configureApi({ baseUrl: 'http://test.local', token: null });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('амжилттай хариуг схемээр баталгаажуулж буцаана', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { value: 42 }));
    await expect(apiRequest('/x', OkSchema)).resolves.toEqual({ value: 42 });
  });

  it('🔴 схем зөрчсөн хариуг ТАТГАЛЗАНА — дэлгэц рүү нэвтрүүлэхгүй', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { value: 'тоо биш' }));
    await expect(apiRequest('/x', OkSchema)).rejects.toMatchObject({
      code: 'SCHEMA_MISMATCH',
    });
  });

  it('серверийн алдааны форматыг ApiError болгоно', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(410, {
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Сессийн хугацаа дууссан',
          retryable: true,
        },
      })
    );
    try {
      await apiRequest('/x', OkSchema);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const e = err as ApiError;
      expect(e.code).toBe('SESSION_EXPIRED');
      expect(e.isSessionExpired).toBe(true);
      expect(e.retryable).toBe(true);
      expect(e.status).toBe(410);
    }
  });

  it('сүлжээний тасалдлыг офлайн гэж таньна', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));
    try {
      await apiRequest('/x', OkSchema);
      expect.unreachable();
    } catch (err) {
      const e = err as ApiError;
      expect(e.code).toBe('NETWORK_ERROR');
      expect(e.isOffline).toBe(true);
      expect(e.retryable).toBe(true);
    }
  });

  it('форматгүй 500-г тэсвэрлэнэ', async () => {
    vi.stubGlobal('fetch', mockFetch(500, { unexpected: true }));
    try {
      await apiRequest('/x', OkSchema);
      expect.unreachable();
    } catch (err) {
      const e = err as ApiError;
      expect(e.code).toBe('HTTP_ERROR');
      expect(e.retryable).toBe(true); // 5xx дахин оролдож болно
    }
  });

  it('4xx-д дахин оролдохгүй гэж тэмдэглэнэ', async () => {
    vi.stubGlobal('fetch', mockFetch(404, { unexpected: true }));
    await expect(apiRequest('/x', OkSchema)).rejects.toMatchObject({
      retryable: false,
    });
  });

  it('токен байвал Authorization толгой явуулна', async () => {
    const f = mockFetch(200, { value: 1 });
    vi.stubGlobal('fetch', f);
    configureApi({ token: 'jwt-123' });
    await apiRequest('/x', OkSchema);
    const init = f.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer jwt-123'
    );
  });

  it('токенгүй үед Authorization толгой ЯВУУЛАХГҮЙ', async () => {
    const f = mockFetch(200, { value: 1 });
    vi.stubGlobal('fetch', f);
    await apiRequest('/x', OkSchema);
    const init = f.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });
});
