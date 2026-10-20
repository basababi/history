/**
 * Вэбийн session cookie — токен JavaScript-д ХЭЗЭЭ Ч харагдахгүй
 *
 * Яагаад localStorage биш:
 *   1. Safari (ITP) 7 хоног ороогүй сайтын СКРИПТЭЭР бичсэн өгөгдлийг
 *      (localStorage, IndexedDB) устгадаг. Сервер тавьсан HttpOnly cookie-д
 *      энэ хязгаар хамаарахгүй — апп ба API нэг домэйн дээр байгаа тул.
 *   2. XSS гарсан ч HttpOnly cookie-г скрипт уншиж чадахгүй.
 *
 * `__Host-` угтвар: зөвхөн HTTPS, Domain-гүй, Path=/ — дэд домэйн дарж
 * бичих боломжгүй. Локал http дээр хөтөч угтвартай cookie-г хүлээж авахгүй
 * тул угтваргүй нэр хэрэглэнэ.
 *
 * Апп (native) cookie биш Bearer токен ашигладаг — энэ файл түүнд хамаарахгүй.
 */

export const SESSION_COOKIE_SECURE = '__Host-ov_session';
export const SESSION_COOKIE_DEV = 'ov_session';

/** Vercel ба ихэнх прокси `x-forwarded-proto` тавьдаг */
export function isSecureRequest(req: Request): boolean {
  const proto = req.headers.get('x-forwarded-proto');
  if (proto) return proto.split(',')[0]?.trim() === 'https';
  return new URL(req.url).protocol === 'https:';
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0 || part.slice(0, eq).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export function readSessionCookie(req: Request): string | null {
  return readCookie(req, SESSION_COOKIE_SECURE) ?? readCookie(req, SESSION_COOKIE_DEV);
}

/** `Set-Cookie` утга. JWT нь base64url + цэг тул кодлох шаардлагагүй. */
export function sessionCookieHeader(req: Request, token: string, maxAgeSec: number): string {
  const secure = isSecureRequest(req);
  return [
    `${secure ? SESSION_COOKIE_SECURE : SESSION_COOKIE_DEV}=${token}`,
    'Path=/',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`,
    'HttpOnly',
    // Lax: өөр сайтаас ирсэн POST/fetch-д cookie явахгүй, харин Messenger-ийн
    // линкээр орж ирэхэд (top-level GET) явна.
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

/**
 * Cookie-оор нэвтэрсэн БИЧИХ хүсэлт өөр сайтаас ирсэн эсэх (CSRF).
 *
 * SameSite=Lax үндсэн хамгаалалт; энэ нь хоёр дахь давхарга. Орчин үеийн
 * хөтөч `Sec-Fetch-Site`-ийг заавал илгээдэг; хуучин хөтөчид `Origin`-ийг
 * шалгана. Хоёул байхгүй бол хөтөч биш клиент — түүнд хохирогчийн cookie
 * байх боломжгүй.
 */
export function isCrossSiteWrite(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;

  const site = req.headers.get('sec-fetch-site');
  if (site) return site !== 'same-origin' && site !== 'none';

  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? new URL(req.url).host;
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}
