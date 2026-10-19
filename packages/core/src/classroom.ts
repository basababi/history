/**
 * Ангийн лиг ба хамтын зорилт (ROADMAP B4)
 *
 * СУДАЛГААНЫ ҮНДЭСЛЭЛ: Lee & Ko (2026) — үе тэнгийн харилцаа нь AI-тай
 * харилцахтай ИЖИЛ үр дүн өгдөг. Одоо аппд хүн–хүний харилцаа огт байхгүй.
 *
 * ⚠ АЮУЛГҮЙ ХЭЛБЭР: ЧӨЛӨӨТ БИЧВЭР ОГТ БАЙХГҮЙ. Хүүхдүүд зөвхөн
 *   • нэгдэх (кодоор)
 *   • оноогоороо жагсах
 *   • хамтын зорилтод хувь нэмэр оруулах
 *   боломжтой. Чат, сэтгэгдэл, зураг байхгүй тул Бүлэг 6.5-ын
 *   модерацийн шийдвэр хэвээр — шинэ эрсдэл нэмэгдэхгүй.
 *
 * ⚠ ХАМТЫН ЗОРИЛТ нь ӨРСӨЛДӨӨН БИШ: анги НИЙЛЭЭД зорилгодоо хүрнэ.
 *   Сул сурдаг хүүхэд ч хувь нэмэр оруулна — энэ нь ганцаарчилсан
 *   чансаанаас илүү оролцоо төрүүлдэг.
 */

/** Ангийн код — андуурч уншихад хялбар тэмдэгт хассан */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CLASSROOM_CODE_LENGTH = 6;

/**
 * Кодыг хэвийн хэлбэрт оруулна — том үсэг болгож, зай/зураас хасна.
 *
 * ⚠ ЯАГААД ТЭМДЭГТ СОЛИХГҮЙ ВЭ: `CODE_ALPHABET`-аас I, O, 0, 1 үсгийг
 *   ЗОРИУДААР хассан — самбар дээрээс уншихад андуурагддаг тул. Тиймээс
 *   хэрэглэгч «O» бичсэн бол ямар үсэг санаачилсныг ТААХ БОЛОМЖГҮЙ
 *   (Q? D? 0?). Таавал буруу ангид чимээгүй нэгдэх эрсдэлтэй.
 *
 *   Зөв зан төлөв: хүчингүй тэмдэгтийг хэвээр үлдээж `isValidClassroomCode`
 *   татгалзана — UI нь «код буруу байна» гэж ТОДОРХОЙ хэлнэ.
 */
export function normalizeClassroomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .slice(0, CLASSROOM_CODE_LENGTH);
}

export function isValidClassroomCode(code: string): boolean {
  if (code.length !== CLASSROOM_CODE_LENGTH) return false;
  return [...code].every((c) => CODE_ALPHABET.includes(c));
}

/**
 * Санамсаргүй код үүсгэнэ.
 * @param random 0–1 буцаадаг функц — тестэд детерминист болгож өгнө
 */
export function generateClassroomCode(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < CLASSROOM_CODE_LENGTH; i++) {
    const idx = Math.floor(random() * CODE_ALPHABET.length) % CODE_ALPHABET.length;
    out += CODE_ALPHABET[idx];
  }
  return out;
}

/** Нэг ангид хамгийн ихдээ хэдэн сурагч */
export const CLASSROOM_MAX_MEMBERS = 60;

/** Хамтын зорилтын үндсэн хэмжээ — «анги нийлээд 1000 асуулт» */
export const DEFAULT_CLASS_GOAL = 1000;

export interface ClassGoalProgress {
  /** 0–1 */
  ratio: number;
  /** Хувиар — дэлгэцэд */
  percent: number;
  current: number;
  target: number;
  reached: boolean;
  /** Хүүхдэд харагдах урам зоригийн мессеж */
  message: string;
}

/**
 * Хамтын зорилтын явц. ЦЭВЭР функц.
 *
 * ⚠ Мессеж нь ХЭЗЭЭ Ч хэн нэгнийг буруутгахгүй — «та бүхэн» гэсэн
 *   хамтын хэлбэр. Хувь хүнийг тодруулбал сул сурдаг хүүхэд гутарна.
 */
export function classGoalProgress(current: number, target: number): ClassGoalProgress {
  const safeTarget = Math.max(1, target);
  const ratio = Math.min(1, Math.max(0, current / safeTarget));
  const percent = Math.round(ratio * 100);
  const reached = current >= safeTarget;

  let message: string;
  if (reached) {
    message = 'Зорилгодоо хүрлээ! Анги бүхэлдээ хийсэн ажил.';
  } else if (percent >= 75) {
    message = 'Бараг л боллоо. Үлдсэн хэсэг нь та бүхний гарт.';
  } else if (percent >= 40) {
    message = 'Тал хувь нь боллоо. Хамтдаа үргэлжлүүлье.';
  } else if (current > 0) {
    message = 'Эхлэл тавигдлаа. Өдөр бүр бага багаар нэмэгдэнэ.';
  } else {
    message = 'Анги хамтдаа эхлэх гэж байна.';
  }

  return { ratio, percent, current, target: safeTarget, reached, message };
}

/**
 * Ангийн чансаа — БҮХ гишүүн харагдана.
 *
 * ⚠ Зөвхөн эхний 3-ыг харуулах нь бусдыг үл үзэгдэх болгоно. Ангид
 *   30 хүүхэд байхад 27 нь өөрийгөө олж харахгүй бол оролцоо унана.
 */
export interface ClassRankEntry {
  userId: number;
  weeklyXp: number;
  rank: number;
}

export function rankClassMembers(
  members: ReadonlyArray<{ userId: number; weeklyXp: number }>
): ClassRankEntry[] {
  const sorted = [...members].sort((a, b) => {
    if (b.weeklyXp !== a.weeklyXp) return b.weeklyXp - a.weeklyXp;
    // Тэнцвэл ID-аар — тогтвортой эрэмбэ, санамсаргүй байдалгүй
    return a.userId - b.userId;
  });

  const out: ClassRankEntry[] = [];
  let lastXp: number | null = null;
  let lastRank = 0;

  sorted.forEach((m, i) => {
    // Ижил оноотой бол ижил байр — «тэнцсэн» гэдгийг зөв харуулна
    const rank = lastXp !== null && m.weeklyXp === lastXp ? lastRank : i + 1;
    lastXp = m.weeklyXp;
    lastRank = rank;
    out.push({ userId: m.userId, weeklyXp: m.weeklyXp, rank });
  });

  return out;
}
