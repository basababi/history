/**
 * Гэрийн эд зүйл — ROADMAP B1
 *
 * СУДАЛГААНЫ ҮНДЭСЛЭЛ (Lee, Yi, Kim 2020): түвшин бүрд НЭГ шагнал.
 * Тэдний загвар: L2 шал · L3 ханын цаас · L4 хөгжим · L5 баримал · L6 зураг.
 *
 * Монгол хувилбар: гэрийн жинхэнэ эд зүйлс. Slot тус бүрд нэг л зүйл
 * байрлана — сонголт хийх нь стратеги болно.
 */
import type { EraKey } from './eras';

export type GerSlot =
  | 'floor'      // ширдэг, шал
  | 'wall'       // хөшиг, ханын чимэглэл
  | 'furniture'  // авдар, ор, ширээ
  | 'instrument' // морин хуур, ятга
  | 'roof'       // тооно
  | 'light';     // гэрэл, зул

export interface GerItemSeed {
  name: string;
  slot: GerSlot;
  eraKey: EraKey | null;
  rarity: 'common' | 'rare' | 'epic';
  emoji: string;
  description: string;
  sourceRef: string;
  unlockLevel: number;
}

export const GER_SLOT_LABEL: Record<GerSlot, string> = {
  floor: 'Шал',
  wall: 'Хана',
  furniture: 'Тавилга',
  instrument: 'Хөгжим',
  roof: 'Тооно',
  light: 'Гэрэл',
};

export const GER_ITEM_SEED: GerItemSeed[] = [
  // ─── Шал ───
  {
    name: 'Энгийн ширдэг',
    slot: 'floor',
    eraKey: null,
    rarity: 'common',
    emoji: '🟫',
    description: 'Хонины ноосоор хийсэн уламжлалт эсгий ширдэг.',
    sourceRef: 'Угсаатны зүйн судалгаа',
    unlockLevel: 1,
  },
  {
    name: 'Угалзан ширдэг',
    slot: 'floor',
    eraKey: 'mongol',
    rarity: 'rare',
    emoji: '🧶',
    description: 'Улзий хээгээр чимэглэсэн баялаг гэрийн ширдэг.',
    sourceRef: 'Монголын урлагийн түүх',
    unlockLevel: 3,
  },

  // ─── Хана ───
  {
    name: 'Эсгий хөшиг',
    slot: 'wall',
    eraKey: null,
    rarity: 'common',
    emoji: '🪟',
    description: 'Гэрийн ханыг дулаалах эсгий бүрээс.',
    sourceRef: 'Угсаатны зүйн судалгаа',
    unlockLevel: 1,
  },
  {
    name: 'Хатан хааны хивс',
    slot: 'wall',
    eraKey: 'mongol',
    rarity: 'epic',
    emoji: '🎴',
    description: 'Их Монголын үеийн язгууртны гэрийн ханын хивс.',
    sourceRef: 'Монгол улсын түүх, II боть',
    unlockLevel: 5,
  },

  // ─── Тавилга ───
  {
    name: 'Модон авдар',
    slot: 'furniture',
    eraKey: null,
    rarity: 'common',
    emoji: '🧰',
    description: 'Хувцас, эд хогшил хадгалах будаг зурагтай авдар.',
    sourceRef: 'Угсаатны зүйн судалгаа',
    unlockLevel: 2,
  },
  {
    name: 'Хүннүгийн хүрэл тогоо',
    slot: 'furniture',
    eraKey: 'hunnu',
    rarity: 'rare',
    emoji: '⚱️',
    description: 'Зан үйлд хэрэглэдэг байсан хүрэл тогоо.',
    sourceRef: 'Ноён уулын малтлагын тайлан',
    unlockLevel: 4,
  },

  // ─── Хөгжим ───
  {
    name: 'Морин хуур',
    slot: 'instrument',
    eraKey: null,
    rarity: 'rare',
    emoji: '🎻',
    description: 'Монголын бэлгэ тэмдэг болсон хоёр чавхдаст хөгжим.',
    sourceRef: 'ЮНЕСКО-гийн биет бус өвийн жагсаалт',
    unlockLevel: 3,
  },
  {
    name: 'Ятга',
    slot: 'instrument',
    eraKey: 'bogd',
    rarity: 'epic',
    emoji: '🪕',
    description: 'Ордны хөгжимд хэрэглэгддэг байсан олон чавхдаст зэмсэг.',
    sourceRef: 'Монголын хөгжмийн түүх',
    unlockLevel: 6,
  },

  // ─── Тооно ───
  {
    name: 'Энгийн тооно',
    slot: 'roof',
    eraKey: null,
    rarity: 'common',
    emoji: '☀️',
    description: 'Гэрийн орой дахь дугуй цонх — гэрэл, утааны гарц.',
    sourceRef: 'Угсаатны зүйн судалгаа',
    unlockLevel: 1,
  },
  {
    name: 'Соёмбот тооно',
    slot: 'roof',
    eraKey: 'bogd',
    rarity: 'epic',
    emoji: '☸️',
    description: 'Соёмбо тэмдэг сийлсэн ёслолын тооно.',
    sourceRef: 'Монгол улсын түүх, III боть',
    unlockLevel: 7,
  },

  // ─── Гэрэл ───
  {
    name: 'Зул',
    slot: 'light',
    eraKey: null,
    rarity: 'common',
    emoji: '🕯️',
    description: 'Цөцгийн тосны зул — гэрийн дулаан гэрэл.',
    sourceRef: 'Угсаатны зүйн судалгаа',
    unlockLevel: 2,
  },
  {
    name: 'Гал голомт',
    slot: 'light',
    eraKey: null,
    rarity: 'rare',
    emoji: '🔥',
    description: 'Гэрийн төв дэх голомт — гэр бүлийн бэлгэдэл.',
    sourceRef: 'Угсаатны зүйн судалгаа',
    unlockLevel: 5,
  },
];
