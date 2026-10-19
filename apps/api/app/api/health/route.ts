/**
 * GET /api/health — байршуулалтын эрүүл мэндийн шалгалт
 *
 * Uptime монитор ба байршуулсны дараах шалгалтад: ӨС холбогдож байгаа,
 * өнөөдрийн тав тоглох боломжтой (≥5 нийтлэгдсэн асуулт) эсэх.
 */
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { DAILY_QUESTION_COUNT } from '@nomad/core';
import { db, isDbConfigured } from '@/lib/db';
import { route } from '@/lib/api';
import { todayKey } from '@/lib/daily';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, db: 'not_configured' }, { status: 503 });
  }

  try {
    const res = await db.execute(sql`SELECT count(*)::int AS n FROM questions WHERE status = 'published'`);
    // postgres-js нь массив, PGlite нь `{ rows }` буцаадаг
    const rows = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows) ?? [];
    const published = (rows[0] as { n?: number } | undefined)?.n ?? 0;
    const playable = published >= DAILY_QUESTION_COUNT;

    return NextResponse.json(
      { ok: playable, db: 'ok', publishedQuestions: published, today: todayKey() },
      { status: playable ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json({ ok: false, db: 'unreachable' }, { status: 503 });
  }
});
