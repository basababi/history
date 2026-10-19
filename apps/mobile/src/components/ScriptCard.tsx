/**
 * «Өдрийн үсэг» — босоо монгол бичгийн карт (ROADMAP C3)
 *
 * СУДАЛГААНЫ ҮНДЭСЛЭЛ: López-Enríquez нар Амазиг/Тифинаг бичгийн
 * тоглоомыг тэгш байдлын жишээ болгон онцолсон. Босоо бичиг нь яг ижил
 * тохиолдол. «Тэгш байдал нь хоёрдогч үр дүн биш, зохиомжийн зарчим.»
 *
 * ЗОРИУДААР ЖИЖИГ: бүтэн модуль биш, ӨДӨРТ НЭГ ҮСЭГ. Ачаалал багатай тул
 * хэрэглэгч зугтахгүй, гэхдээ бичиг өдөр бүр нүдэнд харагдана.
 *
 * ⚠ ФОНТ: Монгол Unicode блок нь тусгай фонт шаарддаг. Байхгүй үед хоосон
 *   дөрвөлжин гарна — тиймээс тэмдэгтийг ҮРГЭЛЖ уншлагатай нь ХАМТ
 *   харуулна. Фонт ачаалагдаагүй ч карт утга агуулсан хэвээр байна.
 */
import React, { useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { letterOfTheDay, SCRIPT_DISCLAIMER, todayInUlaanbaatar } from '@nomad/core';
import { Card } from '@/components/ui';
import { FadeInUp } from '@/components/motion';
import { tapFeedback } from '@/feedback';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

export function ScriptCard() {
  const [revealed, setRevealed] = useState(false);
  const letter = letterOfTheDay(todayInUlaanbaatar());

  return (
    <Card accent={colors.sky} style={{ marginTop: spacing.md }}>
      <View style={styles.header}>
        <Text style={styles.title}>Өдрийн үсэг</Text>
        <Text style={styles.badge}>ᠮᠣᠩᠭᠣᠯ</Text>
      </View>

      <Pressable
        onPress={() => {
          tapFeedback();
          setRevealed((r) => !r);
        }}
        accessibilityRole="button"
        accessibilityLabel={
          revealed
            ? `${letter.cyrillic} үсэг, уншлага ${letter.reading}. Хаах`
            : `Өнөөдрийн үсэг ${letter.cyrillic}. Босоо бичлэгийг харах`
        }
        style={styles.stageWrap}>
        <ImageBackground
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          source={require('../../assets/calligraphy-bg.jpg')}
          style={styles.stage}
          imageStyle={styles.stageBgImage}
          resizeMode="cover">
          <View style={styles.stageOverlay} />
          <View style={styles.pair}>
            <View style={styles.side}>
              <Text style={styles.cyr}>{letter.cyrillic}</Text>
              <Text style={styles.sideLabel}>кирилл</Text>
            </View>

            <Text style={styles.arrow}>→</Text>

            <View style={styles.side}>
              {/* Босоо бичиг нь дээрээс доош уншигдана */}
              <Text style={styles.mongol}>{letter.mongol}</Text>
              <Text style={styles.sideLabel}>босоо</Text>
            </View>
          </View>

          <Text style={styles.reading}>«{letter.reading}» гэж уншина</Text>
        </ImageBackground>
      </Pressable>

      {revealed ? (
        <FadeInUp>
          <Text style={styles.mnemonic}>💡 {letter.mnemonic}</Text>
          <Text style={styles.disclaimer}>{SCRIPT_DISCLAIMER}</Text>
        </FadeInUp>
      ) : (
        <Text style={styles.tapHint}>Дэлгэрэнгүйг харахаар дар</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
    fontFamily: fontFamily.display,
  },
  badge: { color: colors.sky, fontSize: fontSize.md, opacity: 0.7 },

  stageWrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(221, 176, 88, 0.25)',
  },
  stage: {
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    minHeight: 120,
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: colors.bgSunken,
  },
  stageBgImage: {
    opacity: 0.16,
    borderRadius: radius.md,
  },
  stageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8, 14, 24, 0.72)',
  },
  pair: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  side: { alignItems: 'center', gap: 2, minWidth: 64 },
  sideLabel: { color: colors.textDim, fontSize: fontSize.xs },

  cyr: { color: colors.text, fontSize: 48, fontWeight: '900', lineHeight: 56 },
  /** Монгол бичиг нь босоо — өндөр мөрийн зайтай */
  mongol: { color: colors.sky, fontSize: 48, lineHeight: 58, textAlign: 'center' },
  arrow: { color: colors.textDim, fontSize: fontSize.xl },

  reading: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  mnemonic: { color: colors.text, fontSize: fontSize.sm, lineHeight: 20 },
  disclaimer: { color: colors.textDim, fontSize: fontSize.xs, lineHeight: 17, marginTop: spacing.xs },
  tapHint: { color: colors.textDim, fontSize: fontSize.xs, textAlign: 'center' },
});
