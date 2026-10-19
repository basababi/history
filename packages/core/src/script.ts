/**
 * Босоо монгол бичиг — үсгийн гүүр (ROADMAP C3)
 *
 * СУДАЛГААНЫ ҮНДЭСЛЭЛ: López-Enríquez нар Амазиг/Тифинаг бичгийн
 * тоглоомыг тэгш байдлын жишээ болгон онцолсон. Босоо бичиг нь яг ижил
 * тохиолдол — эрсдэлтэй бичиг, төрийн бодлогын дэмжлэгтэй.
 *
 * > «Тэгш байдал нь хоёрдогч үр дүн биш, зохиомжийн зарчим.»
 *
 * ⚠ ХАМРАХ ХҮРЭЭ — ЗОРИУДААР ЖИЖИГ: Энэ бол ҮСГИЙН харгалзаа, ХӨРВҮҮЛЭГЧ
 *   БИШ. Уйгуржин монгол бичиг нь байрлалаас хамаарсан хэлбэр (эхний /
 *   дундах / төгсгөлийн), эгшгийн зохицол, олон утгат тэмдэгттэй. Бүтэн
 *   хөрвүүлэлт хийнэ гэвэл хэл шинжлэлийн мэргэжилтэн шаардана —
 *   ROADMAP-ийн D1 (түүхч)-тэй адил блоклогдох байсан.
 *
 *   Тиймээс «өдөрт нэг үсэг» гэсэн хамгийн бага хэлбэрийг сонгосон:
 *   бие даасан хэлбэрийг нь таниулах. Энэ нь ЗӨВ бөгөөд ашигтай, харин
 *   үг хөрвүүлэх гэж оролдвол БУРУУ гарах эрсдэлтэй (Бүлэг 6.2 —
 *   түүхэн үнэн зөв байдал нь нэр хүндийн эрсдэл).
 */

/** Нэг үсгийн харгалзаа */
export interface ScriptLetter {
  /** Кирилл үсэг */
  cyrillic: string;
  /** Уйгуржин монгол бичгийн бие даасан хэлбэр (Unicode U+1820–U+1842) */
  mongol: string;
  /** Уншлага — хэрхэн дуудахыг тайлбарлана */
  reading: string;
  /** Санахад туслах сануулга */
  mnemonic: string;
}

/**
 * Үсгийн харгалзаа — бие даасан хэлбэр.
 *
 * ⚠ Unicode-ийн монгол блок нь тусгай фонт шаарддаг. Фонт байхгүй үед
 *   хоосон дөрвөлжин гарна — UI нь `mongol` талбарыг заавал `reading`-тэй
 *   ХАМТ харуулах ёстой (`ScriptCard` үүнийг хийдэг).
 */
export const SCRIPT_LETTERS: readonly ScriptLetter[] = [
  { cyrillic: 'А', mongol: 'ᠠ', reading: 'а', mnemonic: 'Шүдтэй босоо зураас — бүх эгшгийн эх' },
  { cyrillic: 'Э', mongol: 'ᠡ', reading: 'э', mnemonic: 'А-тай ижил хэлбэр, эмэгтэй эгшиг' },
  { cyrillic: 'И', mongol: 'ᠢ', reading: 'и', mnemonic: 'Хоёр шүд — нарийн эгшиг' },
  { cyrillic: 'О', mongol: 'ᠣ', reading: 'о', mnemonic: 'Гэдэстэй — дугуй эгшиг' },
  { cyrillic: 'У', mongol: 'ᠤ', reading: 'у', mnemonic: 'О-той ижил үндэс, эрэгтэй эгшиг' },
  { cyrillic: 'Ө', mongol: 'ᠥ', reading: 'ө', mnemonic: 'О-гийн эмэгтэй хос' },
  { cyrillic: 'Ү', mongol: 'ᠦ', reading: 'ү', mnemonic: 'У-гийн эмэгтэй хос' },
  { cyrillic: 'Н', mongol: 'ᠨ', reading: 'на', mnemonic: 'Цэгтэй шүд — Н, цэггүй бол А' },
  { cyrillic: 'Б', mongol: 'ᠪ', reading: 'ба', mnemonic: 'Гэдэстэй — уруулын гийгүүлэгч' },
  { cyrillic: 'М', mongol: 'ᠮ', reading: 'ма', mnemonic: 'Сүүл нь доош унжина' },
  { cyrillic: 'Л', mongol: 'ᠯ', reading: 'ла', mnemonic: 'М-тэй төстэй, сүүл нь өөр' },
  { cyrillic: 'С', mongol: 'ᠰ', reading: 'са', mnemonic: 'Хоёр салаа' },
  { cyrillic: 'Т', mongol: 'ᠲ', reading: 'та', mnemonic: 'Д-тэй нэг тэмдэгт — байрлалаар ялгагдана' },
  { cyrillic: 'Д', mongol: 'ᠳ', reading: 'да', mnemonic: 'Т-тэй хамт нэг үндэс' },
  { cyrillic: 'Г', mongol: 'ᠭ', reading: 'га', mnemonic: 'Х-тэй ойрхон — эгшгийн зохицол ялгана' },
  { cyrillic: 'Х', mongol: 'ᠬ', reading: 'ха', mnemonic: 'Г-ийн хатуу хос' },
  { cyrillic: 'Р', mongol: 'ᠷ', reading: 'ра', mnemonic: 'Гадаад гаралтай үгэнд элбэг' },
  { cyrillic: 'Ш', mongol: 'ᠱ', reading: 'ша', mnemonic: 'С-д нэмэлт зураастай' },
  { cyrillic: 'Ч', mongol: 'ᠴ', reading: 'ча', mnemonic: 'Ж-тэй нэг үндэс' },
  { cyrillic: 'Ж', mongol: 'ᠵ', reading: 'жа', mnemonic: 'Ч-ийн зөөлөн хос' },
  { cyrillic: 'Й', mongol: 'ᠶ', reading: 'я', mnemonic: 'Хагас эгшиг' },
  { cyrillic: 'В', mongol: 'ᠸ', reading: 'ва', mnemonic: 'Голдуу зээлдмэл үгэнд' },
  { cyrillic: 'К', mongol: 'ᠺ', reading: 'ка', mnemonic: 'Зээлдмэл үгэнд зориулсан' },
  { cyrillic: 'З', mongol: 'ᠽ', reading: 'за', mnemonic: 'Зээлдмэл үгэнд зориулсан' },
  { cyrillic: 'Ф', mongol: 'ᠹ', reading: 'фа', mnemonic: 'Зээлдмэл үгэнд зориулсан' },
  { cyrillic: 'П', mongol: 'ᠫ', reading: 'па', mnemonic: 'Б-гийн хатуу хос' },
];

/**
 * «Өдрийн үсэг» — огнооноос детерминистээр сонгоно.
 *
 * Санамсаргүй биш байх нь чухал: нэг өдөрт бүх хэрэглэгч ижил үсэг үзнэ
 * → ярилцах сэдэв болно, мөн серверлүү хүсэлт явуулах шаардлагагүй.
 *
 * @param ubDate Улаанбаатарын огноо 'YYYY-MM-DD' (`todayInUlaanbaatar`)
 */
export function letterOfTheDay(ubDate: string): ScriptLetter {
  let hash = 0;
  for (let i = 0; i < ubDate.length; i++) {
    hash = (hash * 31 + ubDate.charCodeAt(i)) % 100_000;
  }
  const index = hash % SCRIPT_LETTERS.length;
  return SCRIPT_LETTERS[index]!;
}

/**
 * Кирилл нэрийг үсэг тус бүрээр босоо бичигт харгалзуулна.
 *
 * ⚠ ЭНЭ НЬ ЗӨВ БИЧЛЭГ БИШ. Жинхэнэ уйгуржин бичигт үсэг нь байрлалаас
 *   хамаарч хэлбэрээ өөрчилдөг, эгшиг гээгддэг. Энэ функц нь зөвхөн
 *   «үсэг бүр ямар тэмдэгттэй харгалзахыг» СУРАЛЦАХАД зориулсан
 *   харгалзуулалт. UI нь үүнийг заавал ил тайлбарлах ёстой.
 */
export function letterBridge(cyrillicWord: string): Array<{
  cyrillic: string;
  mongol: string | null;
}> {
  const map = new Map(SCRIPT_LETTERS.map((l) => [l.cyrillic, l.mongol]));
  return [...cyrillicWord.toUpperCase()].map((ch) => ({
    cyrillic: ch,
    mongol: map.get(ch) ?? null,
  }));
}

/** Энэ таних тэмдгийг UI-д ил үзүүлнэ — хэрэглэгчийг төөрөгдүүлэхгүй */
export const SCRIPT_DISCLAIMER =
  'Энэ нь үсэг бүрийн бие даасан хэлбэр. Жинхэнэ бичихэд үсэг нь байрлалаасаа ' +
  'хамаарч хэлбэрээ өөрчилдөг — энд зөвхөн танилцуулж байна.';
