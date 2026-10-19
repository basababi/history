/**
 * GET /api/catalog — баатар, олдвор, эриний каталог (Бүлэг 3.1, 3.2)
 *
 * Хэрэглэгчийн нээсэн/цуглуулсан төлөвтэй хамт ирнэ.
 * ⚠ Баатрын perk нь ЗӨВХӨН харуулах зорилготой — үйлчлэлийг сервер хийнэ.
 */
import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { artifacts, eras, heroes, userArtifacts, userHeroes } from '@nomad/db';
import { db } from '@/lib/db';
import { requireAuth, route } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const [eraRows, heroRows, artifactRows, ownedHeroes, ownedArtifacts] =
    await Promise.all([
      db.select().from(eras).orderBy(asc(eras.orderIndex)),
      db.select().from(heroes).orderBy(asc(heroes.chronologicalOrder)),
      db.select().from(artifacts).orderBy(asc(artifacts.id)),
      db
        .select({ heroId: userHeroes.heroId })
        .from(userHeroes)
        .where(eq(userHeroes.userId, userId)),
      db
        .select({ artifactId: userArtifacts.artifactId })
        .from(userArtifacts)
        .where(eq(userArtifacts.userId, userId)),
    ]);

  const unlockedHeroIds = new Set(ownedHeroes.map((h) => h.heroId));
  const ownedArtifactIds = new Set(ownedArtifacts.map((a) => a.artifactId));

  return NextResponse.json({
    eras: eraRows.map((e) => ({
      id: e.id,
      name: e.name,
      orderIndex: e.orderIndex,
      startYear: e.startYear,
      endYear: e.endYear,
      description: e.description,
    })),
    heroes: heroRows.map((h) => ({
      id: h.id,
      name: h.name,
      eraId: h.eraId,
      rankTier: h.rankTier as 'bronze' | 'silver' | 'gold' | 'platinum',
      rarity: h.rarity,
      emoji: null,
      lore: h.lore,
      sourceRef: h.sourceRef,
      perk: h.perk as Record<string, never>,
      unlocked: unlockedHeroIds.has(h.id),
    })),
    artifacts: artifactRows.map((a) => ({
      id: a.id,
      name: a.name,
      eraId: a.eraId,
      rarity: a.rarity as 'common' | 'rare' | 'epic',
      emoji: a.emoji,
      description: a.description,
      sourceRef: a.sourceRef,
      owned: ownedArtifactIds.has(a.id),
    })),
  });
});
