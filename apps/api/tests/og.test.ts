/**
 * OG картууд БОДИТООР зурагдана — Satori-ийн markup дүрэм (олон хүүхэдтэй
 * div-д `display: flex`) зөрчигдвөл production-д хариу дундаа тасардаг.
 * Тиймээс карт бүрийг PNG болтол нь зурж шалгана.
 */
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { ImageResponse } from 'next/og';
import { BrandCard, ChallengeCard, ChallengeStory, GroupCard, loadOgFonts, OG_SIZE, STORY_SIZE } from '../lib/og';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

async function render(element: React.ReactElement, size: { width: number; height: number }) {
  const res = new ImageResponse(element, { ...size, fonts: await loadOgFonts() });
  const buf = new Uint8Array(await res.arrayBuffer());
  return { type: res.headers.get('content-type'), buf };
}

const data = {
  dayNumber: 14,
  name: 'Бат-Эрдэнэ',
  title: 'Зуутын дарга',
  correct: 4,
  total: 5,
  timeText: '38 сек',
  marks: [true, true, false, true, true],
};

describe('OG картууд зурагдана (монгол кирилл фонттой)', () => {
  it('сорилтын карт 1200×630', async () => {
    const r = await render(createElement(ChallengeCard, { d: data }), OG_SIZE);
    expect(r.type).toBe('image/png');
    expect([...r.buf.slice(0, 4)]).toEqual(PNG_SIGNATURE);
    expect(r.buf.length).toBeGreaterThan(10_000);
  }, 30_000);

  it('story карт 1080×1920', async () => {
    const r = await render(createElement(ChallengeStory, { d: data }), STORY_SIZE);
    expect([...r.buf.slice(0, 4)]).toEqual(PNG_SIGNATURE);
  }, 30_000);

  it('бүлгийн урилга ба брэндийн карт', async () => {
    const g = await render(createElement(GroupCard, { name: 'ШУТИС 3-р курс', members: 12 }), OG_SIZE);
    const b = await render(createElement(BrandCard), OG_SIZE);
    expect([...g.buf.slice(0, 4)]).toEqual(PNG_SIGNATURE);
    expect([...b.buf.slice(0, 4)]).toEqual(PNG_SIGNATURE);
  }, 30_000);
});
