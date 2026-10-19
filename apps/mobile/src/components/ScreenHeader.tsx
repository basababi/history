/**
 * Дэлгэцийн толгой — нэгдсэн хэв маяг
 *
 * ЯАГААД ЭНЭ БҮРЭЛДЭХҮҮН ХЭРЭГТЭЙ ВЭ: өмнө нь дэлгэц бүр өөрийн
 * `<Text style={styles.title}>` бичдэг байсан. Үр дүнд нь:
 *   • толгойн зай, хэмжээ дэлгэц бүрд өөр
 *   • чимэглэл нэг дэлгэцэд байхад нөгөөд байхгүй
 *   • брэнд нэгдмэл БИШ — 15 дэлгэц 15 өөр өнгө аястай
 *
 * Лавлах зургуудын гол сургамж: уламжлалт зохиомжид гарчиг ХЭЗЭЭ Ч
 * нүцгэн байдаггүй — үргэлж хээтэй тууз дагалддаг. Тэр туузыг НЭГ
 * газар тодорхойлж, бүх дэлгэцэд ижилхэн хэрэглэнэ.
 */
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { CloudBand, CloudDivider } from './Ornament';
import { FadeInUp } from './motion';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export function ScreenHeader({
  title,
  subtitle,
  /** Эриний өнгө г.м. — чимэглэлийн аяс */
  tone = 'brass',
  /** Баруун талын үйлдэл (тохиргооны товч г.м.) */
  right,
  /**
   * Өөрийн үүлэн тууз зурах эсэх.
   *
   * ⚠ Үндсэн утга `false`: `ScreenCanvas` нь дэлгэцийн хэмжээнд үүлэн
   * массыг аль хэдийн зурдаг. Хоёуланг зэрэг асаавал үүл ДАВХАРЛАЖ,
   * хоёр дахь нь бараан шаварлаг зурвас болж харагдана (эмулятор дээр
   * илэрсэн). Canvas-гүй дангаар ашиглах үед л `true` болгоно.
   */
  band = false,
  style,
}: {
  title: string;
  subtitle?: string;
  tone?: 'brass' | 'sky' | 'coral' | 'muted';
  right?: React.ReactNode;
  band?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      {band && <CloudBand tone={tone} height={30} opacity={0.32} style={styles.band} />}

      <FadeInUp>
        <View style={styles.row}>
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          </View>
          {right}
        </View>

        <CloudDivider
          color={colors.primary}
          accent={colors.zurag.goldLine}
          opacity={0.7}
          style={styles.divider}
        />

        {subtitle !== undefined && <Text style={styles.subtitle}>{subtitle}</Text>}
      </FadeInUp>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  // Баруун дээд булангийн үүлэн хээтэй давхцахгүй — урт нэр (бүлэг) хээний доор орж байв
  titleWrap: { flex: 1, paddingRight: 28 },
  title: {
    fontFamily: fontFamily.display,
    color: colors.text,
    fontSize: fontSize.xxl,
    lineHeight: fontSize.xxl * 1.18,
  },
  divider: { marginTop: spacing.xs, marginBottom: spacing.xs, alignSelf: 'stretch' },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});
