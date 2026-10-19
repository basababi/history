/**
 * GET  /api/classroom — миний ангийн чансаа ба хамтын зорилт
 * POST /api/classroom — анги үүсгэх эсвэл кодоор нэгдэх
 *
 * ROADMAP B4 · СУДАЛГААНЫ ҮНДЭСЛЭЛ: Lee & Ko (2026) — үе тэнгийн
 * харилцаа нь AI-тай харилцахтай ИЖИЛ үр дүн өгдөг. Одоо аппд
 * хүн–хүний харилцаа огт байхгүй.
 *
 * ⚠ ЧӨЛӨӨТ БИЧВЭР БАЙХГҮЙ: хүүхдүүд зөвхөн нэгдэж, жагсаж, хамтын
 *   зорилтод хувь нэмэр оруулна. Чат, сэтгэгдэл, зураг байхгүй тул
 *   Бүлэг 6.5-ын модерацийн шийдвэр хэвээр — шинэ эрсдэл нэмэгдэхгүй.
 *
 * ⚠ Ангийн нэрийг зөвхөн ҮҮСГЭГЧ өгнө. Гишүүд нэр өөрчилж чадахгүй.
 */
import { NextResponse } from 'next/server';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import {
  classGoalProgress,
  CLASSROOM_MAX_MEMBERS,
  generateClassroomCode,
  isValidClassroomCode,
  isoWeekKey,
  normalizeClassroomCode,
  rankClassMembers,
} from '@nomad/core';
import { ClassroomActionSchema } from '@nomad/contracts';
import { attempts, classroomMembers, classrooms, profiles } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, requireAuth, route } from '@/lib/api';
import { isUniqueViolation } from '@/lib/pgError';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Долоо хоногийн эхлэл — Даваа 00:00 UTC (isoWeekKey-тэй тохирно) */
function startOfIsoWeek(now = new Date()): Date {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7; // Даваа = 0
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Хэрэглэгчийн ангийн гишүүнчлэл (нэг л анги) */
async function myClassroom(userId: number) {
  const [row] = await db
    .select({
      id: classrooms.id,
      code: classrooms.code,
      name: classrooms.name,
      ownerId: classrooms.ownerId,
      goalTarget: classrooms.goalTarget,
    })
    .from(classroomMembers)
    .innerJoin(classrooms, eq(classroomMembers.classroomId, classrooms.id))
    .where(eq(classroomMembers.userId, userId))
    .limit(1);
  return row ?? null;
}

export const GET = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const room = await myClassroom(userId);
  if (!room) {
    return NextResponse.json({ joined: false });
  }

  const members = await db
    .select({ userId: classroomMembers.userId })
    .from(classroomMembers)
    .where(eq(classroomMembers.classroomId, room.id));

  const ids = members.map((m) => m.userId);
  const weekStart = startOfIsoWeek();

  // ─── Энэ долоо хоногийн хувь нэмэр — гишүүн тус бүрээр ───
  const perUser =
    ids.length > 0
      ? await db
          .select({
            userId: attempts.userId,
            weeklyXp: sql<number>`coalesce(sum(${attempts.xpAwarded}), 0)::int`,
            answered: sql<number>`count(*)::int`,
          })
          .from(attempts)
          .where(and(inArray(attempts.userId, ids), gte(attempts.createdAt, weekStart)))
          .groupBy(attempts.userId)
      : [];

  const xpMap = new Map(perUser.map((p) => [p.userId, p.weeklyXp]));
  const totalAnswered = perUser.reduce((sum, p) => sum + p.answered, 0);

  // ⚠ Хувь нэмэр оруулаагүй гишүүнийг ч 0 оноотойгоор ОРУУЛНА —
  //   жагсаалтаас хасвал хүүхэд өөрийгөө олж харахгүй.
  const ranked = rankClassMembers(ids.map((id) => ({ userId: id, weeklyXp: xpMap.get(id) ?? 0 })));

  const names =
    ids.length > 0
      ? await db
          .select({
            userId: profiles.userId,
            displayName: profiles.displayName,
            avatarEmoji: profiles.avatarEmoji,
          })
          .from(profiles)
          .where(inArray(profiles.userId, ids))
      : [];
  const nameMap = new Map(names.map((n) => [n.userId, n]));

  return NextResponse.json({
    joined: true,
    classroom: {
      id: room.id,
      /** ⚠ Кодыг зөвхөн үүсгэгчид харуулна — санамсаргүй тараагдахаас сэргийлнэ */
      code: room.ownerId === userId ? room.code : null,
      name: room.name,
      isOwner: room.ownerId === userId,
      memberCount: ids.length,
    },
    weekKey: isoWeekKey(Date.now()),
    goal: classGoalProgress(totalAnswered, room.goalTarget),
    entries: ranked.map((e) => {
      const p = nameMap.get(e.userId);
      return {
        userId: e.userId,
        displayName: p?.displayName ?? 'Нүүдэлчин',
        avatarEmoji: p?.avatarEmoji ?? '🧑‍🌾',
        weeklyXp: e.weeklyXp,
        rank: e.rank,
        isMe: e.userId === userId,
      };
    }),
  });
});

export const POST = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const parsed = await parseBody(req, ClassroomActionSchema);
  if (!parsed.ok) return parsed.response;

  const existing = await myClassroom(userId);
  if (existing) {
    return apiError('ALREADY_JOINED', 'Та аль хэдийн нэг ангид харьяалагдаж байна', 409);
  }

  // ─── Анги ҮҮСГЭХ ───
  if (parsed.data.action === 'create') {
    const name = parsed.data.name.trim();

    // Кодын давхардал — цөөн оролдлого хийгээд бууж өгнө
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generateClassroomCode();
      try {
        const [room] = await db
          .insert(classrooms)
          .values({ code, name, ownerId: userId })
          .returning();
        if (!room) break;

        await db.insert(classroomMembers).values({ classroomId: room.id, userId });
        return NextResponse.json({
          joined: true,
          created: true,
          code: room.code,
          name: room.name,
        });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        // Код давхардлаа — дахин үүсгэнэ
      }
    }
    return apiError('CODE_COLLISION', 'Код үүсгэж чадсангүй. Дахин оролдоно уу.', 500, true);
  }

  // ─── Кодоор НЭГДЭХ ───
  const code = normalizeClassroomCode(parsed.data.code);
  if (!isValidClassroomCode(code)) {
    return apiError(
      'BAD_CODE',
      'Код буруу байна. 6 тэмдэгт байх ёстой (I, O, 0, 1 үсэг ороогүй).',
      400
    );
  }

  const [room] = await db.select().from(classrooms).where(eq(classrooms.code, code)).limit(1);
  if (!room) {
    return apiError('CLASSROOM_NOT_FOUND', 'Ийм кодтой анги олдсонгүй', 404);
  }

  const [countRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(classroomMembers)
    .where(eq(classroomMembers.classroomId, room.id));

  if ((countRow?.n ?? 0) >= CLASSROOM_MAX_MEMBERS) {
    return apiError('CLASSROOM_FULL', 'Энэ анги дүүрсэн байна', 409);
  }

  await db
    .insert(classroomMembers)
    .values({ classroomId: room.id, userId })
    .onConflictDoNothing();

  return NextResponse.json({ joined: true, created: false, code: null, name: room.name });
});
