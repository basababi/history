/**
 * DELETE /api/groups/:id/membership — бүлгээс гарах
 *
 * Эзэн гарвал эзэмшил хамгийн эрт нэгдсэн гишүүнд шилжинэ. Сүүлийн гишүүн
 * гарвал бүлэг устана — хоосон бүлэг кодоо эзэлсээр үлдэх ёсгүй.
 */
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { friendGroupMembers, friendGroups } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, requireAuth, routeWith } from '@/lib/api';
import { isMember, memberIdsOf } from '@/lib/groups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = routeWith<{ id: string }>(async (req, params) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const groupId = Number(params.id);
  if (!Number.isInteger(groupId) || groupId <= 0 || !(await isMember(groupId, userId))) {
    return apiError('GROUP_NOT_FOUND', 'Бүлэг олдсонгүй', 404);
  }

  await db
    .delete(friendGroupMembers)
    .where(and(eq(friendGroupMembers.groupId, groupId), eq(friendGroupMembers.userId, userId)));

  const remaining = await memberIdsOf(groupId);
  if (remaining.length === 0) {
    await db.delete(friendGroups).where(eq(friendGroups.id, groupId));
  } else {
    const [group] = await db.select({ ownerId: friendGroups.ownerId }).from(friendGroups).where(eq(friendGroups.id, groupId));
    if (group?.ownerId === userId) {
      await db.update(friendGroups).set({ ownerId: remaining[0] as number }).where(eq(friendGroups.id, groupId));
    }
  }

  return NextResponse.json({ left: true });
});
