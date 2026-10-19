/**
 * Хүнд уншигдах кодууд — сорилтын линк, найзын бүлэг, сэргээх код
 *
 * Цагаан толгойноос I, O, 0, 1-ийг ЗОРИУДААР хассан: дэлгэцээс уншиж
 * бичихэд андуурагддаг. Хэрэглэгч «O» бичсэн бол ямар тэмдэгт санаачилсныг
 * таах боломжгүй тул солихгүй — хүчингүй гэж ТОДОРХОЙ хэлнэ.
 */

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 0..1 буцаадаг санамсаргүй функц — сервер `crypto`-оор өгнө */
export type RandomFn = () => number;

export function generateCode(length: number, random: RandomFn = Math.random): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(random() * CODE_ALPHABET.length) % CODE_ALPHABET.length;
    out += CODE_ALPHABET[idx];
  }
  return out;
}

/** Том үсэг болгож, зай/зураасыг хасна */
export function normalizeCode(raw: string, length: number): string {
  return raw.toUpperCase().replace(/[\s-]/g, '').slice(0, length);
}

export function isValidCode(code: string, length: number): boolean {
  return code.length === length && [...code].every((c) => CODE_ALPHABET.includes(c));
}

// ─── Сорилтын линк ───

/** 8 тэмдэгт = 40 бит — давхардах магадлал бараг тэг, линк богино хэвээр */
export const SHARE_CODE_LENGTH = 8;

export const generateShareCode = (random?: RandomFn) => generateCode(SHARE_CODE_LENGTH, random);
export const normalizeShareCode = (raw: string) => normalizeCode(raw, SHARE_CODE_LENGTH);
export const isValidShareCode = (code: string) => isValidCode(code, SHARE_CODE_LENGTH);

// ─── Найзын бүлэг ───

export const GROUP_CODE_LENGTH = 6;

export const generateGroupCode = (random?: RandomFn) => generateCode(GROUP_CODE_LENGTH, random);
export const normalizeGroupCode = (raw: string) => normalizeCode(raw, GROUP_CODE_LENGTH);
export const isValidGroupCode = (code: string) => isValidCode(code, GROUP_CODE_LENGTH);

// ─── Сэргээх код ───

/**
 * 25 тэмдэгт × 5 бит = 125 бит. Энэ бол НУУЦ ҮГ: эзэмшсэн хүн бүртгэлд
 * нэвтэрнэ. Сервер зөвхөн хэшийг хадгална.
 */
export const RECOVERY_CODE_LENGTH = 25;
const RECOVERY_GROUP = 5;

export function normalizeRecoveryCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, RECOVERY_CODE_LENGTH);
}

export const isValidRecoveryCode = (code: string) => isValidCode(code, RECOVERY_CODE_LENGTH);

/** XXXXX-XXXXX-XXXXX-XXXXX-XXXXX — гараар бичихэд хялбар */
export function formatRecoveryCode(code: string): string {
  const clean = normalizeRecoveryCode(code);
  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += RECOVERY_GROUP) {
    parts.push(clean.slice(i, i + RECOVERY_GROUP));
  }
  return parts.join('-');
}
