/**
 * GET  /api/groups — миний бүлгүүд
 * POST /api/groups — бүлэг үүсгэх эсвэл кодоор нэгдэх
 *
 * ⚠ Бүлэгт гишүүдийн нэр харагдана — тиймээс нэргүй зочин эхлээд нэрээ
 *   тавина (`NAME_REQUIRED`). «Зочин», «Зочин», «Зочин» гэсэн жагсаалт
 *   хэнд ч хэрэггүй.
 */
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import {
  generateGroupCode,
  GROUP_MAX_MEMBERS,
  GROUP_MAX_PER_USER,
  isValidGroupCode,
  isValidGroupName,
  normalizeGroupCode,
  normalizeGroupName,
} from '@nomad/core';
import { GroupActionSchema } from '@nomad/contracts';
import { friendGroupMembers, friendGroups, profiles } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, requireAuth, route } from '@/lib/api';
import { todayKey } from '@/lib/daily';
import { cryptoRandom } from '@/lib/guest';
import { groupsOf, memberCount, summarize } from '@/lib/groups';
import { isUniqueViolation } from '@/lib/pgError';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const today = todayKey();
  const groups = await groupsOf(userId);
  const summaries = await Promise.all(groups.map((g) => summarize(g, userId, today)));
  return NextResponse.json({ groups: summaries, maxGroups: GROUP_MAX_PER_USER });
});

export const POST = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const parsed = await parseBody(req, GroupActionSchema);
  if (!parsed.ok) return parsed.response;

  const [profile] = await db
    .select({ displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.userId, userId));
  if (!profile?.displayName) {
    return apiError('NAME_REQUIRED', 'Бүлэгт нэгдэхийн өмнө нэрээ тавина уу', 409);
  }

  const mine = await groupsOf(userId);
  const today = todayKey();

  // ─── Нэгдэх ───
  if (parsed.data.action === 'join') {
    const code = normalizeGroupCode(parsed.data.code);
    if (!isValidGroupCode(code)) {
      return apiError('BAD_CODE', 'Код буруу байна. 6 тэмдэгт (I, O, 0, 1 үсэг ордоггүй).', 400);
    }
    const [group] = await db.select().from(friendGroups).where(eq(friendGroups.code, code)).limit(1);
    if (!group) return apiError('GROUP_NOT_FOUND', 'Ийм кодтой бүлэг олдсонгүй', 404);

    // Аль хэдийн гишүүн — идемпотент
    if (mine.some((g) => g.id === group.id)) {
      return NextResponse.json({ group: await summarize(group, userId, today), created: false });
    }
    if (mine.length >= GROUP_MAX_PER_USER) {
      return apiError('TOO_MANY_GROUPS', `Хамгийн ихдээ ${GROUP_MAX_PER_USER} бүлэгт байж болно`, 409);
    }
    if ((await memberCount(group.id)) >= GROUP_MAX_MEMBERS) {
      return apiError('GROUP_FULL', 'Энэ бүлэг дүүрсэн байна', 409);
    }

    await db.insert(friendGroupMembers).values({ groupId: group.id, userId }).onConflictDoNothing();
    return NextResponse.json({ group: await summarize(group, userId, today), created: false });
  }

  // ─── Үүсгэх ───
  if (mine.length >= GROUP_MAX_PER_USER) {
    return apiError('TOO_MANY_GROUPS', `Хамгийн ихдээ ${GROUP_MAX_PER_USER} бүлэгт байж болно`, 409);
  }
  const name = normalizeGroupName(parsed.data.name);
  if (!isValidGroupName(name)) {
    return apiError('BAD_NAME', 'Бүлгийн нэр хамгийн багадаа 2 тэмдэгт байна', 422);
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const [group] = await db
        .insert(friendGroups)
        .values({ code: generateGroupCode(cryptoRandom), name, ownerId: userId })
        .returning();
      if (!group) break;
      await db.insert(friendGroupMembers).values({ groupId: group.id, userId });
      return NextResponse.json({ group: await summarize(group, userId, today), created: true });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Код давхардлаа — шинээр үүсгэнэ
    }
  }
  return apiError('CODE_COLLISION', 'Код үүсгэж чадсангүй. Дахин оролдоно уу.', 500, true);
});
