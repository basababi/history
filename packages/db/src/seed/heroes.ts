/**
 * Баатрууд — Бүлэг 3.2
 *
 * ⚠ Он цагийн дараалал (Бүлэг 3.2 анхааруулга): rank ахих тусам
 * хэрэглэгч он цагаар УРАГШ явна. `chronologicalOrder` нь үүнийг
 * `validateHeroChronology()` тестээр баталгаажуулна.
 *
 * Perk-үүд ДӨРВҮҮЛЭЭ бодитоор ажиллана (алдааны засвар №7):
 *   extraSeconds → session route; fiftyFifty → /api/quiz/fifty-fifty
 *   streakShield → finish route; eraBonusMultiplier → answer route
 */
import type { EraKey } from './eras';

export interface HeroSeed {
  name: string;
  eraKey: EraKey;
  rankTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  perk: Record<string, number | boolean>;
  lore: string;
  sourceRef: string;
  chronologicalOrder: number;
}

export const HERO_SEED: HeroSeed[] = [
  // ─── Bronze — Хүннү гүрэн (МЭӨ III зуун) ───
  {
    name: 'Модун шаньюй',
    eraKey: 'hunnu',
    rankTier: 'bronze',
    rarity: 'common',
    perk: { extraSeconds: 5 },
    lore:
      'Хүннүгийн агуу шаньюй (МЭӨ 209–174). Төв Азийн тал нутгийг нэгтгэж, ' +
      'Хүннү гүрнийг оргилд нь хүргэсэн стратегич.',
    sourceRef: 'Ши цзи (Түүхийн тэмдэглэл); Монгол улсын түүх, I боть',
    chronologicalOrder: 1.0,
  },

  // ─── Silver — Их Монгол Улс (XIII зуун) ───
  {
    name: 'Чингис хаан',
    eraKey: 'mongol',
    rankTier: 'silver',
    rarity: 'rare',
    perk: { fiftyFifty: true },
    lore:
      'Их Монгол Улсыг үндэслэгч (1162–1227). 1206 онд Их хуралдайгаар ' +
      'хаан өргөмжлөгдөж, Их Засаг хуулийг баталсан.',
    sourceRef: 'Монголын нууц товчоо, §202–§214',
    chronologicalOrder: 2.0,
  },
  {
    name: 'Бөртэ үжин',
    eraKey: 'mongol',
    rankTier: 'silver',
    rarity: 'rare',
    perk: { eraBonusMultiplier: 1.5 },
    lore:
      'Чингис хааны их хатан. Хонгирад аймгаас гаралтай, Их Монгол Улсын ' +
      'хатдын уламжлалыг үндэслэгч.',
    sourceRef: 'Монголын нууц товчоо, §96–§100',
    chronologicalOrder: 2.1,
  },
  {
    name: 'Сүбээдэй баатар',
    eraKey: 'mongol',
    rankTier: 'silver',
    rarity: 'epic',
    perk: { extraSeconds: 3 },
    lore:
      'Монголын цэргийн хамгийн алдарт стратегич (1175–1248). Баруун ' +
      'кампанийг удирдаж, шуурхай тактикийн сургуулийг тогтоов.',
    sourceRef: 'Монголын нууц товчоо, §199–§257',
    chronologicalOrder: 2.2,
  },

  // ─── Gold — Богд хаант ба шинэ үе (XVII–XX зуун) ───
  {
    name: 'Ану хатан',
    eraKey: 'bogd',
    rankTier: 'gold',
    rarity: 'epic',
    perk: { streakShield: true },
    lore:
      'Хотгойдын Ану хатан. 1696 онд Зуунмодны тулаанд нөхөр Галдан ' +
      'бошигтыгоо авархаар амь өрссөн эмэгтэй баатар.',
    sourceRef: 'Монгол улсын түүх, III боть',
    chronologicalOrder: 3.0,
  },
  {
    name: 'Манлайбаатар Дамдинсүрэн',
    eraKey: 'bogd',
    rankTier: 'gold',
    rarity: 'epic',
    perk: { eraBonusMultiplier: 1.5 },
    lore:
      '1911 оны тусгаар тогтнолын үеийн жанжин (1871–1920). Ховдын ' +
      'чөлөөлөх тулалдааныг удирдаж «Манлайбаатар» цол хүртсэн.',
    sourceRef: 'Монгол улсын түүх, III боть',
    chronologicalOrder: 3.5,
  },

  // ─── Platinum — Бүх эриний нэгдсэн түвшин ───
  // Алдааны засвар №23: өмнө нь platinum tier-т баатар БАЙХГҮЙ байсан тул
  // 4000 XP хүрсэн хэрэглэгч юу ч авдаггүй байв.
  {
    name: 'Их Хааны Сүлд',
    eraKey: 'mongol',
    rankTier: 'platinum',
    rarity: 'legendary',
    perk: { extraSeconds: 5, fiftyFifty: true, eraBonusMultiplier: 1.5 },
    lore:
      'Бүх эриний мэдлэгийг эзэмшсэний бэлгэдэл. Хүннүгээс Богд хаант ' +
      'Монгол хүртэлх түүхийг туулсан аялагчид олгогдоно.',
    sourceRef: 'Монгол улсын түүх, I–III боть (нэгдсэн)',
    chronologicalOrder: 4.0,
  },
];
