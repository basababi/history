/**
 * Хуваалцах текст ба харьцуулалтын мессеж
 *
 * Wordle-ийн өсөлтийн нууц нь СПОЙЛЕРГҮЙ дүн: асуултыг илчлэхгүйгээр
 * хэр сайн тоглосныг харуулна. Энд мөн адил — тэмдэгтүүд нь аль асуултад
 * зөв, аль нь буруу байсныг л хэлнэ.
 *
 * ⚠ Emoji ашиглахгүй: төхөөрөмж бүрд өөр артворктой, брэндгүй. Энгийн
 *   геометр тэмдэгт (■ □) нь бүх платформд ижил харагдана.
 */
import { compareScores, formatDuration, type DayScore } from './daily';
import { ablative } from './mongolian';

export const MARK_CORRECT = '■';
export const MARK_WRONG = '□';

export function shareMarks(marks: readonly boolean[]): string {
  return marks.map((m) => (m ? MARK_CORRECT : MARK_WRONG)).join('');
}

export interface ShareTextInput {
  dayNumber: number;
  correct: number;
  total: number;
  totalMs: number;
  marks: readonly boolean[];
  url: string;
}

/**
 * Messenger, Instagram, SMS-д наалдах текст.
 *
 *   Эртний Өв · Өдрийн тав #14
 *   ■■□■■ 4/5 · 38 сек
 *   Чи надаас илүү мэдэх үү? https://…
 */
export function buildShareText(input: ShareTextInput): string {
  return [
    `Эртний Өв · Өдрийн тав #${input.dayNumber}`,
    `${shareMarks(input.marks)} ${input.correct}/${input.total} · ${formatDuration(input.totalMs)}`,
    `Чи надаас илүү мэдэх үү? ${input.url}`,
  ].join('\n');
}

export interface DuelMessage {
  /** Гарчиг — «Чи түрүүллээ!» */
  headline: string;
  /** Дэлгэрэнгүй — «Чи Батаас 1 оноогоор түрүүллээ» */
  detail: string;
  outcome: 'win' | 'loss' | 'tie';
}

/**
 * Хоёр дүнгийн харьцуулалтыг хүнд ойлгомжтой өгүүлбэр болгоно.
 *
 * Нэрийг гарах тийн ялгалд оруулж чадахгүй бол (латин нэр г.м.)
 * залгавар шаардахгүй өгүүлбэр сонгоно — буруу дүрмээс тайлбар нь дээр.
 */
export function duelMessage(mine: DayScore, theirs: DayScore, theirName: string): DuelMessage {
  const c = compareScores(mine, theirs);
  const from = ablative(theirName);
  const points = Math.abs(c.correctDiff);
  const seconds = Math.max(1, Math.round(Math.abs(c.msDiff) / 1000));

  if (c.outcome === 'tie') {
    return {
      outcome: 'tie',
      headline: 'Тэнцлээ!',
      detail: `Хоёулаа ${mine.correct} зөв, бараг ижил хугацаанд.`,
    };
  }

  if (c.outcome === 'win') {
    const detail =
      c.decidedBy === 'correct'
        ? from
          ? `Чи ${from} ${points} оноогоор түрүүллээ.`
          : `Чи ${points} оноогоор түрүүллээ — ${theirName}: ${theirs.correct}, чи: ${mine.correct}.`
        : from
          ? `Оноо тэнцүү, гэхдээ чи ${from} ${seconds} секундээр хурдан байлаа.`
          : `Оноо тэнцүү, гэхдээ чи ${seconds} секундээр хурдан байлаа.`;
    return { outcome: 'win', headline: 'Чи түрүүллээ!', detail };
  }

  const detail =
    c.decidedBy === 'correct'
      ? `${theirName} чамаас ${points} оноогоор түрүүллээ.`
      : `Оноо тэнцүү, гэхдээ ${theirName} чамаас ${seconds} секундээр хурдан байлаа.`;
  return { outcome: 'loss', headline: 'Энэ удаа ялагдлаа', detail };
}
