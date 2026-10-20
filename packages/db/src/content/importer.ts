/**
 * Асуултын хүснэгтийг ӨС-д оруулах — идемпотент, НЭГ транзакцид
 *
 *   `content_key` таарвал → шинэчилнэ (өөрчлөлтгүй бол хөндөхгүй)
 *   түлхүүргүй хуучин мөр ижил текстэй бол → «өөртөө авна» (seed-ээр орсон)
 *   эс бөгөөс → шинээр нэмнэ
 *
 * 🔴 Өдрийн тавд аль хэдийн гарсан асуултын СОНГОЛТ, ЗӨВ ХАРИУЛТЫГ өөрчлөхгүй:
 *   тоглогчдын дүн тэр үеийн хариултаар бодогдсон, найзын тулаан түүнд
 *   тулгуурласан. Засах бол асуултыг `draft` болгоод шинэ түлхүүрээр нэмнэ,
 *   эсвэл `allowAnswerChange` (түүхч алдааг баталсан тохиолдолд л).
 *
 * CSV-д байхгүй ӨС-ийн асуултыг УСТГАХГҮЙ — нийтлэлээс хасах бол CSV-д
 * `draft` болгоно. Ингэснээр хүснэгтийн нэг мөр санамсаргүй устахад
 * тоглогчийн түүх эвдрэхгүй.
 */
import { eq } from 'drizzle-orm';
import { dailySets, questions } from '../schema';
import { ensureEras, type AnyDb } from '../seed/run';
import { normalizeBody, UNREVIEWED_MARKER, type ContentQuestion } from './questions';

export interface ImportOptions {
  /** Бичихгүй, зөвхөн төлөвлөгөө */
  dryRun?: boolean;
  /** Гарсан асуултын хариултыг өөрчлөхийг зөвшөөрөх (түүхч баталсан алдаа) */
  allowAnswerChange?: boolean;
}

export interface ImportReport {
  /**
   * Бичигдсэн эсэх. Хаагдсан асуулт байвал БҮХ импорт буцаагдана — CSV бол
   * үнэний эх сурвалж; хагас орсон төлөв түүхчийг төөрөгдүүлнэ.
   */
  applied: boolean;
  inserted: string[];
  updated: string[];
  /** Түлхүүргүй хуучин мөрийг (seed) түлхүүртэй болгосон */
  adopted: string[];
  unchanged: number;
  blocked: { key: string; reason: string }[];
  /** ӨС-д түлхүүртэй боловч CSV-д байхгүй (хөндөөгүй) */
  missingFromCsv: string[];
}

type Row = typeof questions.$inferSelect;

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function importQuestions(
  db: AnyDb,
  items: readonly ContentQuestion[],
  opts: ImportOptions = {}
): Promise<ImportReport> {
  const report: ImportReport = {
    applied: false,
    inserted: [],
    updated: [],
    adopted: [],
    unchanged: 0,
    blocked: [],
    missingFromCsv: [],
  };

  const apply = async (tx: AnyDb) => {
    const eraIds = await ensureEras(tx);
    const existing: Row[] = await tx.select().from(questions);
    const byKey = new Map(existing.filter((r) => r.contentKey).map((r) => [r.contentKey as string, r]));
    const unkeyedByBody = new Map(existing.filter((r) => !r.contentKey).map((r) => [normalizeBody(r.body), r]));

    const served = new Set<number>();
    for (const set of await tx.select({ ids: dailySets.questionIds }).from(dailySets)) {
      for (const id of set.ids) served.add(id);
    }

    const csvKeys = new Set(items.map((q) => q.key));
    report.missingFromCsv = existing
      .filter((r) => r.contentKey && !csvKeys.has(r.contentKey))
      .map((r) => r.contentKey as string)
      .sort();

    for (const q of items) {
      const eraId = eraIds.get(q.eraKey);
      if (!eraId) {
        report.blocked.push({ key: q.key, reason: `эрин «${q.eraKey}» ӨС-д үүсгэж чадсангүй` });
        continue;
      }
      const values = {
        eraId,
        format: q.format,
        difficulty: q.difficulty,
        body: q.body,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        sourceRef: q.sourceRef,
        status: q.status,
        reviewedBy: q.reviewedBy,
        contentKey: q.key,
      };

      const current = byKey.get(q.key) ?? unkeyedByBody.get(normalizeBody(q.body));
      if (!current) {
        if (!opts.dryRun) await tx.insert(questions).values(values);
        report.inserted.push(q.key);
        continue;
      }

      const answerChanged = !sameJson(current.options, q.options) || current.correctIndex !== q.correctIndex;
      if (answerChanged && served.has(current.id) && !opts.allowAnswerChange) {
        report.blocked.push({
          key: q.key,
          reason: 'өдрийн тавд гарсан асуултын сонголт/зөв хариулт өөрчлөгдсөн — шинэ түлхүүрээр нэмнэ үү',
        });
        continue;
      }

      const changed =
        answerChanged ||
        current.eraId !== eraId ||
        current.format !== q.format ||
        current.difficulty !== q.difficulty ||
        current.body !== q.body ||
        current.explanation !== q.explanation ||
        current.sourceRef !== q.sourceRef ||
        current.status !== q.status ||
        current.reviewedBy !== q.reviewedBy ||
        current.contentKey !== q.key;

      if (!changed) {
        report.unchanged += 1;
        continue;
      }
      if (!opts.dryRun) await tx.update(questions).set(values).where(eq(questions.id, current.id));
      if (!current.contentKey) report.adopted.push(q.key);
      else report.updated.push(q.key);
    }
    if (report.blocked.length > 0 && !opts.dryRun) throw new BlockedImport();
  };

  if (opts.dryRun) {
    await apply(db);
    return report;
  }
  try {
    await db.transaction(async (tx) => apply(tx as unknown as AnyDb));
    report.applied = true;
  } catch (err) {
    if (!(err instanceof BlockedImport)) throw err;
  }
  return report;
}

/** Транзакцыг буцаах дохио — алдаа биш, тайланд `blocked`-оор харагдана */
class BlockedImport extends Error {}

/** Нийтлэгдсэн асуултын нөөц — CLI ба health-д */
export interface ContentRunway {
  published: Record<'easy' | 'medium' | 'hard', number>;
  /** Нийтлэгдсэн боловч өдрийн тавд хэзээ ч гараагүй */
  unused: Record<'easy' | 'medium' | 'hard', number>;
  byFormat: Record<string, number>;
  byEra: Record<number, number>;
  unreviewedPublished: number;
  keyed: number;
}

export async function contentRunway(db: AnyDb): Promise<ContentRunway> {
  const rows = await db
    .select({
      id: questions.id,
      difficulty: questions.difficulty,
      format: questions.format,
      eraId: questions.eraId,
      status: questions.status,
      reviewedBy: questions.reviewedBy,
      contentKey: questions.contentKey,
    })
    .from(questions)
    .where(eq(questions.status, 'published'));

  const served = new Set<number>();
  for (const set of await db.select({ ids: dailySets.questionIds }).from(dailySets)) {
    for (const id of set.ids) served.add(id);
  }

  const out: ContentRunway = {
    published: { easy: 0, medium: 0, hard: 0 },
    unused: { easy: 0, medium: 0, hard: 0 },
    byFormat: {},
    byEra: {},
    unreviewedPublished: 0,
    keyed: 0,
  };
  for (const r of rows) {
    const d = r.difficulty as 'easy' | 'medium' | 'hard';
    if (!(d in out.published)) continue;
    out.published[d] += 1;
    if (!served.has(r.id)) out.unused[d] += 1;
    out.byFormat[r.format] = (out.byFormat[r.format] ?? 0) + 1;
    out.byEra[r.eraId] = (out.byEra[r.eraId] ?? 0) + 1;
    if (!r.reviewedBy || r.reviewedBy.toUpperCase().includes(UNREVIEWED_MARKER)) out.unreviewedPublished += 1;
    if (r.contentKey) out.keyed += 1;
  }
  return out;
}
