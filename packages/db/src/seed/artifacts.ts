/**
 * Олдворууд — Бүлэг 3.1 (Artifact Museum)
 *
 * Алдааны засвар №6: эдгээр нь `/api/quiz/finish`-д нарийвчлал ≥70% үед
 * бодитоор олгогдоно. Өмнө нь `unlockArtifact` хаанаас ч дуудагддаггүй
 * байсан тул музей ҮҮРД хоосон байв.
 */
import type { EraKey } from './eras';

export interface ArtifactSeed {
  name: string;
  eraKey: EraKey;
  rarity: 'common' | 'rare' | 'epic';
  emoji: string;
  description: string;
  sourceRef: string;
}

export const ARTIFACT_SEED: ArtifactSeed[] = [
  {
    name: 'Хүннүгийн сум',
    eraKey: 'hunnu',
    rarity: 'common',
    emoji: '🎯',
    description: 'Хүннүчүүдийн ясан сум — нүүдэлчдийн цэргийн урлагийн бэлгэдэл.',
    sourceRef: 'Археологийн олдворын каталог, Хүннүгийн үе',
  },
  {
    name: 'Шаньюйн алтан тамга',
    eraKey: 'hunnu',
    rarity: 'epic',
    emoji: '🪙',
    description: 'Хүннүгийн дээд эрх мэдлийн бэлгэдэл болсон тамга.',
    sourceRef: 'Археологийн олдворын каталог, Хүннүгийн үе',
  },
  {
    name: 'Хүрэл тогоо',
    eraKey: 'hunnu',
    rarity: 'rare',
    emoji: '⚱️',
    description: 'Хүннүгийн булшнаас олдсон зан үйлийн хүрэл тогоо.',
    sourceRef: 'Ноён уулын малтлагын тайлан',
  },
  {
    name: 'Их Засагийн дэвтэр',
    eraKey: 'mongol',
    rarity: 'rare',
    emoji: '📜',
    description: 'Чингис хааны хууль цаазын цогцолборын хуулбар.',
    sourceRef: 'Их Засагийн судлал',
  },
  {
    name: 'Пайз (гэрчилгээ)',
    eraKey: 'mongol',
    rarity: 'epic',
    emoji: '🏅',
    description:
      'Өртөөгөөр зорчих эрхийг олгодог алтан пайз — элчийн халдашгүй байдлын тэмдэг.',
    sourceRef: 'Монгол улсын түүх, II боть; Марко Поло',
  },
  {
    name: 'Морин эмээл',
    eraKey: 'mongol',
    rarity: 'common',
    emoji: '🐴',
    description: 'Монгол морьтой салшгүй нүүдэлчний ахуйн эдлэл.',
    sourceRef: 'Археологийн олдворын каталог',
  },
  {
    name: 'Нум сум хийц',
    eraKey: 'mongol',
    rarity: 'rare',
    emoji: '🏹',
    description: 'Монгол цэргийн нийлмэл нум — 200 метрийн зайд онох чадвартай.',
    sourceRef: 'Монгол улсын түүх, II боть',
  },
  {
    name: 'Соёмбо тэмдэг',
    eraKey: 'bogd',
    rarity: 'rare',
    emoji: '☸️',
    description: '1911 оны тусгаар тогтнолын үеийн төрийн бэлгэдлийн элемент.',
    sourceRef: 'Монгол улсын түүх, III боть',
  },
  {
    name: 'Богд хааны тамга',
    eraKey: 'bogd',
    rarity: 'epic',
    emoji: '🔱',
    description: 'Олноо өргөгдсөн Монгол Улсын төрийн дээд тамга.',
    sourceRef: 'Монгол улсын түүх, III боть',
  },
  {
    name: 'Занабазарын хөрөг',
    eraKey: 'bogd',
    rarity: 'common',
    emoji: '🖼️',
    description: 'Соёмбо бичгийг зохиосон Өндөр гэгээн Занабазарын дүрслэл.',
    sourceRef: 'Монголын урлагийн түүх',
  },
];
