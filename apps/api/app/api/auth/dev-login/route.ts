/**
 * POST /api/auth/dev-login — ХӨГЖҮҮЛЭЛТИЙН нэвтрэлт (Бүлэг 4.3 түр орлуулалт)
 *
 * ⚠ Production-д 404 буцаана. Auth.js OAuth (Google/Facebook) холбогдох
 * хүртэлх түр шийдэл — ингэснээр аппыг бүрэн урсгалаар туршиж болно.
 *
 * Бүлэг 6.5: бүртгэлд зөвхөн дэлгэцийн нэр. Бодит нэр, регистр шаардахгүй.
 */
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { profiles, users } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, route } from '@/lib/api';
import { signJwt } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DevLoginSchema = z.object({
  /** Ижил түлхүүрээр дахин нэвтрэхэд ижил хэрэглэгч буцна */
  deviceId: z.string().min(6).max(64),
  displayName: z.string().min(1).max(40).optional(),
});

export const POST = route(async (req) => {
  if (process.env.NODE_ENV === 'production') {
    return apiError('NOT_FOUND', 'Ийм зам байхгүй', 404);
  }

  const parsed = await parseBody(req, DevLoginSchema);
  if (!parsed.ok) return parsed.response;
  const { deviceId, displayName } = parsed.data;

  const email = `dev-${deviceId}@nomad.local`;

  // Байгаа бол дахин ашиглана — дахин нэвтрэхэд ахиц алдагдахгүй
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let userId: number;

  if (existing) {
    userId = existing.id;
  } else {
    const [created] = await db
      .insert(users)
      .values({ email, provider: 'dev', providerId: deviceId })
      .returning({ id: users.id });
    if (!created) {
      return apiError('SIGNUP_FAILED', 'Хэрэглэгч үүсгэж чадсангүй', 500, true);
    }
    userId = created.id;

    await db
      .insert(profiles)
      .values({ userId, displayName: displayName?.trim() || 'Нүүдэлчин' })
      .onConflictDoNothing();
  }

  return NextResponse.json({
    token: signJwt(userId),
    userId,
    isNewUser: !existing,
  });
});
