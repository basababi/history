/**
 * GET /api/og/default — брэндийн ерөнхий карт (PNG, 1200×630)
 * Нүүр хуудас эсвэл олдоогүй линкийг хуваалцахад гарна.
 */
import { ImageResponse } from 'next/og';
import { route } from '@/lib/api';
import { BrandCard, loadOgFonts, OG_SIZE } from '@/lib/og';

export const runtime = 'nodejs';

export const GET = route(async () => {
  const fonts = await loadOgFonts();
  return new ImageResponse(<BrandCard />, {
    ...OG_SIZE,
    fonts,
    headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' },
  });
});
