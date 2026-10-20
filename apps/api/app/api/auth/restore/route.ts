/**
 * POST /api/auth/restore — сэргээх кодоор нэвтрэх
 *
 * Хоёр тохиолдолд ашиглагдана:
 *   1. Session хугацаа дуусахад — клиент хадгалсан кодоороо ЧИМЭЭГҮЙ шинэчилнэ
 *   2. Өөр төхөөрөмж, хөтөч дээр — хэрэглэгч кодоо гараар оруулна
 *
 * ⚠ IP-ээр хатуу хурдны хязгаартай. 125 битийн кодыг таах боломжгүй ч
 *   оролдлогыг бүртгэж, хэт олон бол хаана.
 */
import { isValidRecoveryCode, normalizeRecoveryCode } from '@nomad/core';
import { RestoreAuthRequestSchema } from '@nomad/contracts';
import { apiError, parseBody, route, sessionResponse, tooManyRequests } from '@/lib/api';
import { findGuestByCode } from '@/lib/guest';
import { clientIp, rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESTORE_PER_IP_PER_HOUR = 30;

export const POST = route(async (req) => {
  const rl = await rateLimit(`restore:${clientIp(req)}`, RESTORE_PER_IP_PER_HOUR, 3600);
  if (!rl.allowed) {
    return tooManyRequests('Хэт олон оролдлого. Түр хүлээнэ үү.', rl.resetSec);
  }

  const parsed = await parseBody(req, RestoreAuthRequestSchema);
  if (!parsed.ok) return parsed.response;

  if (!isValidRecoveryCode(normalizeRecoveryCode(parsed.data.recoveryCode))) {
    return apiError('BAD_RECOVERY_CODE', 'Сэргээх код буруу байна. 25 тэмдэгтийг шалгана уу.', 400);
  }

  const userId = await findGuestByCode(parsed.data.recoveryCode);
  if (userId === null) {
    return apiError('RECOVERY_NOT_FOUND', 'Ийм кодтой бүртгэл олдсонгүй.', 404);
  }
  return sessionResponse(req, userId);
});
