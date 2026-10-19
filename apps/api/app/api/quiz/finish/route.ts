/**
 * POST /api/quiz/finish — сессийн дүн (Бүлэг 3.6, 3.7, 6.1)
 *
 * ГОЛ ЗАРЧИМ (Бүлэг 6.1): «Чансааны оноог зөвхөн серверийн бичсэн
 * attempts дээрээс тооцоолно — клиентээс ирсэн нийт оноог ХЭЗЭЭ Ч
 * хүлээж авахгүй.» Тиймээс энд клиентээс XP авахгүй, attempts-аас нийлбэрлэнэ.
 *
 * Мөн энд хэрэгжсэн:
 *   - Бүлэг 3.6-ийн 4 бонус (алдааны засвар №5)
 *   - Streak + shield perk (алдааны засвар №7)
 *   - Идемпотент unlock (алдааны засвар №8)
 *   - Олдвор бодитоор олгогдоно (алдааны засвар №6)
 *   - Бодит эринээр ахиц (алдааны засвар №9)
 *   - Метакогнитив: итгэлтэй байж буруудсан асуултууд (Бүлэг 3.7)
 */
import { NextResponse } from 'next/server';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import {
  computeUnlocks,
  detectAnomaly,
  isoWeekKey,
  pickSessionArtifactReward,
  RANK_META,
  todayInUlaanbaatar,
  ubMonth,
  updateStreak,
  XP_RULES,
  awardDailyChallenge,
  awardStreak7,
  type BonusLedger,
  type RankTier,
} from '@nomad/core';
import { FinishSessionRequestSchema } from '@nomad/contracts';
import {
  artifacts,
  attempts,
  eras,
  heroes,
  profiles,
  questions,
  userArtifacts,
  userHeroes,
} from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, parseBody, requireAuth, route } from '@/lib/api';
import { verifySession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const parsed = await parseBody(req, FinishSessionRequestSchema);
  if (!parsed.ok) return parsed.response;

  const verified = verifySession(parsed.data.token);
  if (!verified.ok) {
    // Хугацаа дуусах нь дүн авахад саад болох ёсгүй — attempts аль хэдийн бичигдсэн.
    // Гэхдээ гарын үсэг буруу бол татгалзана.
    if (verified.error !== 'EXPIRED') {
      return apiError('INVALID_TOKEN', 'Хүчингүй session token', 401);
    }
  }
  const s = verified.ok ? verified.payload : null;
  if (!s) {
    return apiError(
      'SESSION_EXPIRED',
      'Сессийн хугацаа дууссан. Дүнг профайлаас харна уу.',
      410,
      false
    );
  }
  if (s.userId !== userId) {
    return apiError('TOKEN_USER_MISMATCH', 'Token өөр хэрэглэгчийнх байна', 403);
  }

  // ─── Оноог ЗӨВХӨН attempts-аас тооцоолно ───
  const rows = await db
    .select({
      questionId: attempts.questionId,
      isCorrect: attempts.isCorrect,
      responseMs: attempts.responseMs,
      xpAwarded: attempts.xpAwarded,
      confidenceLevel: attempts.confidenceLevel,
      eraId: questions.eraId,
    })
    .from(attempts)
    .innerJoin(questions, eq(attempts.questionId, questions.id))
    .where(and(eq(attempts.sessionId, s.sessionId), eq(attempts.userId, userId)));

  if (rows.length === 0) {
    return apiError('NO_ATTEMPTS', 'Энэ сесст хариулт бүртгэгдээгүй', 400);
  }

  const baseXp = rows.reduce((sum, r) => sum + r.xpAwarded, 0);
  const correctCount = rows.filter((r) => r.isCorrect).length;
  const totalQuestions = rows.length;

  // ─── Аномали илрүүлэлт (Бүлэг 6.1) ───
  const anomaly = detectAnomaly({
    responseMsList: rows.map((r) => r.responseMs),
    correctCount,
  });
  if (anomaly.flagged) {
    console.warn(
      `[anomaly] user=${userId} session=${s.sessionId} avgMs=${Math.round(anomaly.avgMs)} acc=${anomaly.accuracy}`
    );
  }

  // ─── Профайл ───
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile) return apiError('NO_PROFILE', 'Профайл олдсонгүй', 404);

  const today = todayInUlaanbaatar();
  const month = ubMonth(Date.now());
  const weekKey = isoWeekKey(Date.now());

  // Идэвхтэй баатарт streakShield perk байгаа эсэх (Бүлэг 3.2 perk 3)
  let hasShieldPerk = false;
  if (profile.activeHeroId !== null) {
    const [hero] = await db
      .select({ perk: heroes.perk })
      .from(heroes)
      .where(eq(heroes.id, profile.activeHeroId))
      .limit(1);
    hasShieldPerk = (hero?.perk as { streakShield?: boolean })?.streakShield === true;
  }

  // ─── Streak ───
  const streak = updateStreak(
    {
      lastActiveDate: profile.lastActiveDate,
      streakDays: profile.streakDays,
      streakShieldUsedMonth: profile.streakShieldUsedMonth,
      hasShieldPerk,
      freeMode: profile.streakFreeMode,
    },
    today,
    month
  );

  // ─── Бонусууд (Бүлэг 3.6 — алдааны засвар №5) ───
  const ledger = (profile.bonusLedger ?? {}) as BonusLedger;
  let bonusXp = 0;
  let workingLedger = ledger;

  // Өдрийн сорил: +50, өдөрт 1 (зөвхөн daily горимд)
  let dailyAwarded = false;
  if (s.mode === 'daily') {
    const daily = awardDailyChallenge(workingLedger, today);
    if (daily.awarded) {
      bonusXp += XP_RULES.dailyChallengeBonus;
      dailyAwarded = true;
      workingLedger = daily.ledger;
    }
  }

  // Streak 7 хоног: +200, долоо хоногт 1
  let streak7Awarded = false;
  if (streak.reachedWeekMilestone) {
    const s7 = awardStreak7(workingLedger, weekKey);
    if (s7.awarded) {
      bonusXp += XP_RULES.streak7DaysBonus;
      streak7Awarded = true;
      workingLedger = s7.ledger;
    }
  }

  const totalXp = baseXp + bonusXp;
  const newXp = profile.xp + totalXp;

  // ─── Unlock (идемпотент — алдааны засвар №8) ───
  const heroCatalog = await db
    .select({ id: heroes.id, rankTier: heroes.rankTier })
    .from(heroes);

  const owned = await db
    .select({ heroId: userHeroes.heroId })
    .from(userHeroes)
    .where(eq(userHeroes.userId, userId));

  const unlockResult = computeUnlocks({
    oldXp: profile.xp,
    newXp,
    oldUnlockedHeroIds: owned.map((o) => o.heroId),
    heroes: heroCatalog.map((h) => ({
      id: h.id,
      rankTier: h.rankTier as RankTier,
    })),
  });

  if (unlockResult.newHeroIds.length > 0) {
    await db
      .insert(userHeroes)
      .values(unlockResult.newHeroIds.map((heroId) => ({ userId, heroId })))
      .onConflictDoNothing();
  }

  // ─── Олдвор (алдааны засвар №6: музей бодитоор дүүрдэг) ───
  const ownedArtifacts = await db
    .select({ artifactId: userArtifacts.artifactId })
    .from(userArtifacts)
    .where(eq(userArtifacts.userId, userId));
  const ownedArtifactIds = ownedArtifacts.map((a) => a.artifactId);

  const available = await db
    .select({ id: artifacts.id, rarity: artifacts.rarity })
    .from(artifacts)
    .where(
      ownedArtifactIds.length > 0
        ? notInArray(artifacts.id, ownedArtifactIds)
        : sql`true`
    );

  const unlockedArtifactIds: number[] = [];
  const reward = pickSessionArtifactReward({
    correctCount,
    totalQuestions,
    availableArtifacts: available.map((a) => ({
      id: a.id,
      rarity: a.rarity as 'common' | 'rare' | 'epic',
    })),
  });
  if (reward) {
    const inserted = await db
      .insert(userArtifacts)
      .values({ userId, artifactId: reward.id })
      .onConflictDoNothing()
      .returning({ artifactId: userArtifacts.artifactId });
    if (inserted.length > 0) unlockedArtifactIds.push(reward.id);
  }

  // ─── Бодит эринээр ахиц (алдааны засвар №9) ───
  const eraRows = await db.select().from(eras);
  const eraMap = new Map(eraRows.map((e) => [e.id, e.name]));
  const byEra = new Map<number, { attempted: number; correct: number }>();
  for (const r of rows) {
    const acc = byEra.get(r.eraId) ?? { attempted: 0, correct: 0 };
    acc.attempted += 1;
    if (r.isCorrect) acc.correct += 1;
    byEra.set(r.eraId, acc);
  }
  const eraBreakdown = [...byEra.entries()]
    .map(([eraId, v]) => ({
      eraId,
      eraName: eraMap.get(eraId) ?? '—',
      attempted: v.attempted,
      correct: v.correct,
      accuracy: v.attempted > 0 ? v.correct / v.attempted : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy); // сул эрин эхэнд

  // ─── Метакогнитив: итгэлтэй байж буруудсан (Бүлэг 3.7) ───
  const overconfidentQuestionIds = rows
    .filter((r) => !r.isCorrect && r.confidenceLevel === 3)
    .map((r) => r.questionId);

  // ─── Профайл шинэчлэх ───
  const newTier = unlockResult.newTier;
  await db
    .update(profiles)
    .set({
      xp: newXp,
      rankTier: newTier,
      streakDays: streak.streakDays,
      lastActiveDate: streak.increased ? today : profile.lastActiveDate,
      streakShieldUsedMonth: streak.newShieldUsedMonth,
      bonusLedger: workingLedger,
      activeHeroId:
        profile.activeHeroId ?? unlockResult.allUnlockedHeroIds[0] ?? null,
    })
    .where(eq(profiles.userId, userId));

  return NextResponse.json({
    baseXp,
    bonusXp,
    totalXp,
    correctCount,
    totalQuestions,
    newXp,
    streakDays: streak.streakDays,
    streakIncreased: streak.increased,
    shieldUsed: streak.shieldUsed,
    dailyChallengeAwarded: dailyAwarded,
    streak7Awarded,
    rankUp: unlockResult.rankUp,
    newRankTitle: unlockResult.rankUp
      ? RANK_META[unlockResult.rankUp].title
      : null,
    unlockedHeroIds: unlockResult.newHeroIds,
    unlockedArtifactIds,
    eraBreakdown,
    overconfidentQuestionIds,
  });
});
