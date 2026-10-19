/**
 * CORS — вэб клиентэд шаардлагатай (Бүлэг 4.1: PWA/вэб тархалт).
 *
 * Next 16-д `middleware.ts` нь `proxy.ts` болж нэр солигдсон.
 *
 * Native апп CORS-т хамаарахгүй, харин Expo вэб (`localhost:8081`) нь
 * `localhost:3001` рүү хандахдаа cross-origin болдог. Толгойгүй бол хөтөч
 * хүсэлтийг хаана.
 *
 * ⚠ Production-д `*` ХЭРЭГЛЭХГҮЙ: `ALLOWED_ORIGINS` env-ээр цагаан
 * жагсаалт өгнө. Credentials дамжуулдаг тул `*` нь хөтөч дээр ажиллахгүй
 * бөгөөд аюулгүй ч биш.
 */
import { NextResponse, type NextRequest } from 'next/server';

const ALLOWED_HEADERS = 'content-type, authorization, x-dev-user';
const ALLOWED_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';

/** Локал хөгжүүлэлтийн эх сурвалж мөн эсэх */
function isLocalOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      // Expo-г утаснаас нээхэд LAN IP-ээр ирнэ
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );
  } catch {
    return false;
  }
}

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;

  const configured = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (configured.includes(origin)) return origin;

  // Хөгжүүлэлтэд локал болон LAN эх сурвалжийг зөвшөөрнө
  if (process.env.NODE_ENV !== 'production' && isLocalOrigin(origin)) {
    return origin;
  }

  return null;
}

function applyCors(res: NextResponse, origin: string): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  res.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  res.headers.set('Access-Control-Max-Age', '86400');
  // Кэш эх сурвалж хооронд холилдохоос сэргийлнэ
  res.headers.set('Vary', 'Origin');
  return res;
}

export function proxy(req: NextRequest) {
  const origin = allowedOrigin(req.headers.get('origin'));

  // Preflight — route handler хүртэл явуулахгүй
  if (req.method === 'OPTIONS') {
    const res = new NextResponse(null, { status: 204 });
    return origin ? applyCors(res, origin) : res;
  }

  const res = NextResponse.next();
  return origin ? applyCors(res, origin) : res;
}

export const config = {
  matcher: '/api/:path*',
};
