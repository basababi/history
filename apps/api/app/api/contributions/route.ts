/**
 * GET  /api/contributions — миний цуглуулсан зүйлс
 * POST /api/contributions — өвөө эмээгээсээ сонссоноо илгээх
 *
 * ROADMAP B3 · СУДАЛГААНЫ ҮНДЭСЛЭЛ: Khan — «биет бус өв нь биет өвөөс
 * илүү чухал». LOCUS төслийн үе хоорондын контент бүтээлт.
 *
 * ⚠ ЭНЭ МАРШРУТ НЬ R1 ЭРСДЭЛИЙГ ШИЙДНЭ: 100 хүүхэд × 3 зүйл = контентийн
 *   хомсдол дуусна. Гэвч ТҮҮХЧИЙН ЭЦСИЙН ХЯНАЛТ хэвээр — илгээсэн зүйл
 *   `pending` төлөвт орох бөгөөд батлагдтал өөр хэрэглэгчид ХАРАГДАХГҮЙ.
 *
 * ⚠ БҮЛЭГ 6.3: XP нь ИЛГЭЭХ үед олгогдоно, БАТЛАГДАХ үед БИШ. Хэрэв
 *   батлагдсаны төлөө XP олговол хүүхэд XP авахын тулд зохиож бичих
 *   сэдэлтэй болно — контентийн чанар унана.
 *
 * ⚠ ЁС ЗҮЙ: `consentConfirmed` заавал true. Ахмад хүний бүтэн нэр
 *   хадгалахгүй — зөвхөн `elderLabel` (ж нь «Дорж өвөө»).
 */
import { NextResponse } from 'next/server';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import {
  checkContribution,
  contributionXp,
  CONTRIBUTION_DAILY_LIMIT,
  todayInUlaanbaatar,
  ubDateToUtcMs,
  type ContributionKind,
} from '@nomad/core';
import { ContributionRequestSchema } from '@nomad/contracts';
import { elderContributions, profiles } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, requireAuth, route } from '@/lib/api';
import { checkRateLimit } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Улаанбаатарын өнөөдрийн эхлэл — өдрийн хязгаарыг тооцоход */
function startOfUbToday(): Date {
  return new Date(ubDateToUtcMs(todayInUlaanbaatar()));
}

async function countToday(userId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(elderContributions)
    .where(
      and(
        eq(elderContributions.contributorId, userId),
        gte(elderContributions.createdAt, startOfUbToday())
      )
    );
  return row?.n ?? 0;
}

export const GET = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  // ⚠ ЗӨВХӨН ӨӨРИЙН хувь нэмрийг буцаана. Бусдын `pending` бичвэр
  //   хэзээ ч энэ маршрутаар гарахгүй (Бүлэг 6.5).
  const rows = await db
    .select()
    .from(elderContributions)
    .where(eq(elderContributions.contributorId, userId))
    .orderBy(desc(elderContributions.createdAt))
    .limit(50);

  const todayCount = await countToday(userId);

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      body: r.body,
      elderLabel: r.elderLabel,
      status: r.status,
      reviewNote: r.reviewNote,
      xpAwarded: r.xpAwarded,
      createdAt: r.createdAt.toISOString(),
    })),
    remainingToday: Math.max(0, CONTRIBUTION_DAILY_LIMIT - todayCount),
    approvedCount: rows.filter((r) => r.status === 'approved').length,
  });
});

export const POST = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const parsed = await parseBody(req, ContributionRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { kind, body, elderLabel, regionNote, consentConfirmed } = parsed.data;

  const rl = await checkRateLimit(userId);
  if (!rl.allowed) {
    return apiError('RATE_LIMITED', 'Хэт олон хүсэлт. Түр хүлээнэ үү.', 429, true);
  }

  const todayCount = await countToday(userId);

  // ─── Дүрмийг СЕРВЕР шалгана (Бүлэг 6.1) ───
  const check = checkContribution({
    kind: kind as ContributionKind,
    body,
    elderLabel,
    consentConfirmed,
    todayCount,
  });

  if (!check.ok) {
    return NextResponse.json({
      accepted: false,
      reason: check.reason,
      message: check.message,
      xpAwarded: 0,
      remainingToday: Math.max(0, CONTRIBUTION_DAILY_LIMIT - todayCount),
    });
  }

  // ⚠ XP нь ИЛГЭЭСНИЙ төлөө — түүхчийн шийдвэрээс хамаарахгүй
  const xpAwarded = contributionXp(check);

  const [row] = await db
    .insert(elderContributions)
    .values({
      contributorId: userId,
      kind,
      body: body.trim(),
      elderLabel: elderLabel.trim(),
      regionNote: regionNote?.trim() || null,
      consentConfirmed,
      status: 'pending',
      xpAwarded,
    })
    .returning();

  if (!row) {
    return apiError('SAVE_FAILED', 'Хадгалж чадсангүй', 500, true);
  }

  const [profile] = await db
    .select({ xp: profiles.xp })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (profile) {
    await db
      .update(profiles)
      .set({ xp: profile.xp + xpAwarded })
      .where(eq(profiles.userId, userId));
  }

  return NextResponse.json({
    accepted: true,
    xpAwarded,
    remainingToday: Math.max(0, CONTRIBUTION_DAILY_LIMIT - todayCount - 1),
    item: {
      id: row.id,
      kind: row.kind,
      body: row.body,
      elderLabel: row.elderLabel,
      status: row.status,
      reviewNote: row.reviewNote,
      xpAwarded: row.xpAwarded,
      createdAt: row.createdAt.toISOString(),
    },
  });
});
