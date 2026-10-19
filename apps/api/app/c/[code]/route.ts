/**
 * GET /c/:code — сорилтын линк (Messenger, Instagram-д хуваалцах хаяг)
 *
 * Хүнд: SPA ачаалагдаж «Сорилт» дэлгэц шууд нээгдэнэ.
 * Messenger-ийн crawler-т: «Бат 4/5 авсан — чи давж чадах уу?» карт.
 */
import { DAILY_QUESTION_COUNT, formatDuration, isValidShareCode, normalizeShareCode } from '@nomad/core';
import { routeWith } from '@/lib/api';
import { dayNo, findPlayByShareCode, getDailySet } from '@/lib/daily';
import { peopleFor } from '@/lib/social';
import { publicOrigin, renderFallbackPage, renderLinkPage } from '@/lib/web';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = routeWith<{ code: string }>(async (req, params) => {
  const code = normalizeShareCode(params.code);
  const pathname = `/c/${code}`;
  if (!isValidShareCode(code)) return renderFallbackPage(req, pathname);

  const play = await findPlayByShareCode(code);
  if (!play?.finishedAt) return renderFallbackPage(req, pathname);

  const [people, set] = await Promise.all([peopleFor([play.userId]), getDailySet(play.dayKey)]);
  const owner = people.get(play.userId);
  const total = set.ok ? set.questionIds.length : DAILY_QUESTION_COUNT;
  const origin = publicOrigin(req);
  const name = owner?.displayName ?? 'Найз чинь';

  return renderLinkPage(
    {
      title: `${name} ${play.correctCount}/${total} авлаа — чи давж чадах уу?`,
      description: `Эртний Өв · Өдрийн тав #${dayNo(play.dayKey)} · ${formatDuration(play.totalMs)}. Монголын түүхийн 5 асуулт, 2 минут.`,
      imageUrl: `${origin}/api/og/challenge/${code}`,
      imageWidth: 1200,
      imageHeight: 630,
      url: `${origin}${pathname}`,
    },
    pathname
  );
});
