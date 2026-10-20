/**
 * POST /api/auth/session — вэбийн эхлэл, НЭГ дуудлагаар
 *
 *   1. Cookie (эсвэл Bearer) хүчинтэй, хэрэглэгч ӨС-д бий → тэр хэрэглэгч
 *   2. Клиентэд хадгалсан сэргээх код таарвал → сэргээнэ
 *   3. Эс бөгөөс → шинэ зочин (IP-ийн хязгаартай)
 *
 * Safari localStorage-ийг цэвэрлэсэн ч cookie үлддэг тул 1-р алхам
 * хэрэглэгчийг алдахгүй. Харин cookie-ийн хугацаа дууссан бол 2-р алхам.
 *
 * Хариуны `recoveryCode` = клиентийн хадгалах ёстой код (гэрээг үз).
 */
import { SessionRequestSchema } from '@nomad/contracts';
import { apiError, optionalAuth, parseBody, route, sessionResponse, tooManyRequests } from '@/lib/api';
import { createGuestUser, findGuestByCode, userExists } from '@/lib/guest';
import { clientIp, rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GUEST_PER_IP_PER_HOUR = 60;
const RESTORE_PER_IP_PER_HOUR = 30;

export const POST = route(async (req) => {
  const parsed = await parseBody(req, SessionRequestSchema);
  if (!parsed.ok) return parsed.response;
  const code = parsed.data.recoveryCode ?? null;

  const current = optionalAuth(req);
  if (current && (await userExists(current.userId))) {
    const owned = code !== null && (await findGuestByCode(code)) === current.userId;
    return sessionResponse(req, current.userId, { created: false, recoveryCode: owned ? code : null });
  }

  if (code !== null) {
    const rl = await rateLimit(`restore:${clientIp(req)}`, RESTORE_PER_IP_PER_HOUR, 3600);
    if (!rl.allowed) return tooManyRequests('Хэт олон оролдлого. Түр хүлээнэ үү.', rl.resetSec);
    const userId = await findGuestByCode(code);
    if (userId !== null) {
      return sessionResponse(req, userId, { created: false, recoveryCode: code });
    }
    // Код хүчингүй (ӨС шинэчлэгдсэн г.м.) — шинэ зочин үүсгэнэ
  }

  const rl = await rateLimit(`guest:${clientIp(req)}`, GUEST_PER_IP_PER_HOUR, 3600);
  if (!rl.allowed) {
    return tooManyRequests('Хэт олон бүртгэл үүсгэлээ. Түр хүлээгээд дахин оролдоно уу.', rl.resetSec);
  }
  const guest = await createGuestUser();
  if (!guest) {
    return apiError('SIGNUP_FAILED', 'Бүртгэл үүсгэж чадсангүй. Дахин оролдоно уу.', 500, true);
  }
  return sessionResponse(req, guest.userId, { created: true, recoveryCode: guest.recoveryCode });
});
