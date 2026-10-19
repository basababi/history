/**
 * Асуултын суурь төрлүүд — API, ӨС, клиент гурвуулаа ижил утга ашиглана.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'] as const;

/**
 * Агуулгын хэлбэр — «сав нь тогтмол, доторх агуулга нь олон янз».
 *
 * Өдрийн тав үргэлж 5 асуулт, ~2 минут байна. Харин асуулт бүр өөр
 * хэлбэртэй байж болно — ингэснээр зүйр үг, домог, түүх нэг аяллын
 * дотор ээлжилж, «олон тийш үсэрсэн» мэдрэмж төрөхгүй.
 */
export type QuestionFormat = 'classic' | 'myth_or_fact' | 'proverb' | 'what_if';

export const QUESTION_FORMATS: readonly QuestionFormat[] = [
  'classic',
  'myth_or_fact',
  'proverb',
  'what_if',
] as const;

/** UI-д харагдах шошго — асуултын дээд талд жижиг тэмдэг болж гарна */
export const QUESTION_FORMAT_LABEL: Record<QuestionFormat, string> = {
  classic: 'Түүх',
  myth_or_fact: 'Үнэн үү, домог уу?',
  proverb: 'Зүйр үг',
  what_if: 'Чи тэр үед байсан бол?',
};

export function isQuestionFormat(value: unknown): value is QuestionFormat {
  return typeof value === 'string' && (QUESTION_FORMATS as readonly string[]).includes(value);
}

/**
 * Сонголтыг холих эсэх.
 *
 * «Үнэн / Домог» мэт хоёр сонголттой хэлбэрт дараалал нь утгатай —
 * «Үнэн» өдөр бүр өөр байрлалд гарвал хэрэглэгч андуурна. Тиймээс
 * зөвхөн олон сонголттой хэлбэрийг холино.
 */
export function shouldShuffleOptions(format: QuestionFormat): boolean {
  return format !== 'myth_or_fact';
}
