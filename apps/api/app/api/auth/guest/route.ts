/**
 * POST /api/auth/guest — зочны бүртгэл (бүртгүүлэхгүйгээр шууд тоглох)
 *
 * Линкээр орж ирсэн найз эхний секундээс тоглож эхэлнэ: нэр, нууц үг,
 * и-мэйл асуухгүй. Сэргээх кодыг НЭГ удаа буцаана — клиент хадгалж,
 * токен хүчингүй болоход түүгээр дахин нэвтэрнэ.
 *
 * ⚠ IP-ээр хурдны хязгаартай — бот олноор бүртгэл үүсгэхээс сэргийлнэ.
 */
import { NextResponse } from 'next/server';
import { profiles, users } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, route, tooManyRequests } from '@/lib/api';
import { signJwt } from '@/lib/auth';
import { GUEST_PROVIDER, hashRecoveryCode, newRecoveryCode } from '@/lib/guest';
import { clientIp, rateLimit } from '@/lib/rateLimit';
import { isUniqueViolation } from '@/lib/pgError';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Нэг IP-ээс цагт үүсгэх бүртгэл — дотуур байр, сургууль нэг IP-тэй байж болно */
const GUEST_PER_IP_PER_HOUR = 60;
/** Зочны токен — хугацаа дуусахад сэргээх кодоор чимээгүй шинэчлэгдэнэ */
const GUEST_TOKEN_TTL_SEC = 60 * 60 * 24 * 90;

export const POST = route(async (req) => {
  const rl = await rateLimit(`guest:${clientIp(req)}`, GUEST_PER_IP_PER_HOUR, 3600);
  if (!rl.allowed) {
    return tooManyRequests('Хэт олон бүртгэл үүсгэлээ. Түр хүлээгээд дахин оролдоно уу.', rl.resetSec);
  }

  // 125 битийн код давхардах магадлал тэг; гэхдээ ӨС-ийн UNIQUE-д найдаж дахин оролдоно
  for (let attempt = 0; attempt < 3; attempt++) {
    const recoveryCode = newRecoveryCode();
    try {
      const [user] = await db
        .insert(users)
        .values({ provider: GUEST_PROVIDER, providerId: hashRecoveryCode(recoveryCode) })
        .returning({ id: users.id });
      if (!user) break;

      await db.insert(profiles).values({ userId: user.id, displayName: null });

      return NextResponse.json(
        {
          token: signJwt(user.id, GUEST_TOKEN_TTL_SEC),
          userId: user.id,
          recoveryCode,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }

  return apiError('SIGNUP_FAILED', 'Бүртгэл үүсгэж чадсангүй. Дахин оролдоно уу.', 500, true);
});
