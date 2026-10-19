/**
 * PostgreSQL алдааны шинжилгээ.
 *
 * ⚠ Drizzle 0.45-аас эхлэн алдааг `DrizzleQueryError` дотор боож, гадна
 * талын мессежид зөвхөн «Failed query: …» гэж бичдэг болсон. Жинхэнэ PG
 * алдаа нь `.cause` гинжин хэлхээнд байна. Тиймээс мессежээр биш,
 * SQLSTATE кодоор шалгах ёстой — мессежээр шалгавал драйвер шинэчлэгдэхэд
 * чимээгүй эвдэрнэ.
 */

/** PostgreSQL SQLSTATE — https://www.postgresql.org/docs/current/errcodes-appendix.html */
export const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_NOT_NULL_VIOLATION = '23502';

export interface PgErrorInfo {
  code?: string;
  constraint?: string;
  column?: string;
  detail?: string;
}

interface PgLikeError {
  code?: unknown;
  constraint_name?: unknown;
  constraint?: unknown;
  column_name?: unknown;
  column?: unknown;
  detail?: unknown;
  cause?: unknown;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Алдааны `.cause` гинжийг гүйлгэж PG-ийн мэдээллийг гаргана.
 * Драйвер (postgres-js, pglite) бүрийн талбарын нэр өөр тул хоёуланг нь үзнэ.
 */
export function pgErrorInfo(err: unknown): PgErrorInfo {
  let current: unknown = err;

  for (let depth = 0; depth < 8 && current; depth++) {
    if (typeof current === 'object') {
      const e = current as PgLikeError;
      const code = str(e.code);
      if (code) {
        return {
          code,
          constraint: str(e.constraint_name) ?? str(e.constraint),
          column: str(e.column_name) ?? str(e.column),
          detail: str(e.detail),
        };
      }
      current = e.cause;
      continue;
    }
    break;
  }

  return {};
}

/** UNIQUE зөрчил мөн эсэх; `constraint` өгвөл тухайн хязгаарлалтыг шалгана */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const info = pgErrorInfo(err);
  if (info.code !== PG_UNIQUE_VIOLATION) return false;
  if (!constraint) return true;
  // Зарим драйвер constraint нэрийг өгдөггүй — код таарвал хангалттай
  return info.constraint === undefined || info.constraint === constraint;
}

export function isForeignKeyViolation(err: unknown): boolean {
  return pgErrorInfo(err).code === PG_FOREIGN_KEY_VIOLATION;
}

export function isNotNullViolation(err: unknown): boolean {
  return pgErrorInfo(err).code === PG_NOT_NULL_VIOLATION;
}
