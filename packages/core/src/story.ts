/**
 * Интерактив өгүүлэмж (ROADMAP C2)
 *
 * СУДАЛГААНЫ ҮНДЭСЛЭЛ: Khan-ы тоймд өгүүлэмж хамгийн олон давтагдсан
 * элемент. López-Enríquez нарын ангиллаар энэ нь аппыг «Structural»-аас
 * «Narrative» түвшинд гаргана — дипломын шинэлэг талын гол хэсэг.
 *
 * ЗОХИОМЖИЙН ЗАРЧИМ:
 *   • АЛЬ Ч СОНГОЛТ БУРУУ БИШ. Түүхэн баримт нь ҮР ДАГАВРААР заагдана,
 *     цээжлүүлэхээр биш. «Буруу» төгсгөл байвал энэ нь дахин нэг сорил
 *     болж хувирна — өгүүлэмжийн утга алдагдана.
 *   • БОГИНО — 2–3 минут, TikTok-ийн анхаарлын мөчлөгт багтана.
 *   • Мөчлөг байхгүй — граф нь заавал төгсгөлд хүрдэг байх ёстой.
 *
 * ⚠ ОНООГ ЗӨВХӨН СЕРВЕР ОЛГОНО (Бүлэг 6.1). Клиент явсан замаа илгээх ба
 *   сервер тэр зам граф дээр БОДИТООР байдаг эсэхийг шалгана.
 */

export interface StoryChoice {
  /** Хүүхдэд харагдах сонголт */
  label: string;
  /** Дараагийн зангилааны түлхүүр */
  nextKey: string;
  /**
   * Энэ сонголтын ард байгаа түүхэн баримт — сонгосны ДАРАА харагдана.
   * Заавал эх сурвалжтай (Бүлэг 6.2).
   */
  factNote?: string;
}

export interface StoryNode {
  /** Графын доторх давтагдашгүй түлхүүр */
  key: string;
  body: string;
  /** Төгсгөлийн зангилаа бол сонголт хоосон */
  choices: StoryChoice[];
  /** Төгсгөлийн нэр — «Элч буцав», «Хуралдай үргэлжлэв» гэх мэт */
  endingLabel?: string;
}

export const STORY_START_KEY = 'start';

/** Хамгийн урт зам — хязгааргүй мөчлөгөөс хамгаална */
export const STORY_MAX_DEPTH = 20;

export type StoryValidationError =
  | 'NO_START'
  | 'DUPLICATE_KEY'
  | 'DANGLING_CHOICE'
  | 'NO_ENDING'
  | 'UNREACHABLE_NODE'
  | 'CYCLE';

export interface StoryValidation {
  ok: boolean;
  errors: Array<{ code: StoryValidationError; detail: string }>;
}

/**
 * Графын бүрэн бүтэн байдлыг шалгана. ЦЭВЭР функц.
 *
 * Энэ нь seed-ийн үед ажиллана: эвдэрсэн өгүүлэмж ӨС-д орохоос сэргийлнэ.
 * Хүүхэд «Дараах» дарахад хоосон дэлгэц гарвал итгэл алдагдана.
 */
export function validateStory(nodes: readonly StoryNode[]): StoryValidation {
  const errors: StoryValidation['errors'] = [];

  const byKey = new Map<string, StoryNode>();
  for (const n of nodes) {
    if (byKey.has(n.key)) {
      errors.push({ code: 'DUPLICATE_KEY', detail: n.key });
    }
    byKey.set(n.key, n);
  }

  if (!byKey.has(STORY_START_KEY)) {
    errors.push({ code: 'NO_START', detail: STORY_START_KEY });
    return { ok: false, errors };
  }

  // ─── Заагдсан зангилаа бүр байх ёстой ───
  for (const n of nodes) {
    for (const c of n.choices) {
      if (!byKey.has(c.nextKey)) {
        errors.push({ code: 'DANGLING_CHOICE', detail: `${n.key} → ${c.nextKey}` });
      }
    }
  }

  // ─── Хүрч болох зангилаа ба мөчлөг ───
  const reachable = new Set<string>();
  const stack: Array<{ key: string; path: string[] }> = [
    { key: STORY_START_KEY, path: [] },
  ];

  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur.path.includes(cur.key)) {
      errors.push({ code: 'CYCLE', detail: [...cur.path, cur.key].join(' → ') });
      continue;
    }
    reachable.add(cur.key);

    const node = byKey.get(cur.key);
    if (!node) continue;
    for (const c of node.choices) {
      if (byKey.has(c.nextKey)) {
        stack.push({ key: c.nextKey, path: [...cur.path, cur.key] });
      }
    }
  }

  for (const n of nodes) {
    if (!reachable.has(n.key)) {
      errors.push({ code: 'UNREACHABLE_NODE', detail: n.key });
    }
  }

  const endings = nodes.filter((n) => n.choices.length === 0);
  if (endings.length === 0) {
    errors.push({ code: 'NO_ENDING', detail: 'нэг ч төгсгөл байхгүй' });
  }

  return { ok: errors.length === 0, errors };
}

export interface StoryPathResult {
  valid: boolean;
  /** Хүрсэн төгсгөлийн зангилаа */
  endingKey: string | null;
  reason?: 'BAD_START' | 'INVALID_STEP' | 'NOT_AN_ENDING' | 'TOO_LONG';
}

/**
 * Клиентээс ирсэн замыг СЕРВЕР дээр дахин алхаж шалгана (Бүлэг 6.1).
 *
 * `path` нь `start`-аас хойш СОНГОСОН зангилаануудын түлхүүрүүд.
 * Зам нь заавал төгсгөлийн зангилаагаар дуусах ёстой — тэгэхгүй бол
 * дуусгаагүй өгүүлэмжийн төлөө XP авах боломж үүснэ.
 */
export function walkStoryPath(
  nodes: readonly StoryNode[],
  path: readonly string[]
): StoryPathResult {
  const byKey = new Map(nodes.map((n) => [n.key, n]));

  let current = byKey.get(STORY_START_KEY);
  if (!current) return { valid: false, endingKey: null, reason: 'BAD_START' };

  if (path.length > STORY_MAX_DEPTH) {
    return { valid: false, endingKey: null, reason: 'TOO_LONG' };
  }

  for (const step of path) {
    const allowed = current.choices.some((c) => c.nextKey === step);
    if (!allowed) return { valid: false, endingKey: null, reason: 'INVALID_STEP' };

    const next = byKey.get(step);
    if (!next) return { valid: false, endingKey: null, reason: 'INVALID_STEP' };
    current = next;
  }

  if (current.choices.length > 0) {
    return { valid: false, endingKey: null, reason: 'NOT_AN_ENDING' };
  }

  return { valid: true, endingKey: current.key };
}

/** Өгүүлэмж дуусгасны XP — нэг өгүүлэмжид нэг л удаа */
export const STORY_XP = 40;
