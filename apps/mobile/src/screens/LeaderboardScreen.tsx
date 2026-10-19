/**
 * Лигийн чансаа — 30 хүний бүлэг (Бүлэг 3.6, ADR-003)
 *
 * Алдааны засвар №10: `getMockLeague` БҮРЭН УСТСАН. Одоо Redis ZSET-ээс
 * ирсэн бодит өгөгдөл. Redis унасан үед `degraded: true` ирж, Postgres
 * snapshot-оос уншсаныг хэрэглэгчид ил хэлнэ (Бүлэг 6.6).
 */
import React, { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LeagueEntry } from '@nomad/contracts';
import { ApiError } from '@/api/client';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ScreenCanvas } from '@/components/ScreenCanvas';

/** Толгойн ард дэлгэрэх үүлэн массын өндөр — агуулгын зайтай уялдана */
const CANVAS_BANK = 120;
import { useLeague } from '@/hooks/queries';
import { tapFeedback } from '@/feedback';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <View style={[styles.medalCircle, styles.goldMedal]}>
        <Text style={[styles.medalText, { color: '#080E18' }]}>1</Text>
      </View>
    );
  }
  if (rank === 2) {
    return (
      <View style={[styles.medalCircle, styles.silverMedal]}>
        <Text style={[styles.medalText, { color: '#080E18' }]}>2</Text>
      </View>
    );
  }
  if (rank === 3) {
    return (
      <View style={[styles.medalCircle, styles.bronzeMedal]}>
        <Text style={[styles.medalText, { color: '#FFFFFF' }]}>3</Text>
      </View>
    );
  }
  return <Text style={styles.rankCell}>{rank}.</Text>;
}

export default function LeaderboardScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, error, refetch, isRefetching } = useLeague();

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <ScreenCanvas spine="history" bankHeight={CANVAS_BANK}>
        <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
          <View style={{ padding: spacing.md }}>
            <Skeleton height={40} />
            <Skeleton height={280} />
          </View>
        </View>
      </ScreenCanvas>
    );
  }

  if (isError) {
    const notInLeague =
      error instanceof ApiError && error.code === 'NOT_IN_LEAGUE';
    return (
      <ScreenCanvas spine="history" bankHeight={CANVAS_BANK}>
      <View style={[styles.flex, styles.center, { paddingTop: insets.top }]}>
        {notInLeague ? (
          <EmptyState
            emoji="🏆"
            title="Лигт хараахан ороогүй"
            message="Долоо хоногийн эхэнд лигийн бүлэгт автоматаар хуваарилагдана. Эхний сорилоо өгөөд хүлээгээрэй!"
          />
        ) : (
          <ErrorState
            title="Чансаа ачаалж чадсангүй"
            message={error instanceof Error ? error.message : 'Сүлжээгээ шалгана уу.'}
            actionLabel="Дахин оролдох"
            onAction={onRefresh}
          />
        )}
      </View>
      </ScreenCanvas>
    );
  }

  /**
   * ⚠ Өмнө нь `return null` байсан — өгөгдөл ирээгүй ч алдаа ч биш
   * тохиолдолд хэрэглэгч БҮРЭН ХООСОН дэлгэц хардаг байв. Хоосон
   * дэлгэц нь эвдэрсэнтэй ялгагдахгүй тул тайлбартай төлөв үзүүлнэ.
   */
  if (!data) {
    return (
      <ScreenCanvas spine="history" bankHeight={CANVAS_BANK}>
        <View style={[styles.flex, styles.center, { paddingTop: insets.top }]}>
          <EmptyState
            title="Чансаа бэлэн болоогүй"
            message="Түр хүлээгээд дахин оролдоно уу."
          />
        </View>
      </ScreenCanvas>
    );
  }

  return (
    <ScreenCanvas spine="history" bankHeight={CANVAS_BANK}>
    <ScrollView
      style={styles.canvasScroll}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + CANVAS_BANK + spacing.sm },
      ]}>
      <ScreenHeader
        title={`${tierLabel(data.tier)} лиг`}
        subtitle="Долоо хоног бүр: дээд 5 нь дээш, доод 5 нь доош шилжинэ."
        tone="sky"
      />

      {/* B4 · Ангийн лиг — Lee & Ko (2026): үе тэнгийн харилцаа нь
          AI-тай харилцахтай ижил үр дүн өгдөг */}
      <Pressable
        onPress={() => {
          tapFeedback();
          navigation.navigate('Classroom');
        }}
        accessibilityRole="button"
        accessibilityLabel="Ангийн лиг рүү очих"
        style={styles.classBanner}>
        <Text style={styles.classBannerText}>
          🏫 Ангийнхантайгаа хамтын зорилт биелүүл →
        </Text>
      </Pressable>

      {data.degraded && (
        <View style={styles.degradedBanner}>
          <Text style={styles.degradedText}>
            ⏳ Чансаа шинэчлэгдэж байна — түр хугацааны хуулбар харагдаж байна
          </Text>
        </View>
      )}

      <Text style={styles.myRank}>
        Таны байр: {data.myRank}/{data.totalMembers}
      </Text>

      <Card>
        {data.entries.length === 0 ? (
          <EmptyState
            emoji="👥"
            title="Бүлэг хоосон"
            message="Энэ долоо хоногт гишүүд хараахан нэмэгдээгүй байна."
          />
        ) : (
          data.entries.map((entry) => (
            <LeagueRow key={entry.userId} entry={entry} />
          ))
        )}
      </Card>

      <Text style={styles.weekNote}>Долоо хоног: {data.weekKey}</Text>
    </ScrollView>
    </ScreenCanvas>
  );
}

function LeagueRow({ entry }: { entry: LeagueEntry }) {
  const zoneColor =
    entry.movement === 'promote'
      ? colors.success
      : entry.movement === 'relegate'
        ? colors.error
        : 'transparent';

  return (
    <View
      style={[styles.row, entry.isMe && styles.meRow]}
      accessibilityLabel={`${entry.rank}-р байр, ${entry.displayName}, ${entry.weeklyXp} оноо`}>
      <View style={[styles.zoneBar, { backgroundColor: zoneColor }]} />
      <RankBadge rank={entry.rank} />
      <Text style={{ fontSize: 18 }}>{entry.avatarEmoji}</Text>
      <Text style={[styles.name, entry.isMe && styles.meName]} numberOfLines={1}>
        {entry.displayName}
      </Text>
      <Text style={styles.xp}>{entry.weeklyXp} XP</Text>
    </View>
  );
}

function tierLabel(tier: string): string {
  return (
    { bronze: 'Хүрэл', silver: 'Мөнгөн', gold: 'Алтан', platinum: 'Цагаан алтан' }[
      tier
    ] ?? tier
  );
}

const styles = StyleSheet.create({
  classBanner: {
    borderWidth: 1,
    borderColor: 'rgba(64, 186, 213, 0.4)',
    backgroundColor: 'rgba(64, 186, 213, 0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  classBannerText: { color: colors.sky, fontSize: fontSize.sm, fontWeight: '600' },

  /**
   * ⚠ ДЭВСГЭРГҮЙ: `ScreenCanvas` дэвсгэр, үүл, жаазыг өөрөө зурдаг.
   * Энд `backgroundColor` тавибал тунгалаггүй давхарга үүсч чимэглэлийг
   * бүрэн далдална — ачаалалт ба алдааны төлөвт яг тэр болж байв.
   */
  flex: { flex: 1 },
  center: { justifyContent: 'center' },
  canvasScroll: { flex: 1, backgroundColor: 'transparent' },
  container: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  myRank: { color: colors.primary, fontSize: fontSize.md, fontWeight: '800', fontFamily: fontFamily.display },
  degradedBanner: {
    backgroundColor: colors.bgCardLight,
    borderRadius: 8,
    padding: spacing.sm,
  },
  degradedText: { color: colors.textMuted, fontSize: fontSize.sm - 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
    minHeight: 44,
  },
  zoneBar: { width: 3, height: 28, borderRadius: 2 },
  meRow: {
    backgroundColor: colors.bgCardLight,
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(221, 176, 88, 0.45)',
  },
  medalCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldMedal: {
    backgroundColor: '#DDB058',
    elevation: 3,
  },
  silverMedal: {
    backgroundColor: '#C0C7D6',
    elevation: 2,
  },
  bronzeMedal: {
    backgroundColor: '#B5733F',
    elevation: 2,
  },
  medalText: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: fontFamily.display,
  },
  rankCell: {
    color: colors.textMuted,
    width: 24,
    textAlign: 'center',
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  name: { flex: 1, color: colors.text, fontSize: fontSize.sm },
  meName: { fontWeight: '800', color: colors.primary },
  xp: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  weekNote: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
