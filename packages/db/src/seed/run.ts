/**
 * Seed-ийн логик — драйвераас хамааралгүй.
 *
 * CLI (`seed/index.ts`) болон тест хоёулаа энэ функцийг дуудна. Ингэснээр
 * seed нь бодит Postgres дээр тесттэй болно.
 *
 * Идемпотент: дахин ажиллуулахад давхардуулахгүй.
 */
import { and, eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { validateStory } from '@nomad/core';
import {
  artifacts,
  eras,
  gerItems,
  heroes,
  knowledgeChunks,
  questions,
  stories,
  storyNodes,
} from '../schema';
import { ERA_SEED, type EraKey } from './eras';
import { HERO_SEED } from './heroes';
import { ARTIFACT_SEED } from './artifacts';
import { QUESTION_SEED } from './questions';
import { KNOWLEDGE_SEED } from './knowledge';
import { GER_ITEM_SEED } from './gerItems';
import { STORY_SEED } from './stories';

/* eslint-disable @typescript-eslint/no-explicit-any -- драйвер төрлөөс хараат бус */
type AnyDb = PgDatabase<any, any, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface SeedResult {
  eras: number;
  heroes: number;
  artifacts: number;
  questions: number;
  knowledge: number;
  gerItems: number;
  stories: number;
  skippedKnowledge: string[];
}

export async function seedAll(db: AnyDb): Promise<SeedResult> {
  // ─── Эринүүд ───
  const eraIds = new Map<EraKey, number>();
  for (const era of ERA_SEED) {
    const existing = await db
      .select({ id: eras.id })
      .from(eras)
      .where(eq(eras.name, era.name))
      .limit(1);

    if (existing[0]) {
      eraIds.set(era.key, existing[0].id);
      continue;
    }
    const [row] = await db
      .insert(eras)
      .values({
        name: era.name,
        orderIndex: era.orderIndex,
        startYear: era.startYear,
        endYear: era.endYear,
        description: era.description,
      })
      .returning({ id: eras.id });
    if (row) eraIds.set(era.key, row.id);
  }

  // ─── Баатрууд ───
  const heroIds = new Map<string, number>();
  for (const hero of HERO_SEED) {
    const eraId = eraIds.get(hero.eraKey);
    if (!eraId) throw new Error(`Эрин олдсонгүй: ${hero.eraKey}`);

    const existing = await db
      .select({ id: heroes.id })
      .from(heroes)
      .where(eq(heroes.name, hero.name))
      .limit(1);

    if (existing[0]) {
      heroIds.set(hero.name, existing[0].id);
      continue;
    }
    const [row] = await db
      .insert(heroes)
      .values({
        name: hero.name,
        eraId,
        rankTier: hero.rankTier,
        rarity: hero.rarity,
        perk: hero.perk,
        lore: hero.lore,
        sourceRef: hero.sourceRef,
        chronologicalOrder: hero.chronologicalOrder,
      })
      .returning({ id: heroes.id });
    if (row) heroIds.set(hero.name, row.id);
  }

  // ─── Олдворууд ───
  let artifactCount = 0;
  for (const artifact of ARTIFACT_SEED) {
    const eraId = eraIds.get(artifact.eraKey);
    if (!eraId) continue;

    const existing = await db
      .select({ id: artifacts.id })
      .from(artifacts)
      .where(eq(artifacts.name, artifact.name))
      .limit(1);
    if (!existing[0]) {
      await db.insert(artifacts).values({
        name: artifact.name,
        eraId,
        rarity: artifact.rarity,
        emoji: artifact.emoji,
        description: artifact.description,
        sourceRef: artifact.sourceRef,
      });
    }
    artifactCount += 1;
  }

  // ─── Асуултууд ───
  let questionCount = 0;
  for (const q of QUESTION_SEED) {
    const eraId = eraIds.get(q.eraKey);
    if (!eraId) continue;

    const existing = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.body, q.body))
      .limit(1);
    if (!existing[0]) {
      await db.insert(questions).values({
        eraId,
        difficulty: q.difficulty,
        format: q.format ?? 'classic',
        body: q.body,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        sourceRef: q.sourceRef,
        status: q.status,
        isGoldenStandard: q.isGoldenStandard ?? false,
      });
    }
    questionCount += 1;
  }

  // ─── RAG корпус ───
  let knowledgeCount = 0;
  const skippedKnowledge: string[] = [];
  for (const k of KNOWLEDGE_SEED) {
    const heroId = heroIds.get(k.heroName);
    if (!heroId) {
      skippedKnowledge.push(k.heroName);
      continue;
    }
    // Давхардлыг PERSONA-д хамааруулж шалгана: хоёр өөр дүр нэг түүхэн
    // баримтыг өөрийн өнцгөөс дурдаж болно (Бүлэг 6.4 persona тусгаарлалт).
    const existing = await db
      .select({ id: knowledgeChunks.id })
      .from(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.personaHeroId, heroId),
          eq(knowledgeChunks.text, k.text)
        )
      )
      .limit(1);
    if (!existing[0]) {
      await db.insert(knowledgeChunks).values({
        personaHeroId: heroId,
        keywords: k.keywords,
        text: k.text,
        sourceRef: k.sourceRef,
        status: 'published',
      });
    }
    knowledgeCount += 1;
  }

  // ─── Гэрийн эд зүйл (ROADMAP B1) ───
  let gerCount = 0;
  for (const item of GER_ITEM_SEED) {
    const eraId = item.eraKey ? eraIds.get(item.eraKey) : null;

    const existing = await db
      .select({ id: gerItems.id })
      .from(gerItems)
      .where(eq(gerItems.name, item.name))
      .limit(1);

    if (!existing[0]) {
      await db.insert(gerItems).values({
        name: item.name,
        slot: item.slot,
        eraId: eraId ?? null,
        rarity: item.rarity,
        emoji: item.emoji,
        description: item.description,
        sourceRef: item.sourceRef,
        unlockLevel: item.unlockLevel,
      });
    }
    gerCount += 1;
  }

  // ─── Интерактив өгүүлэмж (ROADMAP C2) ───
  let storyCount = 0;
  for (const story of STORY_SEED) {
    const eraId = eraIds.get(story.eraKey);
    if (!eraId) throw new Error(`Эрин олдсонгүй: ${story.eraKey}`);

    // ⚠ Эвдэрсэн граф ӨС-д ОРОХГҮЙ — хүүхэд хоосон дэлгэц харахаас сэргийлнэ
    const check = validateStory(story.nodes);
    if (!check.ok) {
      const detail = check.errors.map((e) => `${e.code}(${e.detail})`).join(', ');
      throw new Error(`Өгүүлэмжийн граф эвдэрсэн «${story.title}»: ${detail}`);
    }

    const existing = await db
      .select({ id: stories.id })
      .from(stories)
      .where(eq(stories.title, story.title))
      .limit(1);

    if (!existing[0]) {
      const [row] = await db
        .insert(stories)
        .values({
          eraId,
          title: story.title,
          summary: story.summary,
          sourceRef: story.sourceRef,
          xpReward: story.xpReward,
          // ⚠ draft — түүхч батлах хүртэл хүүхдэд харагдахгүй (Бүлэг 6.2)
          status: 'draft',
        })
        .returning({ id: stories.id });

      if (row) {
        for (const node of story.nodes) {
          await db.insert(storyNodes).values({
            storyId: row.id,
            key: node.key,
            body: node.body,
            choices: node.choices,
            endingLabel: node.endingLabel ?? null,
          });
        }
      }
    }
    storyCount += 1;
  }

  return {
    eras: eraIds.size,
    heroes: heroIds.size,
    artifacts: artifactCount,
    questions: questionCount,
    knowledge: knowledgeCount,
    gerItems: gerCount,
    stories: storyCount,
    skippedKnowledge,
  };
}
