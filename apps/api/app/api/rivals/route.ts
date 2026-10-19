/**
 * GET /api/rivals — миний өрсөлдөгчид: тулааны оноо + өнөөдрийн төлөв
 *
 * Нүүр дэлгэцийн «Бат өнөөдөр 4/5 авсан — чи?» мөр эндээс ирнэ. Энэ бол
 * өдөр бүр эргэж ирэх хамгийн хүчтэй шалтгаан: найз чинь аль хэдийн тоглосон.
 */
import { NextResponse } from 'next/server';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { dailyPlays } from '@nomad/db';
import { db } from '@/lib/db';
import { requireAuth, route } from '@/lib/api';
import { todayKey } from '@/lib/daily';
import { peopleFor, recordBetween, rivalIdsOf, scoresByDay } from '@/lib/social';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_RIVALS = 50;

export const GET = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.user;

  const rivalIds = (await rivalIdsOf(userId)).slice(0, MAX_RIVALS);
  if (rivalIds.length === 0) return NextResponse.json({ rivals: [] });

  const today = todayKey();
  const [people, scores, todays] = await Promise.all([
    peopleFor(rivalIds),
    scoresByDay([userId, ...rivalIds]),
    db
      .select({ userId: dailyPlays.userId, correct: dailyPlays.correctCount, totalMs: dailyPlays.totalMs })
      .from(dailyPlays)
      .where(
        and(eq(dailyPlays.dayKey, today), inArray(dailyPlays.userId, rivalIds), isNotNull(dailyPlays.finishedAt))
      ),
  ]);

  const todayMap = new Map(todays.map((t) => [t.userId, t]));

  const rivals = rivalIds
    .map((id) => {
      const person = people.get(id);
      if (!person) return null;
      const t = todayMap.get(id);
      return {
        userId: id,
        displayName: person.displayName,
        title: person.title,
        record: recordBetween(scores, userId, id),
        today: {
          played: t !== undefined,
          // Оноо нь спойлер биш (асуулт илчлэхгүй) — харин «Бат 4/5 авсан»
          // гэдэг нь тоглох хамгийн хүчтэй уриалга. Сорилтын линктэй ижил зарчим.
          correct: t?.correct ?? null,
          totalMs: t?.totalMs ?? null,
        },
      };
    })
    .filter((r) => r !== null)
    // Өнөөдөр тоглосон нь эхэнд — «Бат аль хэдийн тоглосон» гэдэг уриалга
    .sort((a, b) => Number(b.today.played) - Number(a.today.played) || b.record.days - a.record.days);

  return NextResponse.json({ rivals });
});
