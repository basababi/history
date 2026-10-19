/**
 * Үүлэн хээ — бодит зурмал артворк
 *
 * ══ ЯАГААД SVG-ЭЭС ЗУРАГ РУУ ШИЛЖСЭН ══
 *
 * `CloudMotif.tsx` нь үүлийг процедураар (тойрог + мушгиа) үүсгэдэг.
 * Зургаан удаагийн давталтын дараа ч гар зурааны чанарт хүрсэнгүй:
 * дэлбээ нь төгс дугуй, мушгиа нь жигд, бүхэлдээ «үүсгэсэн» мэдрэмжтэй
 * хэвээр байв. Уламжлалт үүлэн хээ нь тэгш хэмгүй, дэлбээ бүр өөр
 * хэлбэртэй, шугамын зузаан нь хэлбэлздэг — эдгээрийг томьёогоор
 * гаргах боломжгүй.
 *
 * Тиймээс бодит зурмал артворк ашиглана.
 *
 * ══ ЗУРГИЙН БЭЛТГЭЛ ══
 *
 * Эх файл нь JPEG байсан бөгөөд тунгалаг байдал нь ШАТРЫН ДЭВСГЭР болж
 * шигдсэн байв. Дэвсгэрийг ханалтаар (saturation) ялгаж арилгасан:
 * шатрын нүд нь ханалт ~0, үүл нь ханасан. Ирмэгийн JPEG артефактыг
 * зөөлөн альфа-шилжилт + медиан шүүлтүүрээр цэвэрлэсэн.
 *
 * ⚠ ЗУРГИЙН СУЛ ТАЛ: өнгө нь ТОГТМОЛ — эриний өнгөөр солигдохгүй.
 *   SVG хувилбар (`CloudMotif`) энэ шаардлагатай газарт үлдэнэ.
 */
import React from 'react';
import { Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

/** Эх зургийн харьцаа — 520×505 */
const RATIO = 505 / 520;

export function CloudArt({
  width = 220,
  /** Толин тусгал — эсрэг буланд тавихад */
  flip = false,
  opacity = 1,
  style,
}: {
  width?: number;
  flip?: boolean;
  opacity?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- RN-ийн статик asset шаардлага
      source={require('../../assets/cloud-motif.png')}
      style={[
        styles.img,
        { width, height: width * RATIO, opacity },
        flip && styles.flip,
        style,
      ]}
      resizeMode="contain"
      // Чимэглэл — дэлгэц уншигч алгасана
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  img: { position: 'absolute' },
  flip: { transform: [{ scaleX: -1 }] },
});
