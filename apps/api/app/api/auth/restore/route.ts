/**
 * POST /api/auth/restore — сэргээх кодоор нэвтрэх
 *
 * Хоёр тохиолдолд ашиглагдана:
 *   1. Токен хугацаа дуусахад — клиент хадгалсан кодоороо ЧИМЭЭГҮЙ шинэчилнэ
 *   2. Өөр төхөөрөмж, хөтөч дээр — хэрэглэгч кодоо гараар оруулна
 *
 * ⚠ IP-ээр хатуу хурдны хязгаартай. 125 битийн кодыг таах боломжгүй ч
 *   оролдлогыг бүртгэж, хэт олон бол хаана.
 */
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { isValidRecoveryCode, normalizeRecoveryCode } from '@nomad/core';
import { RestoreAuthRequestSchema } from '@nomad/contracts';
import { users } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, route, tooManyRequests } from '@/lib/api';
import { signJwt } from '@/lib/auth';
import { GUEST_PROVIDER, hashRecoveryCode } from '@/lib/guest';
import { clientIp, rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESTORE_PER_IP_PER_HOUR = 30;
const GUEST_TOKEN_TTL_SEC = 60 * 60 * 24 * 90;

export const POST = route(async (req) => {
  const rl = await rateLimit(`restore:${clientIp(req)}`, RESTORE_PER_IP_PER_HOUR, 3600);
  if (!rl.allowed) {
    return tooManyRequests('Хэт олон оролдлого. Түр хүлээнэ үү.', rl.resetSec);
  }

  const parsed = await parseBody(req, RestoreAuthRequestSchema);
  if (!parsed.ok) return parsed.response;

  const code = normalizeRecoveryCode(parsed.data.recoveryCode);
  if (!isValidRecoveryCode(code)) {
    return apiError('BAD_RECOVERY_CODE', 'Сэргээх код буруу байна. 25 тэмдэгтийг шалгана уу.', 400);
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.provider, GUEST_PROVIDER), eq(users.providerId, hashRecoveryCode(code))))
    .limit(1);

  if (!user) {
    return apiError('RECOVERY_NOT_FOUND', 'Ийм кодтой бүртгэл олдсонгүй.', 404);
  }

  return NextResponse.json(
    { token: signJwt(user.id, GUEST_TOKEN_TTL_SEC), userId: user.id },
    { headers: { 'Cache-Control': 'no-store' } }
  );
});
