/**
 * GET  /api/profile — профайл + rank + streak
 * PATCH /api/profile — нэр, аватар, идэвхтэй баатар, streak-гүй горим
 *
 * Бүлэг 6.5: зөвхөн дэлгэцийн нэр. Бодит нэр/регистр шаардахгүй.
 * Бүлэг 3.7: streakFreeMode — даралтыг унтраах эрх.
 */
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import {
  nextTier,
  parsePlayerPath,
  RANK_META,
  todayInUlaanbaatar,
  type RankTier,
} from '@nomad/core';
import { UpdateProfileRequestSchema } from '@nomad/contracts';
import { profiles, userArtifacts, userHeroes } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, requireAuth, route } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile) return apiError('NO_PROFILE', 'Профайл олдсонгүй', 404);

  const [ownedHeroes, ownedArtifacts] = await Promise.all([
    db.select({ heroId: userHeroes.heroId }).from(userHeroes).where(eq(userHeroes.userId, userId)),
    db
      .select({ artifactId: userArtifacts.artifactId })
      .from(userArtifacts)
      .where(eq(userArtifacts.userId, userId)),
  ]);

  const tier = profile.rankTier as RankTier;
  const next = nextTier(tier);

  return NextResponse.json({
    userId,
    displayName: profile.displayName,
    avatarEmoji: profile.avatarEmoji,
    xp: profile.xp,
    rankTier: tier,
    rankTitle: RANK_META[tier].title,
    rankEra: RANK_META[tier].era,
    nextTierMinXp: next ? RANK_META[next].minXp : null,
    activeHeroId: profile.activeHeroId,
    streakDays: profile.streakDays,
    lastActiveDate: profile.lastActiveDate,
    streakFreeMode: profile.streakFreeMode,
    dailyDone: profile.lastActiveDate === todayInUlaanbaatar(),
    unlockedHeroIds: ownedHeroes.map((h) => h.heroId).sort((a, b) => a - b),
    artifactIds: ownedArtifacts.map((a) => a.artifactId).sort((a, b) => a - b),
    onboardingDone: profile.onboardingDone,
    playerPath: parsePlayerPath(profile.playerPath),
  });
});

export const PATCH = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const parsed = await parseBody(req, UpdateProfileRequestSchema);
  if (!parsed.ok) return parsed.response;
  const patch = parsed.data;

  // Идэвхтэй баатрыг зөвхөн НЭЭГДСЭН баатруудаас сонгоно
  if (patch.activeHeroId !== undefined && patch.activeHeroId !== null) {
    const ownedIds = await db
      .select({ heroId: userHeroes.heroId })
      .from(userHeroes)
      .where(eq(userHeroes.userId, userId));
    if (!ownedIds.some((h) => h.heroId === patch.activeHeroId)) {
      return apiError('HERO_LOCKED', 'Энэ баатар нээгдээгүй байна', 403);
    }
  }

  await db
    .update(profiles)
    .set({
      ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
      ...(patch.avatarEmoji !== undefined ? { avatarEmoji: patch.avatarEmoji } : {}),
      ...(patch.activeHeroId !== undefined ? { activeHeroId: patch.activeHeroId } : {}),
      ...(patch.streakFreeMode !== undefined
        ? { streakFreeMode: patch.streakFreeMode }
        : {}),
      ...(patch.onboardingDone !== undefined
        ? { onboardingDone: patch.onboardingDone }
        : {}),
      // B5 — null нь «эрэмбэлэхгүй»; undefined нь «бүү өөрчил»
      ...(patch.playerPath !== undefined ? { playerPath: patch.playerPath } : {}),
    })
    .where(eq(profiles.userId, userId));

  return NextResponse.json({ ok: true });
});
