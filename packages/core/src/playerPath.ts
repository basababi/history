/**
 * Тоглогчийн төрлөөр зам салгах (ROADMAP B5)
 *
 * СУДАЛГААНЫ ҮНДЭСЛЭЛ: Khan — «хувийн болголт нь сэдэлд амин чухал».
 * Бүх хүүхэд ижил шалтгаанаар сурдаггүй: нэг нь тэргүүлэхийн төлөө,
 * нөгөө нь цуглуулахын төлөө, гурав дахь нь зүгээр л сонирхолтой учраас.
 *
 * ⚠ ЭНЭ НЬ ХААЛТ БИШ, ЭРЭМБЭ. Зам сонгосон ч бүх боломж нээлттэй хэвээр
 *   байна — зөвхөн нүүр дэлгэцийн ЭРЭМБЭ өөрчлөгдөнө. Хаалт хийвэл
 *   Бүлэг 3.7-ийн «бие даасан байдал» зарчмыг зөрчинө.
 *
 * ⚠ Хэзээ ч өөрчилж болно. Анхны сонголт нь буруу байх нь хэвийн —
 *   хүүхэд өөрийгөө таньж амжаагүй байж болно.
 */

export type PlayerPath =
  /** Өрсөлдөгч — лиг, PvP, чансаа */
  | 'competitor'
  /** Цуглуулагч — баатар, олдвор, гэрийн засал */
  | 'collector'
  /** Судлаач — чөлөөт горим, гүн тайлбар, AI зөвлөх */
  | 'researcher'
  /** Өгүүлэгч — өвөө эмээгийн дуу хоолой, зуучлал */
  | 'storyteller';

export const PLAYER_PATHS: readonly PlayerPath[] = [
  'competitor',
  'collector',
  'researcher',
  'storyteller',
];

export interface PlayerPathMeta {
  /** Хүүхдэд харагдах нэр */
  label: string;
  emoji: string;
  /** «Чи ямар хүн бэ?» гэсэн асуултын хариулт — өөрийгөө таних хэллэг */
  selfDescription: string;
  /** Энэ замд нүүр дэлгэцэд ТҮРҮҮЛЖ гарах үйлдлүүд */
  priority: readonly PathAction[];
}

/** Нүүр дэлгэцээс шууд очиж болох газрууд */
export type PathAction =
  | 'league'
  | 'battle'
  | 'heroes'
  | 'ger'
  | 'freeMode'
  | 'mentor'
  | 'contribution'
  | 'voiceBattle'
  | 'script';

export const PLAYER_PATH_META: Record<PlayerPath, PlayerPathMeta> = {
  competitor: {
    label: 'Өрсөлдөгч',
    emoji: '⚔️',
    selfDescription: 'Би тэргүүлэх дуртай. Чансаа, тулаан намайг татдаг.',
    priority: ['league', 'battle', 'freeMode', 'heroes'],
  },
  collector: {
    label: 'Цуглуулагч',
    emoji: '🏺',
    selfDescription: 'Би бүрэн цуглуулга хийх дуртай. Баатар, олдвор, гэрээ засах.',
    priority: ['heroes', 'ger', 'freeMode', 'league'],
  },
  researcher: {
    label: 'Судлаач',
    emoji: '🔍',
    selfDescription: 'Би яагаад гэдгийг мэдэх дуртай. Гүнзгий тайлбар хэрэгтэй.',
    priority: ['freeMode', 'mentor', 'script', 'heroes'],
  },
  storyteller: {
    label: 'Өгүүлэгч',
    emoji: '📖',
    selfDescription: 'Би түүх ярих, хуваалцах дуртай. Өвөө эмээгийн үлгэр сонсдог.',
    priority: ['contribution', 'voiceBattle', 'script', 'freeMode'],
  },
};

/**
 * Нүүр дэлгэцийн үйлдлүүдийг сонгосон замын дагуу эрэмбэлнэ.
 *
 * ⚠ ЮУ Ч ХАСАГДАХГҮЙ — зөвхөн дараалал өөрчлөгдөнө. Эрэмбэлэлт нь
 *   ТОГТВОРТОЙ: нэг замд нэг эрэмбэ, санамсаргүй хэсэг байхгүй.
 *
 * @param all Бүх боломжит үйлдэл (UI-ийн жагсаалт)
 * @param path Сонгосон зам; null бол өөрчлөхгүй
 */
export function orderActions(
  all: readonly PathAction[],
  path: PlayerPath | null | undefined
): PathAction[] {
  if (!path) return [...all];

  const priority = PLAYER_PATH_META[path].priority;
  const rank = new Map(priority.map((a, i) => [a, i]));

  return [...all].sort((a, b) => {
    const ra = rank.get(a) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b) ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    // Тэнцвэл анхны дараалал хэвээр — тогтвортой эрэмбэ
    return all.indexOf(a) - all.indexOf(b);
  });
}

/** Мэдэгдэхгүй утгыг аюулгүйгээр хөрвүүлнэ (ӨС-ийн хуучин мөр гэх мэт) */
export function parsePlayerPath(value: string | null | undefined): PlayerPath | null {
  return PLAYER_PATHS.includes(value as PlayerPath) ? (value as PlayerPath) : null;
}
