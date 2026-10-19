/**
 * API-ийн нийтлэг туслагчид: zod валидаци, нэгдсэн алдааны формат, auth хамгаалалт
 */
import { NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';
import { getAuthedUser, type AuthedUser } from './auth';

export function apiError(
  code: string,
  message: string,
  status = 400,
  retryable = false
): NextResponse {
  return NextResponse.json({ error: { code, message, retryable } }, { status });
}

export async function parseBody<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return {
      ok: false,
      response: apiError('INVALID_JSON', 'Хүсэлтийн их бие зөв JSON биш', 400),
    };
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    return {
      ok: false,
      response: apiError(
        'VALIDATION_ERROR',
        result.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
        422
      ),
    };
  }
  return { ok: true, data: result.data };
}

/** Нэвтрэлт шаардах хамгаалалт */
export function requireAuth(
  req: Request
): { ok: true; user: AuthedUser } | { ok: false; response: NextResponse } {
  const user = getAuthedUser(req);
  if (!user) {
    return {
      ok: false,
      response: apiError('UNAUTHORIZED', 'Нэвтэрнэ үү', 401),
    };
  }
  return { ok: true, user };
}

/** Гэнэтийн алдааг нэгдсэн формат руу хөрвүүлнэ — стек хэрэглэгчид харагдахгүй */
function handleUnexpected(err: unknown): NextResponse {
  const id = Math.random().toString(36).slice(2, 10);
  console.error(`[api:${id}]`, err);
  return apiError(
    'INTERNAL_ERROR',
    `Дотоод алдаа гарлаа. Дугаар: ${id}`,
    500,
    true
  );
}

/** Route handler-ийг try/catch-аар боож, нэгдсэн алдаа буцаана */
export function route(
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      return await handler(req);
    } catch (err) {
      return handleUnexpected(err);
    }
  };
}

/** Нэвтрэлт заавал биш маршрут — нэвтэрсэн бол хэрэглэгч, үгүй бол null */
export function optionalAuth(req: Request): AuthedUser | null {
  return getAuthedUser(req);
}

/**
 * Динамик сегменттэй маршрут (`/api/groups/[id]`).
 *
 * Next 16-д `params` нь Promise. Энд нэг удаа задалж, handler-т энгийн
 * объект болгон өгнө — алдааг `route()`-тэй ИЖИЛ хэлбэрээр боож буцаана.
 */
export function routeWith<P extends Record<string, string>>(
  handler: (req: Request, params: P) => Promise<Response>
): (req: Request, ctx: { params: Promise<P> }) => Promise<Response> {
  return async (req, ctx) => {
    try {
      return await handler(req, await ctx.params);
    } catch (err) {
      return handleUnexpected(err);
    }
  };
}

/** Хурдны хязгаарын нэгдсэн хариу — `Retry-After` толгойтой */
export function tooManyRequests(message: string, retryAfterSec: number): NextResponse {
  const res = apiError('RATE_LIMITED', message, 429, true);
  res.headers.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterSec))));
  return res;
}
