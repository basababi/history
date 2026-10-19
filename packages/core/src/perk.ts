/**
 * Баатрын perk — Бүлэг 3.2, дөрвүүлээ бодитоор ажиллана
 * №2 (50/50) болон №3 (streak shield)-ийн төлөвийг сервер хянана.
 */

export interface HeroPerk {
  /** Perk 1: асуулт бүрд +N секунд */
  extraSeconds?: number;
  /** Perk 2: өдөрт 1 удаа буруу хариултын хагасыг арилгах */
  fiftyFifty?: boolean;
  /** Perk 3: сард 1 удаа streak хамгаалалт (streak.ts-д хэрэгжсэн) */
  streakShield?: boolean;
  /** Perk 4: тухайн баатрын эрины асуултад оноо ×N */
  eraBonusMultiplier?: number;
}

/**
 * Perk 4: эриний бонус.
 * @param heroEraId идэвхтэй баатрын эрин
 * @param questionEraId асуултын эрин
 */
export function applyEraBonus(
  xp: number,
  heroEraId: number | null,
  questionEraId: number,
  perk: HeroPerk
): number {
  if (
    heroEraId === null ||
    perk.eraBonusMultiplier === undefined ||
    heroEraId !== questionEraId
  ) {
    return xp;
  }
  return Math.round(xp * perk.eraBonusMultiplier);
}

/**
 * Perk 2: 50/50 — буруу хариултуудын дундаас хагасыг нь арилгана.
 * Сервер талаас дуудна; зөв хариулт ХЭЗЭЭ Ч арилгагдахгүй.
 * @param optionCount сонголтын тоо
 * @param correctIndex зөв хариултын индекс (зөвхөн сервер мэднэ)
 * @param removedToday өдөрт аль хэдийн ашигласан эсэх
 */
export function applyFiftyFifty(
  optionCount: number,
  correctIndex: number,
  removedToday: boolean
): { allowed: boolean; hiddenIndexes: number[] } {
  if (!removedToday && optionCount >= 2) {
    // Зөв хариултаас бусад бүх индекс
    const wrong: number[] = [];
    for (let i = 0; i < optionCount; i++) {
      if (i !== correctIndex) wrong.push(i);
    }
    // Хагасыг нь (доош тойм) санамсаргүй арилгана
    const removeCount = Math.floor(wrong.length / 2);
    const shuffled = [...wrong].sort(() => Math.random() - 0.5);
    return { allowed: true, hiddenIndexes: shuffled.slice(0, removeCount).sort((a, b) => a - b) };
  }
  return { allowed: false, hiddenIndexes: [] };
}