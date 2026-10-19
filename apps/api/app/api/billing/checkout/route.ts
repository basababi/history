/**
 * POST /api/billing/checkout — Hero Story Pass (Бүлэг 8.2)
 *
 * Гол зарчим: «суралцах цөм үйл ажиллагаа ҮРГЭЛЖ ҮНЭГҮЙ».
 * Pass нь тоглоомын давуу тал ОЛГОХГҮЙ (pay-to-win биш) — зөвхөн контент.
 *
 * ⚠ ХЯЗГААР: QPay/SocialPay-ийн худалдаачийн бүртгэл хараахан тохируулаагүй.
 * Тохируулаагүй үед энэ endpoint 503 буцаана — ХУУРАМЧ deep link нээхгүй.
 * Өмнөх хувилбар нь хаашаа ч хүрдэггүй URL нээж, төлбөрийн статусыг
 * хаана ч хадгалдаггүй байсан (алдааны засвар №19).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { subscriptions } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, requireAuth, route } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PLANS = [
  { id: 'monthly' as const, priceMnt: 10_000, label: 'Сар бүр · 10,000₮' },
  { id: 'yearly' as const, priceMnt: 96_000, label: 'Жил бүр · 96,000₮ (20% хямдрал)' },
];

const CheckoutSchema = z.object({
  plan: z.enum(['monthly', 'yearly']),
  provider: z.enum(['qpay', 'socialpay']),
});

export const GET = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    plans: PLANS,
    available: Boolean(process.env.QPAY_CLIENT_ID),
  });
});

export const POST = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const parsed = await parseBody(req, CheckoutSchema);
  if (!parsed.ok) return parsed.response;
  const { plan, provider } = parsed.data;

  const clientId = process.env.QPAY_CLIENT_ID;
  const clientSecret = process.env.QPAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return apiError(
      'BILLING_NOT_CONFIGURED',
      'Төлбөрийн систем хараахан идэвхжээгүй байна. Суралцах бүх үндсэн ' +
        'үйлдэл үнэгүй хэвээр ажиллана.',
      503,
      false
    );
  }

  const selected = PLANS.find((p) => p.id === plan);
  if (!selected) return apiError('PLAN_NOT_FOUND', 'Ийм багц байхгүй', 404);

  // Хүлээгдэж буй захиалгыг бүртгэнэ — webhook ирэхэд active болно
  const [row] = await db
    .insert(subscriptions)
    .values({ userId, plan, provider, status: 'pending' })
    .returning({ id: subscriptions.id });

  if (!row) {
    return apiError('CHECKOUT_FAILED', 'Захиалга үүсгэж чадсангүй', 500, true);
  }

  // TODO(qpay): QPay invoice API-г энд дуудаж, буцаасан URL-ыг өгнө.
  // Худалдаачийн бүртгэлгүй тул одоохондоо энд хүрэхгүй.
  return apiError(
    'BILLING_NOT_CONFIGURED',
    'Invoice API хараахан холбогдоогүй байна.',
    503,
    false
  );
});
