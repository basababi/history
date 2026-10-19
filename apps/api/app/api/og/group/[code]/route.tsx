/**
 * GET /api/og/group/:code — найзын бүлгийн урилгын карт (PNG, 1200×630)
 * Гишүүдийн нэр, оноо ОРОХГҮЙ — зөвхөн бүлгийн нэр ба гишүүний тоо.
 */
import { ImageResponse } from 'next/og';
import { eq } from 'drizzle-orm';
import { isValidGroupCode, normalizeGroupCode } from '@nomad/core';
import { friendGroups } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, routeWith } from '@/lib/api';
import { memberCount } from '@/lib/groups';
import { GroupCard, loadOgFonts, OG_SIZE } from '@/lib/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = routeWith<{ code: string }>(async (_req, params) => {
  const code = normalizeGroupCode(params.code.replace(/\.png$/i, ''));
  if (!isValidGroupCode(code)) return apiError('BAD_CODE', 'Код буруу байна', 400);

  const [group] = await db.select().from(friendGroups).where(eq(friendGroups.code, code)).limit(1);
  if (!group) return apiError('GROUP_NOT_FOUND', 'Бүлэг олдсонгүй', 404);

  const [members, fonts] = await Promise.all([memberCount(group.id), loadOgFonts()]);
  return new ImageResponse(<GroupCard name={group.name} members={members} />, {
    ...OG_SIZE,
    fonts,
    headers: { 'Cache-Control': 'public, max-age=600, s-maxage=3600' },
  });
});
