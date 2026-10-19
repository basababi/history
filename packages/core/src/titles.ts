/**
 * Цол — Их Монгол Улсын аравтын зохион байгуулалтаар
 *
 * 18–25 насныханд гол шагнал нь эд зүйл биш, СТАТУС: найзуудынхаа өмнө
 * «Зуутын дарга» гэж харагдах. Шатлал нь түүхэн бодит бүтэц (аравт,
 * зуут, мянгат, түмэн) тул цол бүр өөрөө мэдлэг дамжуулна.
 *
 * Босго нь НИЙТ ЗӨВ ХАРИУЛТаар — өдөр бүр ~3–4 зөв:
 *   10 ≈ 3 хоног · 50 ≈ 2 долоо хоног · 200 ≈ 2 сар · 600 ≈ хагас жил
 */

export type TitleKey = 'daichin' | 'arav' | 'zuu' | 'myanga' | 'tumen';

export interface TitleTier {
  key: TitleKey;
  label: string;
  minCorrect: number;
}

export const TITLE_TIERS: readonly TitleTier[] = [
  { key: 'daichin', label: 'Дайчин', minCorrect: 0 },
  { key: 'arav', label: 'Аравтын дарга', minCorrect: 10 },
  { key: 'zuu', label: 'Зуутын дарга', minCorrect: 50 },
  { key: 'myanga', label: 'Мянгатын ноён', minCorrect: 200 },
  { key: 'tumen', label: 'Түмэний ноён', minCorrect: 600 },
];

export interface TitleProgress {
  tier: TitleTier;
  next: TitleTier | null;
  /** 0..1 — дараагийн цол хүртэлх явц */
  progress: number;
  /** Дараагийн цол хүртэл хэдэн зөв хариулт дутуу */
  remaining: number;
}

export function titleFor(totalCorrect: number): TitleProgress {
  const correct = Math.max(0, Math.floor(totalCorrect));
  let index = 0;
  TITLE_TIERS.forEach((t, i) => {
    if (correct >= t.minCorrect) index = i;
  });

  const tier = TITLE_TIERS[index] as TitleTier;
  const next = TITLE_TIERS[index + 1] ?? null;
  if (!next) return { tier, next: null, progress: 1, remaining: 0 };

  const span = next.minCorrect - tier.minCorrect;
  return {
    tier,
    next,
    progress: Math.min(1, (correct - tier.minCorrect) / span),
    remaining: next.minCorrect - correct,
  };
}
