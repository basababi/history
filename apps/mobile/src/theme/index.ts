/**
 * Дизайны систем — Бүлэг 7.1
 *
 * Өнгөний үүрэг:
 *   неон ягаан → брэнд, үндсэн үйлдэл
 *   цэнхэр     → дэвшил, мэдээлэл
 *   алт        → шагнал, XP
 *   улаан      → алдаа, яаралтай
 *   эрин       → хаана байгааг өнгөөр нь мэднэ
 *   ink.*      → зөвхөн чимэглэл, төлөв илэрхийлэхгүй
 */

// ─── Суурь өнгө ───

/**
 * ══ ПАЛИТРЫН ЭРГЭЛТ ══
 *
 * ӨМНӨХ: хар хөх (#0A1729) + гуулин (#E0A03C). Хоёр өнгөт, намуун,
 * «музейн» аяс. Асуудал нь: (1) ямар ч тоглоомын аппын палитр — монгол
 * эх сурвалжгүй, (2) хүүхэд залуучуудад уйтгартай, (3) чимэглэл нь
 * дэвсгэртээ живдэг.
 *
 * ШИНЭ: лавлах зургуудын философи —
 *   • ОЛОН ӨНГӨ ЗЭРЭГ. Нэг хээн дотор индиго, шүр, хаш, цайвар зэрэг
 *     оршино. Уламжлалт монгол зурагт яг ийм (таван өнгө).
 *   • ЦАГААН КОНТУР. Өнгөт хэлбэрийг цагаанаар хүрээлэхэд цойлж
 *     харагдана — 2, 3-р лавлах зургийн гол заль.
 *   • НЕОН ЯГААН. 3-р лавлах зураг (морь уралдаан) нь уламжлалт хээг
 *     орчин үеийн график хэлээр ярьж байна. Энэ бол «музей» биш
 *     «тоглоом» — дипломын зорилготой яг нийцнэ.
 *
 * ⚠ Утга илэрхийлэх өнгө (success/error) ХЭВЭЭР. Тэдгээрийг брэндийн
 *   өнгөтэй хутгавал хэрэглэгч ногоон хээг «зөв» гэж уншина.
 */
export const colors = {
  /** Шөнийн гүн хөх торгон дэвсгэр — язгууртны тансаг суурь */
  bg: '#080E18',
  bgElevated: '#111A2C',
  bgCard: '#10192A',
  bgCardLight: '#18253E',
  bgSunken: '#050910',

  border: '#243550',
  borderStrong: '#3A527A',
  borderGold: 'rgba(218, 178, 86, 0.45)',

  text: '#F8F5EE',
  textMuted: '#9BB2CD',
  textDim: '#5B728E',
  /** Алтан/гуулин дэвсгэр дээрх бараан бичвэр */
  textOnBrass: '#0C0A04',

  /**
   * Эртний хааны алтлаг шаргал — үндсэн брэнд, эрхэмсэг өнгө.
   */
  primary: '#DDB058',
  primaryLight: '#F5D38A',
  primaryDark: '#A67B28',

  /** Хаш ногоон & оюу цэнхэр — ахиц, дэвшил, ялалт */
  sky: '#2FD2C5',
  skyDark: '#178E85',

  /** Шүрэн улаан & гал — анхааруулга, алдаа, өргөлт */
  accent: '#E65C3E',
  error: '#F05252',
  success: '#38C172',
  warning: '#F5A623',

  /** Цолны металл түвшин */
  bronze: '#CD7F32',
  silver: '#C0C7D6',
  gold: '#E5B842',
  platinum: '#7CE5F7',

  /** Ховордол — баатрын карт, олдвор */
  rarityCommon: '#7C8FA6',
  rarityRare: '#2FD2C5',
  rarityEpic: '#A855F7',
  rarityLegendary: '#E5B842',

  /**
   * Чимэглэлийн олон өнгөт багц — үүлэн хээ, хүрээ, дүрслэлд.
   */
  ink: {
    indigo: '#22427C',
    indigoDeep: '#112242',
    coral: '#D95338',
    sage: '#5F8E6E',
    cream: '#F4E8D2',
    teal: '#1A7A78',
    magenta: '#C8436E',
    /** Цагаан контур — өнгийг цойлгуулах halo */
    halo: '#FFFFFF',
  },

  // ─── Монгол зургийн палитр ───
  zurag: {
    turquoise: '#2BA6C4',
    turquoiseDeep: '#13586C',
    coral: '#D06042',
    coralDeep: '#9E3820',
    jade: '#459E75',
    goldLine: '#F2CD78',
    snow: '#EAF4FA',
    ink: '#080E18',
  },
};

/**
 * Гэрэлтэлт — гүн хөх дэвсгэр дээрх алтлаг болон оюу туяа.
 */
export const glow = {
  none: {},
  soft: {
    shadowColor: '#2FD2C5',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  brass: {
    shadowColor: '#DDB058',
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
} as const;

// ─── Эриний өнгө (Бүлэг 3.2) ───

/**
 * Эрин бүр өөрийн өнгөтэй — хэрэглэгч ямар үед байгаагаа өнгөөр нь мэднэ.
 * `eraId` нь seed-ийн `orderIndex`-тэй тохирно.
 */
export const eraColors: Record<number, { main: string; soft: string; label: string }> = {
  1: { main: '#FF6B4A', soft: '#2E1219', label: 'Хүннү гүрэн' },
  2: { main: '#2FE0DA', soft: '#0E2430', label: 'Их Монгол Улс' },
  3: { main: '#C061FF', soft: '#241239', label: 'Богд хаант ба шинэ үе' },
};

export function eraColor(eraId: number | null | undefined) {
  return (eraId && eraColors[eraId]) || { main: colors.primary, soft: colors.bgCard, label: '' };
}

// ─── Зай ───

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ─── Үсэг ───

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 16,
  lg: 20,
  xl: 26,
  xxl: 34,
  display: 44,
} as const;

/**
 * Гарчгийн нүүр. `expo-font`-оор ачаалагдана (`useAppFonts`).
 * Хуучин Android дээр системийн фонт монгол кириллийг зөв рендерлэхгүй
 * тохиолдол бий тул апп дотор багцлана (Бүлэг 5.4).
 */
export const fontFamily = {
  /** Montserrat — Ө, Ү бүрэн (Unbounded-д байгаагүй) */
  display: 'Montserrat_800ExtraBold',
  displayHeavy: 'Montserrat_800ExtraBold',
  displayBold: 'Montserrat_700Bold',
  body: undefined, // системийн — уншихад хамгийн тохиромжтой
  /**
   * Босоо монгол бичиг (Noto Sans Mongolian).
   *
   * ⚠ Ашиглахаас өмнө `useAppFonts().mongolScript` ЗААВАЛ шалгана.
   * Android-д монгол Unicode блок үндсэн байдлаар байхгүй тул фонт
   * ачаалагдаагүй үед хоосон дөрвөлжин гарна.
   */
  mongol: 'NotoSansMongolian_400Regular',
} as const;

// ─── Радиус ───

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  xl: 30,
  pill: 999,
} as const;

// ─── Гүнзгийрэл (сүүдэр) ───

/**
 * Өмнө нь огт байгаагүй — бүх зүйл хавтгай байсан тул юу нь дээгүүр,
 * юу нь чухал болох нь мэдэгдэхгүй байв.
 */
export const elevation = {
  none: {},
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  raised: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 9,
  },
  /** Гуулин товчны доорх «зузаан» — дарахад доошилно */
  button: {
    shadowColor: colors.primaryDark,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
} as const;

// ─── Gradient ───

export const gradients = {
  card: ['#162238', '#0E1726'] as const,
  cardActive: ['#1E304F', '#131F33'] as const,
  /** Үндсэн үйлдлийн товч — тансаг алтлаг шаргал */
  brass: ['#F5D38A', '#B58728'] as const,
  goldInlay: ['#FDF1C7', '#D4AF37', '#9A741B'] as const,
  sky: ['#38DFD8', '#148C88'] as const,
  screen: ['#080E18', '#050910'] as const,
  /** Гялалзалт — домогт баатрын карт */
  foil: ['transparent', 'rgba(255, 245, 204, 0.42)', 'transparent'] as const,
} as const;

// ─── Хөдөлгөөний хугацаа ───

/**
 * Тогтмол хугацаа — бүх анимаци нэг хэмнэлтэй байхын тулд.
 * `prefers-reduced-motion` идэвхтэй үед `motion.ts` эдгээрийг 0 болгоно.
 */
export const duration = {
  instant: 90,
  fast: 160,
  normal: 260,
  slow: 420,
  celebrate: 900,
} as const;
