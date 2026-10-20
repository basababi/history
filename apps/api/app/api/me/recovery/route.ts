/**
 * POST /api/me/recovery — шинэ сэргээх код
 *
 * Хуучин код ТЭР ДОРОО хүчингүй болно. Хоёр тохиолдолд:
 *   1. Хөтөч кодыг мартсан (Safari localStorage цэвэрлэсэн) — cookie-оор
 *      нэвтэрсэн хэвээр тул шинэ код авна
 *   2. Код бусдад харагдсан гэж үзвэл
 *
 * Сервер зөвхөн хэшийг хадгалдаг тул ХУУЧИН кодыг буцааж харуулах боломжгүй.
 */
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { users } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, requireAuth, route, tooManyRequests } from '@/lib/api';
import { GUEST_PROVIDER, hashRecoveryCode, newRecoveryCode } from '@/lib/guest';
import { rateLimit } from '@/lib/rateLimit';
import { isUniqueViolation } from '@/lib/pgError';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROTATE_PER_USER_PER_HOUR = 5;

export const POST = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const rl = await rateLimit(`recovery:${userId}`, ROTATE_PER_USER_PER_HOUR, 3600);
  if (!rl.allowed) return tooManyRequests('Хэт олон удаа шинэчиллээ. Түр хүлээнэ үү.', rl.resetSec);

  for (let attempt = 0; attempt < 3; attempt++) {
    const recoveryCode = newRecoveryCode();
    try {
      const updated = await db
        .update(users)
        .set({ providerId: hashRecoveryCode(recoveryCode) })
        .where(and(eq(users.id, userId), eq(users.provider, GUEST_PROVIDER)))
        .returning({ id: users.id });
      if (updated.length === 0) {
        return apiError('NOT_GUEST', 'Энэ бүртгэл сэргээх кодоор ажилладаггүй.', 409);
      }
      return NextResponse.json({ recoveryCode }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  return apiError('ROTATE_FAILED', 'Код үүсгэж чадсангүй. Дахин оролдоно уу.', 500, true);
});
