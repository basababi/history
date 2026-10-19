/**
 * Дэлгэцийн суурь — жаазан зохиомжийг нэг дор угсарна
 *
 * Лавлах зургуудын давхаргын дараалал (доороос дээш):
 *
 *   1. Гүн дэвсгэр өнгө
 *   2. Бараг мэдэгдэхгүй хайрсан бүтэц      ← «баялаг» мэдрэмж эндээс
 *   3. Үүлэн масс                            ← эзэлхүүн
 *   4. Алтан хос жааз, шаталсан булантай     ← зохиомжийг барина
 *   5. Агуулга
 *
 * ══ ЭМУЛЯТОР ДЭЭР ХАРЖ ЗАССАН ХОЁР ЗҮЙЛ ══
 *
 * 1. ЖААЗ БА SAFE AREA. Эхний хувилбарт жаазыг дэлгэцийн физик ирмэгээс
 *    хэмждэг байсан тул булангийн хаалт статус бар ба таб барын доор
 *    орж хагас нуугдаж байв. Одоо safe area-гаас хэмжинэ.
 *
 * 2. ҮҮЛ ХААНА БАЙХ ЁСТОЙ ВЭ. Эхлээд доод ирмэгт тавьсан — лавлах 4-р
 *    зураг шиг. Гэвч тэр зураг бол ХӨДӨЛГӨӨНГҮЙ зурагт, доод тал нь
 *    чөлөөтэй. Гүйлгэдэг дэлгэцэд доод тал ХЭЗЭЭ Ч чөлөөтэй байхгүй —
 *    үүл картуудын ард орж шаварчихдаг. Найдвартай чөлөөтэй цорын ганц
 *    бүс бол ТОЛГОЙН ард тул үүлийг тийш зөөв.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrnateFrame, PatternGround } from './Frame';
import { CloudArt } from './CloudArt';
import { ScriptSpine, type SpineWord } from './ScriptSpine';
import { useAppFonts } from '@/hooks/useAppFonts';
import { colors } from '@/theme';

export function ScreenCanvas({
  children,
  /** Толгойн ард дэлгэрэх үүлэн массын өндөр. 0 бол үүлгүй */
  bankHeight = 92,
  /** Алтан жааз харуулах эсэх */
  frame = true,
  /**
   * Ирмэгийн босоо монгол бичиг. `null` бол харуулахгүй.
   *
   * Энэ бол аппыг эргэлзээгүй МОНГОЛ болгодог цорын ганц элемент —
   * угалз, өнгө, үүлийг бусад соёлд ч олно, босоо бичгийг олохгүй.
   */
  spine = 'mongol',
  style,
}: {
  children: React.ReactNode;
  bankHeight?: number;
  frame?: boolean;
  spine?: SpineWord | null;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const fonts = useAppFonts();
  const [size, setSize] = useState({ w: 0, h: 0 });

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    // Зөвхөн бодитоор өөрчлөгдсөн үед — хэмжээ бүрд дахин тооцоолохгүй
    if (Math.abs(width - size.w) > 1 || Math.abs(height - size.h) > 1) {
      setSize({ w: width, h: height });
    }
  }

  const ready = size.w > 0 && size.h > 0;

  /** Жаазны хүрээ — safe area-гийн дотор талд */
  const frameTop = insets.top + 4;
  const frameBottom = insets.bottom + 4;
  const frameH = size.h - frameTop - frameBottom;

  return (
    <View style={[styles.root, style]} onLayout={onLayout}>
      {ready && (
        <>
          <PatternGround width={size.w} height={size.h} />

          {/*
            ⚠ БҮТЦИЙН ӨӨРЧЛӨЛТ: өмнө нь бүтэн өргөний үүлэн ТУУЗ байсан.
            Тэр нь дэлгэцийг хаяавчтай майхан шиг харагдуулж байв. Лавлах
            зурагт үүл нь ХЭЗЭЭ Ч тууз биш — булангаас орж ирдэг НЭГЖ
            чимэглэл. Тиймээс баруун дээд булангаас хэсэгчлэн халин орно.
          */}
          {/*
            Хоёр талд хоёр үүл. Нэг талдаа ганц үүл тавихад нөгөө тал нь
            хоосорч, зохиомж тэнцвэргүй болдог. Лавлах зурагт ч үүл хос
            хосоороо, өөр өөр хэмжээтэй байрладаг.

            ⚠ Хоёр нь ЯГ ижил байвал толин тусгал нь тодорхой мэдэгдэж
            машин шиг харагдана. Тиймээс зүүн талынх нь ЖИЖИГ, арай доогуур.
          */}
          {bankHeight > 0 && (
            <>
              {/*
                ⚠ БАЙРЛАЛЫН ЗАСВАР: өмнө нь `top: frameTop - 12` байсан тул
                үүлний дээд тал дэлгэцээр таслагдаж, огтолсон мэт харагдаж
                байв. Мөн зүүн талынх `left: -34` тул хагас нь гадуур байсан.
                Одоо хоёулаа БҮТНЭЭРЭЭ харагдана — чимэглэл огтлогдвол
                гэмтсэн мэт уншигдана.
              */}
              {/*
                ⚠ ХЭМЖЭЭНИЙ ЗАСВАР: 0.52 өргөнтэй үед үүл гарчгийг дарж,
                «Сайн уу, ...» уншигдахаа больж байв. Чимэглэл агуулгыг
                хэзээ ч дарах ёсгүй — тиймээс жижигрүүлж, дээш татав.

                ⚠ Эх зураг нь ХОЁР бөөгнөрөл (дээд + доод, туузаар
                холбогдсон) агуулдаг. Тиймээс нэг `CloudArt` = хоёр үүл.
                Хоёуланг нь тавихад дөрөв болж хэт бөглүү болно —
                зүүн талынхыг мэдэгдэхүйц жижиг, бүдэг үлдээв.
              */}
              <CloudArt
                width={size.w * 0.4}
                opacity={0.85}
                style={[styles.motifRight, { top: frameTop - 52 }]}
              />
              <CloudArt
                width={size.w * 0.26}
                flip
                opacity={0.55}
                style={[styles.motifLeft, { top: frameTop - 30 }]}
              />
            </>
          )}
        </>
      )}

      {/* Агуулга — чимэглэлийн дээр */}
      <View style={styles.content}>{children}</View>

      {/* Босоо бичгийн нуруу — жаазны дотор талд */}
      {ready && spine !== null && (
        // ⚠ pointerEvents="none" ЗААВАЛ: давхарга нь агуулгын ДЭЭР байрлана —
        //   үгүй бол вэб дээр бүтэн дэлгэцийн хоосон div товчлуурын даралтыг иднэ.
        <View style={[styles.spineLayer, { top: frameTop, height: frameH }]} pointerEvents="none">
          <ScriptSpine word={spine} available={fonts.mongolScript} side="left" />
        </View>
      )}

      {ready && frame && frameH > 0 && (
        <View style={[styles.frameLayer, { top: frameTop, height: frameH }]} pointerEvents="none">
          <OrnateFrame width={size.w} height={frameH} inset={8} opacity={0.42} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  content: { flex: 1 },
  /** Баруун дээд булангаас хэсэгчлэн гадагш халина */
  motifRight: { position: 'absolute', right: -26 },
  /** Зүүн талынх нь жижиг, арай доогуур — тэнцвэр гаргана */
  motifLeft: { position: 'absolute', left: -30 },
  frameLayer: { position: 'absolute', left: 0, right: 0 },
  spineLayer: { position: 'absolute', left: 0, width: 34 },
});
