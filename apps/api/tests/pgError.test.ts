/**
 * PG алдааны шинжилгээ — драйвер шинэчлэгдэхэд чимээгүй эвдрэхээс хамгаална.
 *
 * Энэ тест бодит алдааны улмаас нэмэгдсэн: Drizzle 0.45 алдааг
 * `DrizzleQueryError` дотор боож эхэлснээр мессежээр шалгадаг байсан
 * давхар хариултын хамгаалалт 409-ийн оронд 500 буцаадаг болсон.
 */
import { describe, expect, it } from 'vitest';
import {
  isForeignKeyViolation,
  isNotNullViolation,
  isUniqueViolation,
  pgErrorInfo,
  PG_UNIQUE_VIOLATION,
} from '../lib/pgError';

/** Drizzle 0.45-ийн боолт: гадна мессежид код БАЙХГҮЙ */
function wrapped(pg: Record<string, unknown>): Error {
  const outer = new Error('Failed query: insert into "attempts" ...');
  (outer as Error & { cause?: unknown }).cause = Object.assign(
    new Error('duplicate key value violates unique constraint'),
    pg
  );
  return outer;
}

describe('pgErrorInfo — .cause гинжийг гүйлгэнэ', () => {
  it('боосон алдаанаас SQLSTATE гаргана', () => {
    const err = wrapped({
      code: PG_UNIQUE_VIOLATION,
      constraint_name: 'attempts_session_question_uq',
    });
    const info = pgErrorInfo(err);
    expect(info.code).toBe('23505');
    expect(info.constraint).toBe('attempts_session_question_uq');
  });

  it('боолтгүй алдааг ч уншина', () => {
    const err = Object.assign(new Error('x'), { code: '23505' });
    expect(pgErrorInfo(err).code).toBe('23505');
  });

  it('гүн боолтыг гүйлгэнэ', () => {
    const deep = new Error('a');
    (deep as Error & { cause?: unknown }).cause = wrapped({ code: '23503' });
    expect(pgErrorInfo(deep).code).toBe('23503');
  });

  it('PG биш алдаанд хоосон буцаана', () => {
    expect(pgErrorInfo(new Error('ердийн алдаа')).code).toBeUndefined();
    expect(pgErrorInfo(null).code).toBeUndefined();
    expect(pgErrorInfo('string').code).toBeUndefined();
  });

  it('мөчлөгт cause-д гацахгүй', () => {
    const a = new Error('a') as Error & { cause?: unknown };
    const b = new Error('b') as Error & { cause?: unknown };
    a.cause = b;
    b.cause = a;
    expect(() => pgErrorInfo(a)).not.toThrow();
  });
});

describe('isUniqueViolation', () => {
  it('🔴 Drizzle-ийн боосон UNIQUE зөрчлийг таньна', () => {
    const err = wrapped({
      code: '23505',
      constraint_name: 'attempts_session_question_uq',
    });
    expect(isUniqueViolation(err, 'attempts_session_question_uq')).toBe(true);
  });

  it('constraint нэр өгөөгүй драйверт ч кодоор таньна', () => {
    expect(isUniqueViolation(wrapped({ code: '23505' }), 'any_name')).toBe(true);
  });

  it('өөр хязгаарлалтыг ялгана', () => {
    const err = wrapped({ code: '23505', constraint_name: 'user_heroes_uq' });
    expect(isUniqueViolation(err, 'attempts_session_question_uq')).toBe(false);
  });

  it('өөр төрлийн зөрчлийг UNIQUE гэж үзэхгүй', () => {
    expect(isUniqueViolation(wrapped({ code: '23503' }))).toBe(false);
    expect(isUniqueViolation(new Error('random'))).toBe(false);
  });
});

describe('бусад зөрчлүүд', () => {
  it('FK ба NOT NULL', () => {
    expect(isForeignKeyViolation(wrapped({ code: '23503' }))).toBe(true);
    expect(isNotNullViolation(wrapped({ code: '23502' }))).toBe(true);
    expect(isNotNullViolation(wrapped({ code: '23505' }))).toBe(false);
  });
});
