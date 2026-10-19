/**
 * POST /api/stats/rebuild — question_stats-ийг дахин тооцоолох cron (G2)
 *
 * Бүлэг 5.2: «question_stats — бодит цагийн шинэчлэлт биш, өдөрт нэг удаа
 * багц ажлаар (batch job) шинэчилнэ. Ингэснээр бичих ачаалал буурна.»
 *
 * Бүлэг 5.1: энэ статистикаар «хүндрэлийг автоматаар тохируулна».
 *
 * ⚠ Энэ хүснэгт өмнө нь схемд байсан боловч ЮУ Ч бичдэггүй байсан —
 * ашиглагдаагүй кодын сканаар илэрсэн.
 *
 * Vercel Cron-оос өдөрт нэг удаа дуудна.
 */
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { KPI_ACCURACY_MAX, KPI_ACCURACY_MIN } from '@nomad/core';
import { questionStats } from '@nomad/db';
import { db } from '@/lib/db';
import { apiError, route } from '@/lib/api';
import { timingSafeEqualStr } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = route(async (req) => {
  const provided = req.headers.get('authorization')?.replace('Bearer ', '') ?? '';
  const expected = process.env.CRON_SECRET;
  if (!expected || !timingSafeEqualStr(provided, expected)) {
    return apiError('UNAUTHORIZED', 'Cron нууц түлхүүр буруу', 401);
  }

  // Нэг асуулгаар бүх статистикийг дахин барина — мөр мөрөөр биш
  await db.execute(sql`
    INSERT INTO question_stats (question_id, attempts, correct_count, avg_ms)
    SELECT
      a.question_id,
      count(*)::int,
      count(*) FILTER (WHERE a.is_correct)::int,
      COALESCE(avg(a.response_ms), 0)::real
    FROM attempts a
    GROUP BY a.question_id
    ON CONFLICT (question_id) DO UPDATE SET
      attempts      = EXCLUDED.attempts,
      correct_count = EXCLUDED.correct_count,
      avg_ms        = EXCLUDED.avg_ms
  `);

  // ─── Чанарын тайлан (Бүлэг 8.4: зөв хариултын хувь 65–75%) ───
  const rows = await db
    .select({
      questionId: questionStats.questionId,
      attempts: questionStats.attempts,
      correctCount: questionStats.correctCount,
    })
    .from(questionStats);

  const MIN_SAMPLE = 20;
  const measured = rows.filter((r) => r.attempts >= MIN_SAMPLE);

  const tooEasy: number[] = [];
  const tooHard: number[] = [];

  for (const r of measured) {
    const acc = r.correctCount / r.attempts;
    if (acc > KPI_ACCURACY_MAX) tooEasy.push(r.questionId);
    else if (acc < KPI_ACCURACY_MIN) tooHard.push(r.questionId);
  }

  return NextResponse.json({
    questionsWithStats: rows.length,
    measured: measured.length,
    /** Хэт амархан — хүндрэлийг нэмэх нэр дэвшигч */
    tooEasy,
    /** Хэт хүнд — хүндрэлийг бууруулах эсвэл найруулгыг шалгах */
    tooHard,
    note:
      `Зорилтот нарийвчлал ${Math.round(KPI_ACCURACY_MIN * 100)}–` +
      `${Math.round(KPI_ACCURACY_MAX * 100)}% (Бүлэг 8.4). ` +
      `Дор хаяж ${MIN_SAMPLE} оролдлоготой асуултыг л үнэлнэ.`,
  });
});
