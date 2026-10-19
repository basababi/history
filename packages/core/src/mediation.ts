/**
 * Зуучлал (mediation) — ROADMAP C1 · дипломын шинэлэг талын гол механик
 *
 * СУДАЛГААНЫ ҮНДЭСЛЭЛ: López-Enríquez нарын тоймд орсон 105 баримтын
 * НЭГ нь ч CEFR-ийн «зуучлал» чадамжийг авч үзээгүй. Судлаачид үүнийг
 * «өвийн хэл ярьдаг, цөөнхийн хамт олонд онцгой ач холбогдолтой»
 * алдагдсан боломж гэж нэрлэсэн — яг Монголын нөхцөл.
 *
 * Зуучлал = сурсан зүйлээ ӨӨРИЙН ҮГЭЭР өөр хүнд ойлгуулах.
 * Тиймээс оноолт нь ҮГЧИЛСЭН ДАВХЦАЛ БИШ:
 *
 *   • Гол нэр томьёог хамарсан эсэх (агуулга)   → 60 оноо
 *   • Өөрийн үгээр найруулсан эсэх (зуучлал)    → 25 оноо
 *   • Утга төгөлдөр урт (1 өгүүлбэр)             → 15 оноо
 *
 * ⚠ Тайлбарыг ХУУЛЖ буулгасан бол зуучлал болохгүй — «өөрийн үг» оноо 0.
 * Энэ нь механикийн бүх учир: ойлгосон эсэхийг хуулбар илрүүлж чадахгүй.
 *
 * ⚠ LLM ШААРДАХГҮЙ. Цэвэр детерминист тул хий үзэгдэл гарахгүй, тесттэй,
 *   офлайн ажиллана. LLM түлхүүр нэмэгдвэл энэ нь суурь оноо хэвээр үлдэж,
 *   LLM зөвхөн ЧАНАРЫН сэтгэгдэл нэмнэ (Бүлэг 6.4 — хий үзэгдлээс сэргийлэх).
 */
import { normalizeMongolian } from './text';

/** Зуучлалын даалгаврын төрөл — C1-ийн дөрвөн хэлбэр */
export type MediationKind =
  /** Дүү нартаа энгийн үгээр тайлбарла */
  | 'explain_simple'
  /** Гадаадад амьдардаг үе тэнгийнхэндээ англиар */
  | 'explain_english'
  /** Хуучин сурвалжийн хэллэгийг өнөөгийн монголоор */
  | 'modernize'
  /** Кирилл ↔ босоо бичиг */
  | 'script_bridge';

export const MEDIATION_KINDS: MediationKind[] = [
  'explain_simple',
  'explain_english',
  'modernize',
  'script_bridge',
];

export const MEDIATION_PROMPT: Record<MediationKind, string> = {
  explain_simple: 'Багадаа дүүдээ тайлбарлаж байгаа юм шиг НЭГ өгүүлбэрээр бич',
  explain_english: 'Гадаадад амьдардаг найздаа англиар нэг өгүүлбэрээр тайлбарла',
  modernize: 'Энэ хуучин хэллэгийг өнөөгийн ярианы монголоор бич',
  script_bridge: 'Энэ нэрийг босоо бичгээр хэрхэн бичихийг тайлбарла',
};

/** Хамгийн багадаа утга илэрхийлэх урт */
export const MEDIATION_MIN_CHARS = 20;
/** Нэг өгүүлбэрийн дээд хязгаар — эссэ бичүүлэхгүй */
export const MEDIATION_MAX_CHARS = 280;
/** Энэ онооноос дээш бол «ойлгосон» гэж үзнэ */
export const MEDIATION_PASS_SCORE = 55;
/** Амжилттай зуучлалын XP — Бүлэг 6.3: бүтээхэд урамшуулна */
export const MEDIATION_XP = 15;

/** Утга агуулаагүй туслах үгс — гол нэр томьёо болж тооцогдохгүй */
const STOPWORDS = new Set([
  'бол', 'нь', 'ба', 'болон', 'юм', 'байна', 'байсан', 'гэж', 'гэдэг',
  'энэ', 'тэр', 'ийм', 'тийм', 'бас', 'мон', 'их', 'сайн', 'хийсэн',
  'the', 'a', 'an', 'is', 'was', 'were', 'of', 'and', 'to', 'in', 'that',
]);

/** Цэг таслалыг зайгаар солино — том/жижиг үсгийг хөндөхгүй */
function stripPunctuation(text: string): string {
  return text.replace(/[.,!?;:()«»"'‘’“”\-–—]/g, ' ');
}

/** Текстийг утгатай үгсийн жагсаалт болгоно (жижиг үсгээр нормчилсон) */
function contentWords(text: string): string[] {
  return normalizeMongolian(stripPunctuation(text))
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/** Утгатай үгс — ЭХ ХЭЛБЭРЭЭР нь (том үсэг хадгалагдана) */
function rawContentWords(text: string): string[] {
  return stripPunctuation(text)
    .split(/\s+/)
    .filter((w) => {
      const norm = normalizeMongolian(w);
      return norm.length >= 3 && !STOPWORDS.has(norm);
    });
}

/**
 * Жишиг эхээс гол нэр томьёог гаргана.
 *
 * ⚠ РЕГРЕСС: анхны хувилбар нь зүгээр л «хамгийн урт үг»-ийг сонгодог
 * байсан тул монгол хэлний нөхцөлөөр уртассан үйл үг («байгуулалтыг»,
 * «нэвтрүүлсэн») оноосон нэрийг («Модун») бүрмөсөн шахаж гаргадаг байв.
 * Оноосон нэр бол яг л хэрэглэгчийн дурдах ЁСТОЙ зүйл тул түүнийг
 * эхэнд эрэмбэлнэ.
 */
export function deriveKeyTerms(text: string, limit = 5): string[] {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const w of rawContentWords(text)) {
    const norm = normalizeMongolian(w);
    if (seen.has(norm)) continue;
    seen.add(norm);
    words.push(w);
  }

  /** Том үсгээр эхэлсэн үг = оноосон нэр эсвэл товчлол */
  const isProper = (w: string) => w[0] !== undefined && w[0] !== w[0].toLowerCase();

  return words
    .sort((a, b) => {
      const pa = isProper(a) ? 1 : 0;
      const pb = isProper(b) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return b.length - a.length;
    })
    .slice(0, limit);
}

/**
 * Үгийн үндэс — монгол хэлний нөхцөл (-ийн, -ын, -д, -т, -аас…) таслана.
 * Төгс морфологи биш; давхцал хэмжихэд хангалттай ойролцоолол.
 */
function stem(word: string): string {
  return word.length > 5 ? word.slice(0, Math.max(4, word.length - 2)) : word;
}

export interface MediationInput {
  /** Хэрэглэгчийн бичсэн тайлбар */
  userText: string;
  /** Асуултын албан ёсны тайлбар — жишиг эх */
  referenceText: string;
  /** Заавал дурдвал зохих нэр томьёо (сонголтоор; хоосон бол эхээс гаргана) */
  keyTerms?: string[];
  kind?: MediationKind;
}

export interface MediationScore {
  /** 0–100 */
  score: number;
  /** Гол нэр томьёог хэр хамарсан (0–60) */
  coverageScore: number;
  /** Өөрийн үгээр найруулсан эсэх (0–25) */
  originalityScore: number;
  /** Уртын тохироо (0–15) */
  lengthScore: number;
  /** Дурдсан гол нэр томьёо */
  matchedTerms: string[];
  /** Дурдаагүй гол нэр томьёо — сануулга болгож үзүүлнэ */
  missedTerms: string[];
  /** Тайлбарыг бараг хуулсан эсэх */
  copied: boolean;
  /** Хэрэглэгчид харуулах монгол сэтгэгдэл */
  feedback: string;
  passed: boolean;
}

/**
 * Зуучлалын оноолт. ЦЭВЭР функц — I/O, санамсаргүй байдал байхгүй.
 * Эцсийн оноог зөвхөн сервер тооцоолно (Бүлэг 6.1).
 */
export function scoreMediation(input: MediationInput): MediationScore {
  const { userText, referenceText, keyTerms, kind = 'explain_simple' } = input;

  const trimmed = userText.trim();
  const userWords = contentWords(trimmed);
  const userStems = new Set(userWords.map(stem));

  // ─── Гол нэр томьёо ───
  // Тодорхойлоогүй бол жишиг эхийн хамгийн урт үгсийг авна: урт үг нь
  // монгол хэлэнд ихэвчлэн нэр томьёо байдаг (туслах үг богино).
  const terms =
    keyTerms && keyTerms.length > 0 ? keyTerms : deriveKeyTerms(referenceText);

  const matchedTerms: string[] = [];
  const missedTerms: string[] = [];
  for (const term of terms) {
    const hit = contentWords(term).some((w) => userStems.has(stem(w)));
    if (hit) matchedTerms.push(term);
    else missedTerms.push(term);
  }

  const coverageRatio = terms.length === 0 ? 0 : matchedTerms.length / terms.length;
  const coverageScore = Math.round(coverageRatio * 60);

  // ─── Өөрийн үгээр найруулсан эсэх ───
  // Жишиг эхтэй давхцах утгатай үгийн ХАРЬЦАА өндөр бол хуулсан гэж үзнэ.
  const refStems = new Set(contentWords(referenceText).map(stem));
  const shared = userWords.filter((w) => refStems.has(stem(w))).length;
  const overlapRatio = userWords.length === 0 ? 0 : shared / userWords.length;

  const normUser = normalizeMongolian(trimmed).replace(/\s+/g, ' ');
  const normRef = normalizeMongolian(referenceText).replace(/\s+/g, ' ');
  const copied = normRef.includes(normUser) && normUser.length > 30;

  let originalityScore: number;
  if (copied) originalityScore = 0;
  else if (overlapRatio > 0.8) originalityScore = 5;
  else if (overlapRatio > 0.6) originalityScore = 15;
  else originalityScore = 25;

  // ─── Урт ───
  const len = trimmed.length;
  let lengthScore: number;
  if (len < MEDIATION_MIN_CHARS) lengthScore = 0;
  else if (len > MEDIATION_MAX_CHARS) lengthScore = 8;
  else lengthScore = 15;

  const score = Math.min(100, coverageScore + originalityScore + lengthScore);
  const passed = score >= MEDIATION_PASS_SCORE && !copied;

  return {
    score,
    coverageScore,
    originalityScore,
    lengthScore,
    matchedTerms,
    missedTerms,
    copied,
    passed,
    feedback: buildFeedback({ score, copied, len, missedTerms, kind }),
  };
}

/**
 * Зуучлалын XP. Бүлэг 6.3: бүтээхэд урамшуулна — гэхдээ ХУУЛБАРТ ҮГҮЙ.
 * Хуулбарт XP олговол механик бүхэлдээ утгагүй болно.
 */
export function mediationXp(result: MediationScore): number {
  return result.passed && !result.copied ? MEDIATION_XP : 0;
}

/** Дэмжсэн өнгө аястай сэтгэгдэл — «унасан» гэж хэзээ ч хэлэхгүй */
function buildFeedback(a: {
  score: number;
  copied: boolean;
  len: number;
  missedTerms: string[];
  kind: MediationKind;
}): string {
  if (a.copied) {
    return 'Тайлбарыг шууд хуулчихжээ. Өөрийн үгээр хэлэх нь илүү хэцүү ч илүү үнэ цэнтэй — дахин оролдоод үз.';
  }
  if (a.len < MEDIATION_MIN_CHARS) {
    return 'Хэтэрхий богино байна. Дүү чинь үүнээс ойлгох болов уу? Бүтэн өгүүлбэр болгоод үз.';
  }
  if (a.score >= 85) {
    return 'Гайхалтай. Чи үүнийг үнэхээр ойлгосон байна — өөр хүнд ойлгуулж чадах нь хамгийн баттай нотолгоо.';
  }
  if (a.score >= MEDIATION_PASS_SCORE) {
    const miss = a.missedTerms[0];
    return miss
      ? `Сайн тайлбарлажээ. «${miss}» гэдгийг дурдвал бүр тодорхой болно.`
      : 'Сайн тайлбарлажээ. Өөрийн үгээр хэлж чадсан нь чухал.';
  }
  const miss = a.missedTerms.slice(0, 2).join(', ');
  return miss
    ? `Гол санаа нь дутуу үлдсэн байна. ${miss} — эднийг оруулаад дахин оролдоод үз.`
    : 'Гол санааг нь бүрэн барьж чадаагүй байна. Тайлбарыг дахин уншаад өөрийн үгээр хэлээд үз.';
}
