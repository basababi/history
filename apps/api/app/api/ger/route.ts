/**
 * GET   /api/ger — хэрэглэгчийн гэр ба бүх эд зүйл
 * PATCH /api/ger — эд зүйл байрлуулах / авах
 *
 * ROADMAP B1 · Судалгааны үндэслэл (Lee, Yi, Kim 2020):
 * шагнал нь ӨӨРӨӨ ЗАСВАРЛАДАГ орон зай байх ёстой. Ишлэл:
 * «Зорилгодоо хүрсний дараа шагнал үр нөлөөгөө алддаг. Тиймээс
 * сонирхлыг хадгалахын тулд өөрчлөх бүрэлдэхүүнийг ашигласан.»
 *
 * Нээгдэх дүрэм: `unlock_level` ≤ хэрэглэгчийн түвшин.
 * Түвшин = rank tier-ийн эрэмбэ × 2 + нээсэн баатрын тоо.
 */
import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { TIER_ORDER, type RankTier } from '@nomad/core';
import { gerItems, profiles, userGerItems, userHeroes } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, requireAuth, route } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Хэрэглэгчийн «гэрийн түвшин» — эд зүйл нээгдэх шалгуур.
 * Rank болон цуглуулсан баатраас хамаарна.
 */
function gerLevel(tier: RankTier, heroCount: number): number {
  const tierIndex = Math.max(0, TIER_ORDER.indexOf(tier));
  return 1 + tierIndex * 2 + heroCount;
}

export const GET = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const [profile] = await db
    .select({ rankTier: profiles.rankTier })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile) return apiError('NO_PROFILE', 'Профайл олдсонгүй', 404);

  const [heroes, owned, catalog] = await Promise.all([
    db.select({ heroId: userHeroes.heroId }).from(userHeroes).where(eq(userHeroes.userId, userId)),
    db.select().from(userGerItems).where(eq(userGerItems.userId, userId)),
    db.select().from(gerItems).orderBy(asc(gerItems.unlockLevel)),
  ]);

  const level = gerLevel(profile.rankTier as RankTier, heroes.length);
  const ownedMap = new Map(owned.map((o) => [o.itemId, o]));

  return NextResponse.json({
    level,
    items: catalog.map((item) => {
      const mine = ownedMap.get(item.id);
      return {
        id: item.id,
        name: item.name,
        slot: item.slot,
        eraId: item.eraId,
        rarity: item.rarity,
        emoji: item.emoji,
        description: item.description,
        sourceRef: item.sourceRef,
        unlockLevel: item.unlockLevel,
        /** Түвшин хүрсэн — авах боломжтой */
        available: item.unlockLevel <= level,
        owned: !!mine,
        equipped: mine?.equipped ?? false,
      };
    }),
  });
});

const UpdateGerSchema = z.object({
  itemId: z.number().int(),
  /** true = гэрт байрлуулна, false = авна */
  equipped: z.boolean(),
});

export const PATCH = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const parsed = await parseBody(req, UpdateGerSchema);
  if (!parsed.ok) return parsed.response;
  const { itemId, equipped } = parsed.data;

  const [item] = await db.select().from(gerItems).where(eq(gerItems.id, itemId)).limit(1);
  if (!item) return apiError('ITEM_NOT_FOUND', 'Ийм эд зүйл байхгүй', 404);

  // ─── Түвшин хүрсэн эсэх (сервер шалгана) ───
  const [profile] = await db
    .select({ rankTier: profiles.rankTier })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile) return apiError('NO_PROFILE', 'Профайл олдсонгүй', 404);

  const heroes = await db
    .select({ heroId: userHeroes.heroId })
    .from(userHeroes)
    .where(eq(userHeroes.userId, userId));

  const level = gerLevel(profile.rankTier as RankTier, heroes.length);
  if (item.unlockLevel > level) {
    return apiError(
      'ITEM_LOCKED',
      `Энэ эд ${item.unlockLevel}-р түвшинд нээгдэнэ (та ${level}-т байна)`,
      403
    );
  }

  // Эзэмшилд нэмнэ — түвшин хүрсэн бол шууд авна
  await db.insert(userGerItems).values({ userId, itemId }).onConflictDoNothing();

  if (equipped) {
    // ⚠ Нэг slot-д НЭГ л зүйл — бусдыг нь автоматаар авна
    const sameSlot = await db
      .select({ id: gerItems.id })
      .from(gerItems)
      .where(eq(gerItems.slot, item.slot));

    for (const other of sameSlot) {
      if (other.id === itemId) continue;
      await db
        .update(userGerItems)
        .set({ equipped: false })
        .where(and(eq(userGerItems.userId, userId), eq(userGerItems.itemId, other.id)));
    }
  }

  await db
    .update(userGerItems)
    .set({ equipped })
    .where(and(eq(userGerItems.userId, userId), eq(userGerItems.itemId, itemId)));

  return NextResponse.json({ ok: true, itemId, equipped, slot: item.slot });
});
