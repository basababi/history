/**
 * Зочны бүртгэл — бүртгүүлэхгүйгээр шууд тоглох
 *
 * Вэбийн хамгийн том давуу тал нь «линк дээр дарахад шууд тоглоно».
 * Тиймээс эхний айлчлалд бүртгэл, нууц үг, и-мэйл ОГТ асуухгүй: сервер
 * чимээгүйгээр зочны бүртгэл үүсгэж, СЭРГЭЭХ КОД буцаана.
 *
 * Сэргээх код = нууц үг. 125 бит санамсаргүй — таах боломжгүй. Сервер
 * зөвхөн sha256 хэшийг хадгална: ӨС алдагдсан ч кодыг сэргээж чадахгүй.
 * Утас солих, хөтчийн өгөгдөл цэвэрлэгдэхэд энэ кодоор цувралаа сэргээнэ.
 */
import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { CODE_ALPHABET, isValidRecoveryCode, normalizeRecoveryCode, RECOVERY_CODE_LENGTH } from '@nomad/core';
import { profiles, users } from '@nomad/db';
import { db } from './db';
import { isUniqueViolation } from './pgError';

export const GUEST_PROVIDER = 'guest';

/** Крипто-аюулгүй 0..1 — `@nomad/core`-ийн код үүсгэгчид өгнө */
export function cryptoRandom(): number {
  return crypto.randomInt(0, 2 ** 32) / 2 ** 32;
}

/** Шинэ сэргээх код (хэвийн хэлбэрээр — зураасгүй) */
export function newRecoveryCode(): string {
  let out = '';
  for (let i = 0; i < RECOVERY_CODE_LENGTH; i++) {
    out += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Хадгалах хэш. Код өөрөө 125 биттэй тул давс шаардлагагүй — rainbow
 * хүснэгт үүсгэх боломжгүй. Угтвар нь өөр системийн хэштэй холилдохоос
 * сэргийлнэ.
 */
export function hashRecoveryCode(code: string): string {
  return crypto
    .createHash('sha256')
    .update(`nomad-guest:v1:${normalizeRecoveryCode(code)}`)
    .digest('hex');
}

/**
 * Шинэ зочин — бүртгэл + хоосон профайл. Сэргээх кодыг НЭГ удаа буцаана.
 * 125 битийн код давхардах магадлал тэг; гэхдээ UNIQUE-д найдаж дахин оролдоно.
 */
export async function createGuestUser(): Promise<{ userId: number; recoveryCode: string } | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const recoveryCode = newRecoveryCode();
    try {
      const [user] = await db
        .insert(users)
        .values({ provider: GUEST_PROVIDER, providerId: hashRecoveryCode(recoveryCode) })
        .returning({ id: users.id });
      if (!user) return null;
      await db.insert(profiles).values({ userId: user.id, displayName: null });
      return { userId: user.id, recoveryCode };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  return null;
}

/** Сэргээх кодоор зочныг олно — формат буруу эсвэл олдохгүй бол null */
export async function findGuestByCode(code: string): Promise<number | null> {
  const normalized = normalizeRecoveryCode(code);
  if (!isValidRecoveryCode(normalized)) return null;
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.provider, GUEST_PROVIDER), eq(users.providerId, hashRecoveryCode(normalized))))
    .limit(1);
  return user?.id ?? null;
}

/** Хэрэглэгч ӨС-д байгаа эсэх — токен хүчинтэй ч ӨС шинэчлэгдсэн байж болно */
export async function userExists(userId: number): Promise<boolean> {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  return Boolean(user);
}
