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
import { CODE_ALPHABET, normalizeRecoveryCode, RECOVERY_CODE_LENGTH } from '@nomad/core';

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
