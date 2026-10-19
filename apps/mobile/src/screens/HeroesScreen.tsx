/**
 * Баатрууд — rank ахихад нээгддэг каталог (Бүлэг 3.2)
 *
 * Perk-үүд ДӨРВҮҮЛЭЭ бодитоор ажилладаг болсон (алдааны засвар №7):
 *   +5 сек → session; 50/50 → серверийн endpoint;
 *   streak shield → finish; эриний бонус ×1.5 → answer
 *
 * Алдааны засвар №20: локал `radiusMd()` устаж, theme-ийн `radius` ашиглана.
 */
import React, { useCallback } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { HeroCard } from '@/components/HeroCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ScreenCanvas } from '@/components/ScreenCanvas';

/** Толгойн ард дэлгэрэх үүлэн массын өндөр — агуулгын зайтай уялдана */
const CANVAS_BANK = 120;
import { useCatalog, useProfile, useUpdateProfile } from '@/hooks/queries';
import { colors, fontSize, radius, spacing } from '@/theme';

export default function HeroesScreen() {
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  const onRefresh = useCallback(() => {
    void catalog.refetch();
  }, [catalog]);

  if (catalog.isLoading) {
    return (
      <ScreenCanvas spine="hero" bankHeight={CANVAS_BANK}>
        <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
          <View style={{ padding: spacing.md }}>
            <Skeleton height={40} />
            <Skeleton height={180} />
            <Skeleton height={180} />
          </View>
        </View>
      </ScreenCanvas>
    );
  }

  if (catalog.isError) {
    return (
      <ScreenCanvas spine="hero" bankHeight={CANVAS_BANK}>
        <View style={[styles.flex, styles.center, { paddingTop: insets.top }]}>
          <ErrorState
            title="Баатрууд ачаалж чадсангүй"
            message={
              catalog.error instanceof Error
                ? catalog.error.message
                : 'Сүлжээгээ шалгана уу.'
            }
            actionLabel="Дахин оролдох"
            onAction={onRefresh}
          />
        </View>
      </ScreenCanvas>
    );
  }

  const heroes = catalog.data?.heroes ?? [];

  return (
    <ScreenCanvas spine="hero" bankHeight={CANVAS_BANK}>
    <ScrollView
      style={styles.canvasScroll}
      refreshControl={
        <RefreshControl
          refreshing={catalog.isRefetching}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + CANVAS_BANK + spacing.sm },
      ]}>
      <ScreenHeader
        title="Баатрууд"
        subtitle="Rank ахих тусам түүхэн баатрууд нээгдэж, чадвар нь сорилд бодитоор нөлөөлнө."
        tone="brass"
      />

      {heroes.length === 0 ? (
        <EmptyState
          emoji="⚔️"
          title="Баатар байхгүй"
          message="Каталог хараахан бэлдээгүй байна."
        />
      ) : (
        <View style={styles.grid}>
        {heroes.map((hero) => (
          <HeroCard
            key={hero.id}
            hero={hero}
            active={profile?.activeHeroId === hero.id}
            onPress={() => updateProfile.mutate({ activeHeroId: hero.id })}
          />
        ))}
        </View>
      )}
    </ScrollView>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  /**
   * ⚠ ДЭВСГЭРГҮЙ: `ScreenCanvas` дэвсгэр, үүл, жаазыг өөрөө зурдаг.
   * Энд `backgroundColor` тавибал тунгалаггүй давхарга үүсч чимэглэлийг
   * бүрэн далдална — ачаалалт ба алдааны төлөвт яг тэр болж байв.
   */
  flex: { flex: 1 },
  center: { justifyContent: 'center' },
  canvasScroll: { flex: 1, backgroundColor: 'transparent' },
  container: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  heroCard: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroName: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  tier: { fontSize: fontSize.sm, fontWeight: '600' },
  lore: { color: colors.text, fontSize: fontSize.sm, lineHeight: 20 },
  perkBox: { gap: 2 },
  perk: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
  source: { color: colors.textMuted, fontSize: fontSize.sm - 2, fontStyle: 'italic' },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  actionBtnActive: {
    backgroundColor: colors.bgCardLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionText: { color: colors.bg, fontWeight: '700', fontSize: fontSize.sm },
  actionTextActive: { color: colors.primary },
  lockedNote: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
