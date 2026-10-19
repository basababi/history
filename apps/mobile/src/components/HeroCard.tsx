/**
 * Баатрын карт — цуглуулах эд (ROADMAP B2)
 *
 * ЯАГААД: Өмнө нь Модун шаньюй бол `🏹` гэсэн emoji байсан. Энэ нь
 * хямдхан мэдрэмж өгөх хамгийн том эх үүсвэр байв.
 *
 * Судалгааны үндэслэл — Lee нар: «Зорилгодоо хүрсний дараа шагнал үр
 * нөлөөгөө алддаг.» Цуглуулах, ховордол, нээх мөч нь шагналыг сунгана.
 *
 * ⚠ Түгжээтэй карт нь СҮҮДЭР + шаардлагатай XP харуулна — хүсэл төрүүлнэ.
 * Зурсан дүрслэл ирэх хүртэл угалзан жаазтай силуэт ашиглана.
 */
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Hero } from '@nomad/contracts';
import { RANK_META, type RankTier } from '@nomad/core';
import {
  colors,
  elevation,
  fontFamily,
  fontSize,
  radius,
  spacing,
} from '@/theme';
import { selectFeedback } from '@/feedback';
import { Animated, useFoilSweep, usePressScale } from './motion';
import { OrnamentCorner, Ulzii } from './Ornament';

type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

const RARITY: Record<
  Rarity,
  { label: string; color: string; frame: readonly [string, string, string]; foil: boolean }
> = {
  common: {
    label: 'Энгийн',
    color: colors.rarityCommon,
    frame: ['#5B728F', '#182438', '#5B728F'] as const,
    foil: false,
  },
  rare: {
    label: 'Ховор',
    color: colors.rarityRare,
    frame: ['#2FD2C5', '#103942', '#2FD2C5'] as const,
    foil: false,
  },
  epic: {
    label: 'Эпик',
    color: colors.rarityEpic,
    frame: ['#B865F8', '#421666', '#B865F8'] as const,
    foil: true,
  },
  legendary: {
    label: 'Домогт',
    color: colors.rarityLegendary,
    frame: ['#F5D38A', '#7A5408', '#F5D38A'] as const,
    foil: true,
  },
};

function rarityOf(value: string): Rarity {
  return value in RARITY ? (value as Rarity) : 'common';
}

const CARD_WIDTH = 168;

export function HeroCard({
  hero,
  active,
  onPress,
}: {
  hero: Hero;
  active?: boolean;
  onPress?: () => void;
}) {
  const rarity = rarityOf(hero.rarity);
  const meta = RARITY[rarity];
  const press = usePressScale(0.97);
  const foil = useFoilSweep(hero.unlocked && meta.foil, CARD_WIDTH);

  const tier = hero.rankTier as RankTier;
  const requiredXp = RANK_META[tier]?.minXp ?? 0;

  /**
   * ⚠ Хүрэл баатрын `minXp` нь 0 тул «0 XP хүрэхэд нээгдэнэ» гэсэн утгагүй
   * бичиг гардаг байв — хэрэглэгч аль хэдийн 0 XP-тэй шүү дээ. Эмулятор
   * дээр ажиллуулж байж илэрсэн; typecheck/тест үүнийг барихгүй.
   *
   * Бодит нөхцөл: `computeUnlocks` нь сорил ДУУССАН үед л ажилладаг тул
   * шинэ хэрэглэгчийн хувьд саад нь XP биш, эхний сорил юм.
   */
  const lockLabel =
    requiredXp > 0
      ? `${requiredXp} XP хүрэхэд нээгдэнэ`
      : 'Эхний сорилоо дуусгахад нээгдэнэ';

  function handlePress() {
    if (!hero.unlocked) return;
    selectFeedback();
    onPress?.();
  }

  return (
    <Animated.View style={press.style}>
      <Pressable
        onPress={handlePress}
        onPressIn={hero.unlocked ? press.onPressIn : undefined}
        onPressOut={hero.unlocked ? press.onPressOut : undefined}
        disabled={!hero.unlocked}
        accessibilityRole="button"
        accessibilityLabel={
          hero.unlocked
            ? `${hero.name}, ${meta.label}${active ? ', идэвхтэй' : ''}`
            : `${hero.name} түгжээтэй. ${lockLabel}`
        }
        accessibilityState={{ disabled: !hero.unlocked, selected: !!active }}>
        {/* Ховордлын жааз */}
        <LinearGradient
          colors={hero.unlocked ? meta.frame : (['#2A3446', '#1B2434', '#2A3446'] as const)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.frame,
            hero.unlocked && elevation.raised,
            active && { borderWidth: 2, borderColor: colors.primary },
          ]}>
          {/* Гялалзалт — зөвхөн эпик, домогт */}
          {hero.unlocked && meta.foil && (
            <Animated.View style={[styles.foil, foil]} pointerEvents="none">
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.34)', 'transparent'] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          )}

          <View style={styles.inner}>
            {/* Дүрслэлийн талбар */}
            <View style={styles.art}>
              <View style={styles.artCorner}>
                <OrnamentCorner size={22} color={meta.color} opacity={0.5} />
              </View>
              <View style={[styles.artCorner, styles.artCornerBR]}>
                <OrnamentCorner size={22} color={meta.color} opacity={0.5} rotate={180} />
              </View>

              {hero.unlocked ? (
                <Ulzii size={54} color={meta.color} strokeWidth={4} />
              ) : (
                <View style={styles.lockWrap}>
                  <Image
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    source={require('../../assets/seal-dragon.jpg')}
                    style={styles.sealImage}
                    resizeMode="cover"
                  />
                  <View style={styles.lockOverlay}>
                    <Ulzii size={24} color={colors.primary} strokeWidth={2.5} />
                    <Text style={styles.lockBadgeText}>ИНСИГНИА</Text>
                  </View>
                </View>
              )}
            </View>

            <Text style={[styles.name, !hero.unlocked && styles.dim]} numberOfLines={1}>
              {hero.unlocked ? hero.name : '？？？'}
            </Text>

            <Text style={styles.era} numberOfLines={1}>
              {RANK_META[tier]?.era ?? ''}
            </Text>

            <View style={[styles.rarityPill, { backgroundColor: meta.color }]}>
              <Text style={styles.rarityText}>{meta.label}</Text>
            </View>

            <View style={styles.perkRow}>
              {hero.unlocked ? (
                <Text style={styles.perk} numberOfLines={2}>
                  ⚡ {perkLabel(hero)}
                </Text>
              ) : (
                <Text style={styles.locked}>{lockLabel}</Text>
              )}
            </View>

            {active && <Text style={styles.activeMark}>✓ Идэвхтэй</Text>}
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

/** Perk-ийг богино тайлбар болгоно */
export function perkLabel(hero: Hero): string {
  const p = hero.perk;
  const parts: string[] = [];
  if (p.extraSeconds) parts.push(`+${p.extraSeconds} сек`);
  if (p.fiftyFifty) parts.push('50/50');
  if (p.streakShield) parts.push('Streak хамгаалалт');
  if (p.eraBonusMultiplier) parts.push(`Эрин ×${p.eraBonusMultiplier}`);
  return parts.length > 0 ? parts.join(' · ') : 'Чадваргүй';
}

const styles = StyleSheet.create({
  frame: {
    width: CARD_WIDTH,
    borderRadius: radius.lg,
    padding: 3,
    overflow: 'hidden',
  },
  foil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2 },
  inner: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    alignItems: 'center',
  },
  art: {
    height: 96,
    alignSelf: 'stretch',
    borderRadius: radius.sm,
    backgroundColor: colors.bgSunken,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  artCorner: { position: 'absolute', top: 4, left: 4 },
  artCornerBR: { top: undefined, left: undefined, bottom: 4, right: 4 },
  lockWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 68,
    height: 68,
  },
  sealImage: {
    width: 66,
    height: 66,
    borderRadius: 33,
    opacity: 0.35,
    borderWidth: 1.5,
    borderColor: 'rgba(221, 176, 88, 0.4)',
  },
  lockOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadgeText: {
    marginTop: 2,
    fontSize: 8,
    fontFamily: fontFamily.display,
    letterSpacing: 1,
    color: colors.primaryLight,
    fontWeight: '800',
  },
  name: {
    fontFamily: fontFamily.display,
    color: colors.text,
    fontSize: fontSize.sm + 1,
    textAlign: 'center',
  },
  dim: { color: colors.textDim },
  era: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
    textAlign: 'center',
  },
  rarityPill: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  rarityText: {
    color: colors.textOnBrass,
    fontSize: fontSize.xs - 1,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  perkRow: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    alignSelf: 'stretch',
    minHeight: 42,
    justifyContent: 'center',
  },
  perk: { color: colors.primary, fontSize: fontSize.xs, textAlign: 'center' },
  locked: { color: colors.textDim, fontSize: fontSize.xs, textAlign: 'center' },
  activeMark: {
    marginTop: spacing.xs,
    color: colors.success,
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
});
