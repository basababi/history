/**
 * Монгол хэлний туслагчид — дэлгэцийн нэр, гарах тийн ялгал
 *
 * «Чи Батаас 1 оноогоор түрүүллээ» гэж зөв бичихийн тулд нэрийн араас
 * эгшиг зохицлын дагуу -аас/-ээс/-оос/-өөс залгана. Буруу залгавал
 * («Батээс») монгол хэрэглэгчид шууд анзаарна — машин орчуулга мэт
 * харагдаж, итгэл унана. Тодорхойлж чадахгүй нэрт (латин үсэг г.м.)
 * `null` буцааж, дуудагч тал залгавар шаардахгүй өгүүлбэр сонгоно.
 */

// ─── Дэлгэцийн нэр ───

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 24;

/** Зай шахаж, Unicode-ийг нэгтгэнэ */
export function normalizeDisplayName(raw: string): string {
  return raw.normalize('NFC').replace(/\s+/g, ' ').trim();
}

export type DisplayNameError = 'too_short' | 'too_long' | 'bad_chars' | 'no_letters' | 'link';

/**
 * Нэрийн шалгалт — клиент, сервер хоёулаа ИЖИЛ дүрэм ашиглана.
 *
 * Зөвшөөрөх: үсэг (кирилл, латин), тоо, зай, «.», «-», «_».
 * Линк, и-мэйл хориотой — нэрээр дамжуулан сурталчилгаа тарааж болохгүй.
 */
export function validateDisplayName(name: string): { ok: true } | { ok: false; error: DisplayNameError } {
  const n = normalizeDisplayName(name);
  const length = [...n].length;
  if (length < DISPLAY_NAME_MIN) return { ok: false, error: 'too_short' };
  if (length > DISPLAY_NAME_MAX) return { ok: false, error: 'too_long' };
  if (/https?:|www\.|@|\.(com|mn|net|org)\b/i.test(n)) return { ok: false, error: 'link' };
  if (!/^[\p{L}\p{M}\p{N} ._-]+$/u.test(n)) return { ok: false, error: 'bad_chars' };
  if (!/\p{L}/u.test(n)) return { ok: false, error: 'no_letters' };
  return { ok: true };
}

export const DISPLAY_NAME_ERROR_TEXT: Record<DisplayNameError, string> = {
  too_short: `Нэр хамгийн багадаа ${DISPLAY_NAME_MIN} тэмдэгт байна`,
  too_long: `Нэр ${DISPLAY_NAME_MAX} тэмдэгтээс хэтрэхгүй`,
  bad_chars: 'Зөвхөн үсэг, тоо, зай, «.», «-», «_» ашиглана',
  no_letters: 'Нэрэнд дор хаяж нэг үсэг байх ёстой',
  link: 'Нэрэнд линк, и-мэйл бичиж болохгүй',
};

/** Нэр тавиагүй хэрэглэгчийн харагдах нэр */
export const GUEST_DISPLAY_NAME = 'Зочин';

// ─── Гарах тийн ялгал (-аас/-ээс/-оос/-өөс) ───

const BACK_A = new Set(['а', 'у', 'я', 'ы']);
const BACK_O = new Set(['о', 'ё']);
const FRONT_E = new Set(['э', 'ү', 'е']);
const FRONT_OE = new Set(['ө']);
/** Зохицолд оролцохгүй (саармаг) эгшиг */
const NEUTRAL = new Set(['и', 'й']);
const VOWELS = new Set([...BACK_A, ...BACK_O, ...FRONT_E, ...FRONT_OE, 'и', 'ю']);

type Harmony = 'a' | 'o' | 'e' | 'oe';

/** Үгийн сүүлийн зохицох эгшгээр залгаварын төрлийг тогтооно */
function harmonyOf(word: string): Harmony | null {
  const letters = [...word.toLowerCase()];
  for (let i = letters.length - 1; i >= 0; i--) {
    const ch = letters[i] as string;
    if (NEUTRAL.has(ch)) continue;
    if (BACK_O.has(ch)) return 'o';
    if (FRONT_OE.has(ch)) return 'oe';
    if (BACK_A.has(ch)) return 'a';
    if (FRONT_E.has(ch)) return 'e';
    // «ю» нь «йу» (эр) эсвэл «йү» (эм) — өмнөх эгшгээр шийднэ
    if (ch === 'ю') continue;
  }
  // Зөвхөн «и» эгшигтэй үг (Чингис) эм үгийн залгавар авна
  return letters.some((c) => c === 'и') ? 'e' : null;
}

const SUFFIX: Record<Harmony, string> = { a: 'аас', o: 'оос', e: 'ээс', oe: 'өөс' };
const LONG_TAIL = /(аа|ээ|оо|өө|уу|үү|ий|ай|ой|уй|үй|эй|яа|еэ|ёо|юу)$/;

/**
 * Нэрийг гарах тийн ялгалд оруулна: «Бат» → «Батаас».
 *
 *   • Гийгүүлэгчээр төгссөн: шууд залгана (Болд → Болдоос)
 *   • Урт эгшиг, хоёр эгшгээр төгссөн: «г» жийрэг (Ариунаа → Ариунаагаас)
 *   • Богино эгшгээр төгссөн: эгшиг уртсана (Солонго → Солонгоос)
 *
 * Тодорхойлж чадахгүй бол `null`.
 */
export function ablative(name: string): string | null {
  const trimmed = normalizeDisplayName(name);
  if (trimmed.length === 0) return null;

  // Залгавар нь сүүлийн үгэнд залгагдана: «Бат-Эрдэнэ» → «Бат-Эрдэнээс»
  const lastWord = trimmed.split(/[\s-]/).pop() ?? '';
  if (!/^[а-яёөү]+$/i.test(lastWord)) return null;

  const harmony = harmonyOf(lastWord);
  if (!harmony) return null;
  const suffix = SUFFIX[harmony];
  const lower = lastWord.toLowerCase();

  if (/[ьъ]$/.test(lower)) return null;
  if (LONG_TAIL.test(lower)) return `${trimmed}г${suffix}`;

  const last = lower.slice(-1);
  if (VOWELS.has(last)) {
    // «и»-гээр төгссөн нэр ховор бөгөөд хэлбэр нь тогтворгүй — таахгүй
    if (last === 'и' || last === 'ю' || last === 'я') return null;
    return `${trimmed.slice(0, -1)}${suffix}`;
  }
  return `${trimmed}${suffix}`;
}
