/**
 * Босоо монгол бичгийн нуруу — график элемент (ROADMAP C3)
 *
 * ══ ЯАГААД ЭНЭ НЬ ХАМГИЙН ХҮЧТЭЙ ШИЙДЭЛ ВЭ ══
 *
 * Угалз, үүлэн хээ, өнгө — эдгээрийг бүгдийг нь хятад, төвд, буриад
 * зохиомжид ч олно. Гэтэл БОСОО МОНГОЛ БИЧИГ өөр ямар ч соёлд байхгүй.
 * Дэлгэцийн ирмэгээр урсах босоо бичиг нь ганцаараа аппыг эргэлзээгүй
 * монгол болгоно — өөр юу ч нэмэхгүйгээр.
 *
 * Орчин үеийн болгодог зүйл нь ХЭРЭГЛЭХ АРГА: бичгийг уншуулах биш,
 * ГРАФИК НУРУУ болгон ирмэгт тавина. Лавлах зурагт (морь уралдаан) яг
 * ийм — булангийн босоо бичиг нь чимэглэл, гэхдээ жинхэнэ бичвэр.
 *
 * Судалгааны үндэслэл — López-Enríquez нар: «тэгш байдал нь хоёрдогч
 * үр дүн биш, зохиомжийн зарчим». Эрсдэлтэй бичгийг тодорхой харагдах
 * газарт тавих нь тэр зарчмын шууд хэрэгжилт.
 *
 * ══ ГУРВАН ЗААВАЛ ЗҮЙЛ ══
 *
 * 1. ФОНТ БАЙХГҮЙ БОЛ ЮУ Ч ХАРУУЛАХГҮЙ. Android-д монгол Unicode блок
 *    үндсэн байдлаар байхгүй тул фонтгүйгээр хоосон дөрвөлжин гарна.
 *    Хоосон дөрвөлжин нь юу ч байхгүйгээс ДОР — эвдэрсэн мэт харагдана.
 * 2. ЗӨВХӨН ЖИНХЭНЭ ҮГ. Санамсаргүй тэмдэгт өрж «монгол шиг» харагдуулах
 *    нь өвийн аппд зохисгүй — утгагүй бичиг бол хуурамч өв.
 * 3. ХҮРТЭЭМЖ. Чимэглэлийн бичгийг дэлгэц уншигчаас НУУНА
 *    (`accessibilityElementsHidden`) — эс тэгвээс утгагүй уншина.
 */
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, fontFamily } from '@/theme';

/**
 * Дэлгэц бүрийн нуруунд бичих үг. Бүгд ЖИНХЭНЭ монгол үг —
 * тухайн дэлгэцийн утгатай холбоотой.
 *
 * ⚠ Эдгээр нь үсгийн БИЕ ДААСАН хэлбэр биш, бүтэн үгийн бичилт.
 *   Тиймээс `core/script.ts`-ийн `SCRIPT_DISCLAIMER` энд хамаарахгүй.
 */
export const SPINE_WORDS = {
  /** ᠮᠣᠩᠭᠣᠯ — «Монгол» */
  mongol: 'ᠮᠣᠩᠭᠣᠯ',
  /** ᠲᠡᠦᠬᠡ — «Түүх» */
  history: 'ᠲᠡᠦᠬᠡ',
  /** ᠪᠠᠭᠠᠲᠤᠷ — «Баатар» */
  hero: 'ᠪᠠᠭᠠᠲᠤᠷ',
  /** ᠭᠡᠷ — «Гэр» */
  ger: 'ᠭᠡᠷ',
  /** ᠲᠩᠷᠢ — «Тэнгэр» */
  tenger: 'ᠲᠩᠷᠢ',
} as const;

export type SpineWord = keyof typeof SPINE_WORDS;

export function ScriptSpine({
  word = 'mongol',
  /** Фонт ачаалагдсан эсэх — `useAppFonts().mongolScript` */
  available,
  side = 'left',
  size = 22,
  color = colors.textDim,
  opacity = 0.5,
  style,
}: {
  word?: SpineWord;
  available: boolean;
  side?: 'left' | 'right';
  size?: number;
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  // ⚠ Фонтгүй бол ЮУ Ч БУЦААХГҮЙ — хоосон дөрвөлжингөөс сэргийлнэ
  if (!available) return null;

  return (
    <View
      style={[styles.wrap, side === 'left' ? styles.left : styles.right, style]}
      pointerEvents="none"
      // Чимэглэл — дэлгэц уншигч алгасана
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Text
        style={[
          styles.text,
          { fontSize: size, color, opacity, lineHeight: size * 1.15 },
        ]}>
        {SPINE_WORDS[word]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  left: { left: 6 },
  right: { right: 6 },
  text: {
    fontFamily: fontFamily.mongol,
    /**
     * Монгол бичиг нь ДЭЭРЭЭС ДООШ бичигдэнэ. Unicode-ийн монгол блок нь
     * босоо бичилтийг зөвхөн `writing-mode` дэмждэг орчинд автоматаар
     * хийдэг — React Native-д тийм зүйл байхгүй.
     *
     * Тиймээс текстийг 90° эргүүлж босоо болгоно. Энэ нь бодит бичилтийн
     * чиглэлтэй (дээрээс доош, баганууд ЗҮҮНЭЭС БАРУУН) тохирно.
     */
    transform: [{ rotate: '90deg' }],
    letterSpacing: 1,
  },
});
