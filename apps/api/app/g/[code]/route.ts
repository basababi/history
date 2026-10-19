/**
 * GET /g/:code — найзын бүлгийн урилгын линк
 *
 * Хүнд: SPA ачаалагдаж «Бүлэгт нэгдэх» дэлгэц нээгдэнэ.
 * Crawler-т: бүлгийн нэр ба гишүүний тоотой карт.
 */
import { eq } from 'drizzle-orm';
import { isValidGroupCode, normalizeGroupCode } from '@nomad/core';
import { friendGroups } from '@nomad/db';
import { db } from '@/lib/db';
import { routeWith } from '@/lib/api';
import { memberCount } from '@/lib/groups';
import { publicOrigin, renderFallbackPage, renderLinkPage } from '@/lib/web';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = routeWith<{ code: string }>(async (req, params) => {
  const code = normalizeGroupCode(params.code);
  const pathname = `/g/${code}`;
  if (!isValidGroupCode(code)) return renderFallbackPage(req, pathname);

  const [group] = await db.select().from(friendGroups).where(eq(friendGroups.code, code)).limit(1);
  if (!group) return renderFallbackPage(req, pathname);

  const members = await memberCount(group.id);
  const origin = publicOrigin(req);

  return renderLinkPage(
    {
      title: `«${group.name}» бүлэгт нэгдээрэй`,
      description: `${members} гишүүн өдөр бүр Монголын түүхийн 5 асуултаар өрсөлдөж байна.`,
      imageUrl: `${origin}/api/og/group/${code}`,
      imageWidth: 1200,
      imageHeight: 630,
      url: `${origin}${pathname}`,
    },
    pathname
  );
});
