/**
 * GET  /api/retention/probe — хойшлуулсан шалгалтын асуултууд (Бүлэг 8.5)
 * POST /api/retention/probe — probe-ийн хариуг бүртгэнэ
 *
 * «Шинжилсэн 27 баримт бичгийн зөвхөн 3 нь (11.1%) сургалтын тогтвортой
 *  байдлыг хойшлуулсан шалгалтаар хэмжсэн... Боловсролын бүтээгдэхүүний
 *  хувьд энэ бол хамгийн чухал асуулт.»
 *
 * Хэрэглэгчийн санамсаргүй түүврийн 2, 4, 8, 12 дахь долоо хоногт,
 * тухайн хугацаанд ДАХИН ҮЗҮҮЛЭЭГҮЙ асуултуудаар шалгана.
 */
import { NextResponse } from 'next/server';
import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import { PROBE_WEEKS } from '@nomad/core';
import { questions, retentionProbes } from '@nomad/db';
import { db } from '@/lib/db';
import { z } from 'zod';
import { parseBody, requireAuth, route } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Хэрэглэгчийн хэдэн хувь probe-д хамрагдах вэ (санамсаргүй түүвэр) */
const SAMPLE_RATE = 0.2;

/** Нэг probe-д хэдэн асуулт */
const PROBE_SIZE = 5;

/** userId-аас тогтвортой түүвэр — нэг хэрэглэгч байнга адил шийдвэр авна */
function isInSample(userId: number): boolean {
  const h = (userId * 2654435761) % 1000;
  return h / 1000 < SAMPLE_RATE;
}

export const GET = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  if (!isInSample(userId)) {
    return NextResponse.json({ week: 2, questions: [], eligible: false });
  }

  const now = new Date();

  // Хугацаа нь болсон, хараахан шалгаагүй probe-уудыг олно
  const due = await db
    .select({
      questionId: retentionProbes.questionId,
      weekOffset: retentionProbes.weekOffset,
    })
    .from(retentionProbes)
    .where(
      and(
        eq(retentionProbes.userId, userId),
        isNull(retentionProbes.probedAt),
        lte(
          sql`${retentionProbes.firstCorrectAt} + (${retentionProbes.weekOffset} * interval '7 days')`,
          now
        )
      )
    )
    .limit(PROBE_SIZE);

  if (due.length === 0) {
    return NextResponse.json({ week: 2, questions: [], eligible: true });
  }

  const week = (due[0]?.weekOffset ?? 2) as (typeof PROBE_WEEKS)[number];

  const rows = await db
    .select({
      id: questions.id,
      eraId: questions.eraId,
      difficulty: questions.difficulty,
      body: questions.body,
      options: questions.options,
    })
    .from(questions)
    .where(inArray(questions.id, due.map((d) => d.questionId)));

  const servedAt = Date.now();

  return NextResponse.json({
    week,
    eligible: true,
    questions: rows.map((q) => ({
      id: q.id,
      eraId: q.eraId,
      difficulty: q.difficulty as 'easy' | 'medium' | 'hard',
      body: q.body,
      options: q.options as string[],
      servedAt,
    })),
  });
});

const ProbeAnswerSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.number().int(),
        selectedIndex: z.number().int().min(-1).max(9),
        weekOffset: z.union([
          z.literal(2),
          z.literal(4),
          z.literal(8),
          z.literal(12),
        ]),
      })
    )
    .max(20),
});

export const POST = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const parsed = await parseBody(req, ProbeAnswerSchema);
  if (!parsed.ok) return parsed.response;

  const ids = parsed.data.answers.map((a) => a.questionId);
  if (ids.length === 0) return NextResponse.json({ recorded: 0 });

  const qRows = await db
    .select({ id: questions.id, correctIndex: questions.correctIndex })
    .from(questions)
    .where(inArray(questions.id, ids));
  const qMap = new Map(qRows.map((q) => [q.id, q.correctIndex]));

  let recorded = 0;
  const now = new Date();

  for (const a of parsed.data.answers) {
    const correctIndex = qMap.get(a.questionId);
    if (correctIndex === undefined) continue;

    // ⚠ Probe-д XP ОЛГОХГҮЙ — энэ бол хэмжилт, тоглоом биш
    await db
      .update(retentionProbes)
      .set({ probedAt: now, retained: a.selectedIndex === correctIndex })
      .where(
        and(
          eq(retentionProbes.userId, userId),
          eq(retentionProbes.questionId, a.questionId),
          eq(retentionProbes.weekOffset, a.weekOffset)
        )
      );
    recorded += 1;
  }

  return NextResponse.json({ recorded });
});
