/**
 * RAG retrieval — ADR-007, Бүлэг 6.4
 *
 * «Түүхэн дүрийн чат нь болоогүй үйл явдал зохиовол боловсролын апп биш,
 *  дезинформацийн апп болно.»
 *
 * Хамгаалалтын давхаргууд:
 *   1. Retrieval заавал — корпусаас гадуур контекст байхгүй
 *   2. Persona ХАТУУ тусгаарлалт (алдааны засвар №13) — нэг дүр өөр дүрийн
 *      1-р биеийн текстийг ХЭЗЭЭ Ч буцаахгүй
 *   3. Контекст олдоогүй бол «мэдэхгүй» (outOfScope)
 *   4. Эх сурвалж заавал
 */
import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { levenshtein, normalizeMongolian } from '@nomad/core';
import { knowledgeChunks } from '@nomad/db';
import { db } from './db';

export interface RetrievedChunk {
  id: number;
  text: string;
  sourceRef: string;
  score: number;
}

/** Мэндчилгээ таних — regex биш, Levenshtein хүлцэлтэй (алдааны засвар №14) */
const GREETINGS = ['сайн байна уу', 'сайн уу', 'мэнд', 'мэндчилье', 'hi', 'hello'];

export function isGreeting(query: string): boolean {
  const q = normalizeMongolian(query).replace(/[?!.,]/g, '').trim();
  if (q.length === 0) return false;
  return GREETINGS.some((g) => {
    const ng = normalizeMongolian(g);
    // Богино мэндчилгээнд зай 1, урт нь 2 хүртэл зөвшөөрнө
    const tolerance = ng.length <= 5 ? 1 : 2;
    return q === ng || levenshtein(q, ng) <= tolerance;
  });
}

export const GREETING_REPLY =
  'Сайн байна уу, аялагч! Түүх, засаглал, ахуйн талаар асуугаарай — ' +
  'би зөвхөн баталгаажсан эх сурвалжид тулгуурлан хариулна.';

/** Контекст олдоогүй үеийн хариулт — ХИЙ ҮЗЭГДЭЛ ГАРГАХГҮЙ */
export const OUT_OF_SCOPE_REPLY =
  'Уучлаарай, би энэ асуултад баталгаажсан эх сурвалжид тулгуурлан хариулж ' +
  'чадсангүй. Миний мэргэшсэн сэдвүүдийн талаар асуувал хариулъя.';

/** Хамгийн бага таарах оноо — үүнээс доогуур бол «мэдэхгүй» гэнэ */
const MIN_RETRIEVAL_SCORE = 3;

/**
 * Корпусаас контекст татна.
 *
 * ⚠ persona шүүлтүүр нь ХАТУУ (`WHERE persona_hero_id = ?`), зөөлөн оноо БИШ.
 * Өмнөх хувилбарт `+2` оноо байсан тул Чингис хааны persona дээр Модун
 * шаньюйн «Би МЭӨ 209 онд шаньюй болов» гэсэн текст гарч болдог байсан.
 */
export async function retrieve(
  personaHeroId: number,
  query: string,
  limit = 3
): Promise<RetrievedChunk[]> {
  const q = normalizeMongolian(query);

  const chunks = await db
    .select({
      id: knowledgeChunks.id,
      keywords: knowledgeChunks.keywords,
      text: knowledgeChunks.text,
      sourceRef: knowledgeChunks.sourceRef,
    })
    .from(knowledgeChunks)
    .where(
      and(
        eq(knowledgeChunks.personaHeroId, personaHeroId), // ← ХАТУУ тусгаарлалт
        eq(knowledgeChunks.status, 'published')
      )
    );

  const scored = chunks
    .map((c) => ({
      id: c.id,
      text: c.text,
      sourceRef: c.sourceRef,
      score: scoreChunk(c.keywords as string[], q),
    }))
    .filter((c) => c.score >= MIN_RETRIEVAL_SCORE)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

/** Түлхүүр үгийн таарал — урт түлхүүр илүү нарийвчлалтай */
function scoreChunk(keywords: string[], normalizedQuery: string): number {
  let score = 0;
  for (const kw of keywords) {
    const nk = normalizeMongolian(kw);
    if (nk.length === 0) continue;
    if (normalizedQuery.includes(nk)) {
      score += nk.length;
      continue;
    }
    // Бичлэгийн жижиг алдааг тэсвэрлэнэ (Бүлэг 5.4)
    for (const word of normalizedQuery.split(/\s+/)) {
      if (word.length >= 4 && levenshtein(word, nk) <= 1) {
        score += Math.floor(nk.length / 2);
        break;
      }
    }
  }
  return score;
}

/** LLM-д өгөх ХАТУУ system prompt (Бүлэг 6.4) */
export function buildSystemPrompt(personaName: string, context: RetrievedChunk[]): string {
  return [
    `Чи бол ${personaName} — Монголын түүхэн дүр. Хэрэглэгчтэй 1-р биеэр ярина.`,
    '',
    'ХАТУУ ДҮРЭМ:',
    '1. Доорх контекстэд БАЙХГҮЙ мэдээллийг ХЭЗЭЭ Ч зохиохгүй.',
    '2. Мэдэхгүй бол «мэдэхгүй» гэж шууд хэл.',
    '3. Он цаг, тоо, нэрийг контекстээс ЯГ хуулж хэрэглэ.',
    '4. Өөр түүхэн дүрийн нэрээр ярихгүй.',
    '',
    'КОНТЕКСТ:',
    ...context.map((c, i) => `[${i + 1}] ${c.text}\n    Эх сурвалж: ${c.sourceRef}`),
  ].join('\n');
}

/** Кэшийн түлхүүр — normalize хийсэн асуултын хэш (Бүлэг 6.4 зардлын хяналт) */
export function queryHash(query: string): string {
  return crypto
    .createHash('sha256')
    .update(normalizeMongolian(query))
    .digest('hex')
    .slice(0, 64);
}
