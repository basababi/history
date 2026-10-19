/**
 * Мэдрэмжийн давхарга — чичиргээ ба дуу (ROADMAP A2, C5)
 *
 * ЯАГААД: Duolingo-гийн амжилтын дийлэнх нь контент биш, «шүүслэг байдал» —
 * хариулт зөв гарахад юу болдог вэ. Өмнө нь энэ аппд ЮУ Ч болдоггүй байсан:
 * өнгө солигдоод дуусна.
 *
 * Бүх функц АЮУЛГҮЙ: haptic дэмжихгүй төхөөрөмж, вэб, тестийн орчинд
 * чимээгүй алгасна. Дуудагч тал `try/catch` бичих шаардлагагүй.
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { playSound } from '@/audio';

/** Хэрэглэгч чичиргээг унтраасан эсэх (Профайл дэлгэцээс) */
let hapticsEnabled = true;

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
}

/**
 * Дуу ба чичиргээг НЭГ ДОР унтраана.
 *
 * ⚠ Тэгш хүртээмж: дуу нь мэдээллийн цорын ганц суваг байж болохгүй.
 * Дуу унтарсан ч дэлгэцийн өөрчлөлт, чичиргээ хэвээр үлдэнэ.
 */
export { setSoundEnabled, isSoundEnabled } from '@/audio';

export function areHapticsEnabled(): boolean {
  return hapticsEnabled;
}

/** Haptic нь зөвхөн native дээр байдаг */
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

function safe(fn: () => Promise<void>): void {
  if (!hapticsEnabled || !supported) return;
  void fn().catch(() => undefined);
}

// ─── Тохиолдол бүрийн мэдрэмж ───

/** Товч дарах — хамгийн хөнгөн */
export function tapFeedback(): void {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Сонголт хийх — жагсаалт, таб, эрин солих */
export function selectFeedback(): void {
  safe(() => Haptics.selectionAsync());
}

/** Зөв хариулт — хөнгөн амжилт */
export function correctFeedback(): void {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  playSound('correct');
}

/** Буруу хариулт — хүнд, анзаарагдам */
export function wrongFeedback(): void {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  playSound('wrong');
}

/** Хугацаа дуусах, анхааруулга */
export function warnFeedback(): void {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

/**
 * Цол ахих, баатар нээгдэх — хамгийн хүчтэй.
 * Гурван цохилт: та-та-ТАМ
 */
export function celebrateFeedback(): void {
  if (!hapticsEnabled || !supported) return;
  void (async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await new Promise((r) => setTimeout(r, 90));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await new Promise((r) => setTimeout(r, 90));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // алгасна
    }
  })();
  playSound('unlock');
}

/** Дараалсан зөв хариулт — combo. Урт нь дараалалаас хамаарна */
export function comboFeedback(streak: number): void {
  if (streak < 3) {
    correctFeedback();
    return;
  }
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  playSound('combo');
}
