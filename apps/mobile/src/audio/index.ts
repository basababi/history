/**
 * Дууны давхарга — морин хуур, хөөмий (ROADMAP C5)
 *
 * ЯАГААД: «Хэдхэн секундын клип, гэхдээ ямар ч өрсөлдөгчид байхгүй —
 * шууд танигдана.» Монгол хөгжмийн богино тэмдэглэгээ нь энэ аппыг
 * дэлхийн ямар ч сурах аппаас ялгах хамгийн хямд арга.
 *
 * ⚠ ОДООГИЙН ТӨЛӨВ — КЛИП ДУТУУ:
 *   `CLIPS` бүртгэл ХООСОН. Морин хуур, хөөмийн бодит бичлэг байхгүй тул
 *   энэ модуль одоогоор ЧИМЭЭГҮЙ ажиллана. Энэ бол зориудын шийдвэр:
 *
 *   • Хуурамч дуу (энгийн «бип») тавих нь зорилгыг эсрэгээр эргүүлнэ —
 *     ялгарах гэсэн санаа алдагдана.
 *   • Дуудлагын цэгүүд бүгд байрандаа тул бичлэг ирэхэд ЗӨВХӨН доорх
 *     `CLIPS` бүртгэлийг бөглөнө. Өөр код өөрчлөгдөхгүй.
 *
 *   Хийх ажил: `assets/audio/` дор .m4a клип нэмээд `CLIPS`-д бүртгэнэ.
 *   Эрхийн лиценз шалгагдсан байх ёстой (Бүлэг 6.2 — эх сурвалжийн дүрэм).
 *
 * ⚠ ДУУГҮЙ ГОРИМД ЗААВАЛ УНТАРНА (`setSoundEnabled(false)`), мөн
 *   тэгш хүртээмжийн шаардлага: дуу нь МЭДЭЭЛЛИЙН ЦОРЫН ГАНЦ суваг байж
 *   болохгүй — бүх тохиолдолд haptic ба дэлгэцийн өөрчлөлт хамт явна.
 */
import { Platform } from 'react-native';

/** Дуу гарах тохиолдлууд — `feedback/`-ийн мэдрэмжтэй нэг бүрд харгалзана */
export type SoundEvent =
  /** Зөв хариулт */
  | 'correct'
  /** Буруу хариулт — зэмлэсэн биш, зөөлөн */
  | 'wrong'
  /** Дараалан 3+ зөв — морин хуурын татлага */
  | 'combo'
  /** Баатар нээгдэх — хөөмийн богино эгшиглэл */
  | 'unlock'
  /** Сорил дуусах */
  | 'complete';

/**
 * Клипийн бүртгэл. Утга нь `require('../../assets/audio/x.m4a')`.
 *
 * ХООСОН = чимээгүй. Түлхүүр байхгүй тохиолдол чимээгүй алгасагдана.
 */
const CLIPS: Partial<Record<SoundEvent, number>> = {
  // correct: require('../../assets/audio/correct.m4a'),
  // combo:   require('../../assets/audio/morin-khuur.m4a'),
  // unlock:  require('../../assets/audio/khoomii.m4a'),
};

let soundEnabled = true;

/** Профайл дэлгэцийн «Дуу» унтраалга */
export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

/** Клип бүртгэгдсэн эсэх — UI-д «удахгүй» гэж үзүүлэхэд хэрэгтэй */
export function hasClip(event: SoundEvent): boolean {
  return CLIPS[event] !== undefined;
}

const native = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Богино дууг тоглуулна.
 *
 * ХЭЗЭЭ Ч алдаа шидэхгүй: клип байхгүй, дуу унтраалттай, вэб/тестийн
 * орчин, эсвэл аудио төхөөрөмж завгүй — бүгд чимээгүй алгасагдана.
 * Дуудагч тал try/catch бичих шаардлагагүй (`feedback/`-тэй ижил гэрээ).
 */
export function playSound(event: SoundEvent): void {
  if (!soundEnabled || !native) return;

  const source = CLIPS[event];
  if (source === undefined) return;

  void (async () => {
    try {
      // Динамик import — клип байхгүй үед expo-audio огт ачаалагдахгүй
      const { createAudioPlayer } = await import('expo-audio');
      const player = createAudioPlayer(source);
      player.play();

      // Богино клип тул тоглосны дараа сулална — санах ой алдагдахаас сэргийлнэ
      setTimeout(() => {
        try {
          player.remove();
        } catch {
          // аль хэдийн суларсан — асуудалгүй
        }
      }, 4000);
    } catch {
      // Аудио боломжгүй — чимээгүй үргэлжилнэ
    }
  })();
}
