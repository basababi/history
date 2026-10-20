/**
 * POST /api/auth/guest — зочны бүртгэл (бүртгүүлэхгүйгээр шууд тоглох)
 *
 * Линкээр орж ирсэн найз эхний секундээс тоглож эхэлнэ: нэр, нууц үг,
 * и-мэйл асуухгүй. Сэргээх кодыг НЭГ удаа буцаана.
 *
 * Вэб: HttpOnly cookie. Апп: биеийн токен. Вэб нь `/api/auth/session`-г
 * ашигладаг; энэ маршрут апп-д зориулагдсан.
 *
 * ⚠ IP-ээр хурдны хязгаартай — бот олноор бүртгэл үүсгэхээс сэргийлнэ.
 */
import { apiError, route, sessionResponse, tooManyRequests } from '@/lib/api';
import { createGuestUser } from '@/lib/guest';
import { clientIp, rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Нэг IP-ээс цагт үүсгэх бүртгэл — дотуур байр, сургууль нэг IP-тэй байж болно */
const GUEST_PER_IP_PER_HOUR = 60;

export const POST = route(async (req) => {
  const rl = await rateLimit(`guest:${clientIp(req)}`, GUEST_PER_IP_PER_HOUR, 3600);
  if (!rl.allowed) {
    return tooManyRequests('Хэт олон бүртгэл үүсгэлээ. Түр хүлээгээд дахин оролдоно уу.', rl.resetSec);
  }

  const guest = await createGuestUser();
  if (!guest) {
    return apiError('SIGNUP_FAILED', 'Бүртгэл үүсгэж чадсангүй. Дахин оролдоно уу.', 500, true);
  }
  return sessionResponse(req, guest.userId, { recoveryCode: guest.recoveryCode });
});
