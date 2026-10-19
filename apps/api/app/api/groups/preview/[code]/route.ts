/**
 * GET /api/groups/preview/:code — урилгын линкийн урьдчилсан харагдац (НЭЭЛТТЭЙ)
 *
 * «ШУТИС 3-р курс · 12 гишүүн — нэгдэх үү?» Нэвтрээгүй ч ажиллана.
 * Гишүүдийн нэр, оноо ОРОХГҮЙ — зөвхөн бүлгийн нэр ба гишүүний тоо.
 */
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { GROUP_MAX_MEMBERS, isValidGroupCode, normalizeGroupCode } from '@nomad/core';
import { friendGroups } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, optionalAuth, routeWith } from '@/lib/api';
import { isMember, memberCount } from '@/lib/groups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = routeWith<{ code: string }>(async (req, params) => {
  const code = normalizeGroupCode(params.code);
  if (!isValidGroupCode(code)) return apiError('BAD_CODE', 'Код буруу байна', 400);

  const [group] = await db.select().from(friendGroups).where(eq(friendGroups.code, code)).limit(1);
  if (!group) return apiError('GROUP_NOT_FOUND', 'Ийм кодтой бүлэг олдсонгүй', 404);

  const viewer = optionalAuth(req);
  const count = await memberCount(group.id);
  const member = viewer ? await isMember(group.id, viewer.userId) : false;

  return NextResponse.json(
    {
      code: group.code,
      name: group.name,
      memberCount: count,
      isMember: member,
      groupId: member ? group.id : null,
      full: count >= GROUP_MAX_MEMBERS,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
});
