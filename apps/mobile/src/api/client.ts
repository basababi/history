/**
 * API клиент — @nomad/api руу хандах цорын ганц гарц (ADR-005)
 *
 * ГОЛ ЗАРЧИМ (Бүлэг 6.1): оноолт, unlock, streak, чансаа БҮГД сервер дээр.
 * Энэ файл дотор ямар ч бизнес логик БАЙХГҮЙ — зөвхөн тээвэрлэлт.
 */
import { z } from 'zod';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { ApiErrorSchema } from '@nomad/contracts';

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Вэб нь HttpOnly session cookie-оор нэвтэрнэ — токен JavaScript-д ХЭЗЭЭ Ч
 * хадгалагдахгүй (XSS, Safari-ийн 7 хоногийн цэвэрлэгээ). Апп Bearer токен.
 */
export const COOKIE_AUTH = Platform.OS === 'web';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Сесс дууссан — клиент шинэ сорил эхлүүлэх ёстой (алдааны засвар №3) */
  get isSessionExpired(): boolean {
    return this.code === 'SESSION_EXPIRED';
  }

  get isOffline(): boolean {
    return this.code === 'NETWORK_ERROR';
  }
}

/** Metro-гийн `hostUri`-с хост ба портыг авна. */
function getExpoDevAddress(hostUri?: string): { host: string; port: string } | null {
  if (!hostUri) return null;

  try {
    const parsed = new URL(hostUri.includes('://') ? hostUri : `http://${hostUri}`);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return null;
    }
    return {
      host: parsed.hostname.replace(/^\[|\]$/g, ''),
      port: parsed.port || '8081',
    };
  } catch {
    return null;
  }
}

/**
 * Эмулятор болон бодит төхөөрөмжөөс хөгжүүлэлтийн API-д хүрэх хаягийг тааруулна.
 * Бодит Expo Go төхөөрөмж дээр Metro-ийн hostUri нь компьютерийн LAN хаягийг өгдөг.
 */
export function adaptApiBaseUrl(
  url: string,
  platform: typeof Platform.OS,
  isDevice: boolean,
  hostUri?: string,
  isDev: boolean = typeof __DEV__ !== 'undefined' && __DEV__
): string {
  // Local Next API requests in development use Metro as a same-origin proxy.
  // This also avoids stale LAN IPs and browser CORS preflight failures.
  if (isDev) {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === 'http:' && parsedUrl.port === '3001') {
        const address = getExpoDevAddress(hostUri);
        const metroPort = address?.port ?? '8081';

        if (platform === 'web') {
          if (typeof window !== 'undefined' && window.location.origin) {
            return window.location.origin;
          }
          const host = address?.host;
          return host
            ? `http://${host.includes(':') ? `[${host}]` : host}:${metroPort}`
            : `http://localhost:${metroPort}`;
        }

        if (platform === 'android' && !isDevice) {
          return `http://10.0.2.2:${metroPort}`;
        }

        if (isDevice && address) {
          const host = address.host.includes(':')
            ? `[${address.host}]`
            : address.host;
          return `http://${host}:${metroPort}`;
        }

        if (!isDevice) return `http://localhost:${metroPort}`;
      }
    } catch {
      // Keep the original URL so the normal URL/error handling can report it.
    }
  }

  const loopback = /^(https?:\/\/)(localhost|127\.0\.0\.1)(?::\d+)?(?=[/?#]|$)/i;
  if (!loopback.test(url)) return url;

  const address = getExpoDevAddress(hostUri);

  // Хөгжүүлэлтийн API-г Metro-гийн ижил порт руу дамжуулна.
  if (isDev && isDevice && address) {
    const host = address.host.includes(':') ? `[${address.host}]` : address.host;
    return url.replace(loopback, (_match, protocol: string) =>
      `${protocol}${host}:${address.port}`
    );
  }

  // Android эмуляторын тусгай хостын хаяг. Dev үед Metro прокси руу явна.
  if (platform === 'android' && !isDevice) {
    const port = isDev ? address?.port ?? '8081' : '3001';
    return url.replace(loopback, (_match, protocol: string) =>
      `${protocol}10.0.2.2:${port}`
    );
  }

  return url;
}

/**
 * API-ийн хаяг. Дараалал:
 *   1. `EXPO_PUBLIC_API_URL` — Metro-гийн орлуулсан утга
 *   2. `app.config.js`-ийн `extra.apiUrl` — root `.env`-ээс уншсан
 *   3. localhost — сүүлчийн нөөц; Expo Go төхөөрөмж дээр Metro хост руу хөрвүүлнэ
 *
 * Development-ийн `http://...:3001` хаягийг Metro прокси руу чиглүүлнэ;
 * production API (жишээ нь HTTPS) хаягийг тохиргоогоор шууд ашиглаж болно.
 */
/**
 * Вэб production: апп ба API НЭГ домэйн дээр (Next нь SPA-г үйлчилнэ).
 *
 * Тохиргоонд localhost байсан ч бодит домэйн дээр ажиллаж байвал өөрийн
 * гарлыг ашиглана — dev хаяг production bundle-д санамсаргүй үлдэхэд
 * сайт бүхэлдээ ажиллахаа болих эрсдэлийг хаана.
 */
export function webBaseUrl(configured: string | undefined, pageOrigin: string): string {
  if (!configured || configured === 'same-origin') return pageOrigin;
  try {
    const target = new URL(configured);
    const page = new URL(pageOrigin);
    const loopback = (h: string) => h === 'localhost' || h === '127.0.0.1';
    if (loopback(target.hostname) && !loopback(page.hostname)) return pageOrigin;
    return target.origin;
  } catch {
    return pageOrigin;
  }
}

function resolveBaseUrl(): string {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (Platform.OS === 'web' && !isDev && typeof window !== 'undefined' && window.location?.origin) {
    return webBaseUrl(process.env.EXPO_PUBLIC_API_URL, window.location.origin);
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) {
    return adaptApiBaseUrl(fromEnv, Platform.OS, Constants.isDevice, hostUri);
  }

  const fromConfig = Constants.expoConfig?.extra?.apiUrl;
  if (typeof fromConfig === 'string' && fromConfig.length > 0) {
    return adaptApiBaseUrl(fromConfig, Platform.OS, Constants.isDevice, hostUri);
  }

  return adaptApiBaseUrl(
    'http://localhost:3001',
    Platform.OS,
    Constants.isDevice,
    hostUri
  );
}

let baseUrl = resolveBaseUrl();
let authToken: string | null = null;

export function configureApi(opts: { baseUrl?: string; token?: string | null }) {
  if (opts.baseUrl !== undefined) baseUrl = opts.baseUrl;
  if (opts.token !== undefined) authToken = opts.token;
}

export function getApiBaseUrl(): string {
  return baseUrl;
}

/**
 * Session хүчингүй болоход (хугацаа дуусах, сервер нууц солих) дахин
 * нэвтрэх функц — сэргээх кодоор ЧИМЭЭГҮЙ. Амжилттай бол `true`; шинэ
 * токеныг (апп) эсвэл cookie-г (вэб) функц өөрөө тохируулна. Дэлгэцүүд
 * энэ талаар юу ч мэдэх шаардлагагүй.
 */
let refreshAuth: (() => Promise<boolean>) | null = null;
let refreshing: Promise<boolean> | null = null;

export function setAuthRefresher(fn: (() => Promise<boolean>) | null): void {
  refreshAuth = fn;
}

async function refreshOnce(): Promise<boolean> {
  if (!refreshAuth) return false;
  // Зэрэг ирсэн олон 401 нэг л удаа дахин нэвтэрнэ
  refreshing ??= refreshAuth().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Дотоод: 401-ийн дараах давтлага мөн эсэх */
  retried?: boolean;
}

/**
 * Бүх хариуг zod-оор баталгаажуулна — серверийн гэрээ зөрчигдвөл
 * дэлгэц дээр биш, ЭНД илэрнэ.
 */
export async function apiRequest<T>(
  path: string,
  schema: z.ZodSchema<T>,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      // Вэбийн session cookie зөвхөн өөрийн домэйн рүү явна
      credentials: 'same-origin',
      signal: options.signal ?? controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const aborted = err instanceof Error && err.name === 'AbortError';
    throw new ApiError(
      aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
      aborted
        ? 'Хүсэлт хугацаа хэтэрлээ'
        : 'Сүлжээнд холбогдож чадсангүй. Офлайн горимд шилжлээ.',
      0,
      true
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json: unknown = null;
  if (text.length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      // Оношилгоо: хоосон «буруу хариу» биш, ЮУ ирснийг хэлнэ.
      // Хамгийн түгээмэл шалтгаан нь API хаяг буруу байж, Metro эсвэл
      // өөр сервер HTML буцаах явдал.
      const looksHtml = /^\s*<(!doctype|html)/i.test(text);
      const snippet = text.slice(0, 120).replace(/\s+/g, ' ').trim();

      throw new ApiError(
        'BAD_RESPONSE',
        looksHtml
          ? `Сервер JSON биш HTML буцаалаа (${res.status}).\n` +
            `Хандсан хаяг: ${baseUrl}${path}\n` +
            'API ажиллаж байгаа эсэх, EXPO_PUBLIC_API_URL зөв эсэхийг шалгана уу.'
          : `Серверээс буруу хариу ирлээ (${res.status}): ${snippet}`,
        res.status,
        true
      );
    }
  }

  if (!res.ok) {
    const parsed = ApiErrorSchema.safeParse(json);

    // Токен хүчингүй — нэг удаа дахин нэвтэрч давтана (нэвтрэх замаас бусад)
    if (
      res.status === 401 &&
      !options.retried &&
      !path.startsWith('/api/auth/') &&
      parsed.success &&
      parsed.data.error.code === 'UNAUTHORIZED'
    ) {
      if (await refreshOnce()) {
        return apiRequest(path, schema, { ...options, retried: true });
      }
    }

    if (parsed.success) {
      throw new ApiError(
        parsed.data.error.code,
        parsed.data.error.message,
        res.status,
        parsed.data.error.retryable
      );
    }
    throw new ApiError('HTTP_ERROR', `Алдаа гарлаа (${res.status})`, res.status, res.status >= 500);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    // `__DEV__` нь RN-ийн глобал — тест/Node орчинд байхгүй тул хамгаална
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.error(`[api] ${path} схем зөрчил:`, parsed.error.issues);
    }
    throw new ApiError(
      'SCHEMA_MISMATCH',
      'Серверийн хариу хүлээгдэж буй бүтэцтэй таарахгүй байна',
      res.status,
      false
    );
  }

  return parsed.data;
}
