/**
 * Нүүр — Өдрийн сорил, streak, rank ахиц (Бүлэг 3.5)
 * Бүлэг 3.7: «чөлөөт горим» — эринээ өөрөө сонгож дадлага хийх эрх
 */
import React, { useCallback, useEffect } from 'react';
import {
  Image,
  ImageBackground,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import {
  orderActions,
  RANK_META,
  type PathAction,
  type RankTier,
} from '@nomad/core';
import {
  Card,
  ErrorState,
  OfflineBanner,
  PrimaryButton,
  ProgressBar,
  SectionTitle,
  Skeleton,
  StreakBadge,
} from '@/components/ui';
import {
  usePrefetchOfflinePack,
  useProfile,
  useSyncOffline,
} from '@/hooks/queries';
import { ScriptCard } from '@/components/ScriptCard';
import { CloudDivider } from '@/components/Ornament';
import { ScreenCanvas } from '@/components/ScreenCanvas';

/** Толгойн ард дэлгэрэх үүлэн массын өндөр — агуулгын зайтай уялдана */
const CANVAS_BANK = 92;
import { pendingCount } from '@/offline/queue';
import { useGameStore } from '@/store/useGameStore';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

/** Tab дэлгэц — эцэг stack руу навигаци хийнэ */
type Props = { navigation: NativeStackNavigationProp<RootStackParamList> };

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { data: profile, isLoading, isError, error, refetch, isRefetching } =
    useProfile();

  const isOffline = useGameStore((s) => s.isOffline);
  const pendingSyncCount = useGameStore((s) => s.pendingSyncCount);
  const setPendingSyncCount = useGameStore((s) => s.setPendingSyncCount);

  const syncOffline = useSyncOffline();
  const prefetchPack = usePrefetchOfflinePack();

  // Апп нээгдэхэд: хүлээгдэж буй хариултыг sync, маргаашийн багцыг татах
  useEffect(() => {
    void pendingCount().then(setPendingSyncCount);
  }, [setPendingSyncCount]);

  useEffect(() => {
    if (!isOffline && pendingSyncCount > 0 && !syncOffline.isPending) {
      syncOffline.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline, pendingSyncCount]);

  useEffect(() => {
    if (!isOffline && !prefetchPack.isPending) {
      prefetchPack.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline]);

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <ScreenCanvas spine="tenger" bankHeight={CANVAS_BANK}>
        <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
          <View style={{ padding: spacing.md }}>
            <Skeleton height={70} />
            <Skeleton height={110} />
            <Skeleton height={110} />
            <Skeleton height={150} />
          </View>
        </View>
      </ScreenCanvas>
    );
  }

  if (isError || !profile) {
    return (
      <ScreenCanvas spine="tenger" bankHeight={CANVAS_BANK}>
        <View style={[styles.flex, styles.center, { paddingTop: insets.top }]}>
          <ErrorState
            title="Мэдээлэл ачаалж чадсангүй"
            message={error instanceof Error ? error.message : 'Сүлжээгээ шалгана уу.'}
            actionLabel="Дахин оролдох"
            onAction={onRefresh}
          />
        </View>
      </ScreenCanvas>
    );
  }

  const tier = profile.rankTier as RankTier;
  const meta = RANK_META[tier];
  const tierProgress = profile.nextTierMinXp
    ? (profile.xp - meta.minXp) / (profile.nextTierMinXp - meta.minXp)
    : 1;

  return (
    <ScreenCanvas spine="tenger" bankHeight={CANVAS_BANK}>
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
        // Толгойн ард үүлэн масс байгаа тул агуулгыг түүний доор буулгана.
        // Эс тэгвээс алтан контур бичгийг зүсэж уншигдацыг эвдэнэ.
        { paddingTop: insets.top + CANVAS_BANK + spacing.sm },
      ]}>
      {isOffline && <OfflineBanner pendingCount={pendingSyncCount} />}

      {/* ─── 1. ХАМТРАГЧ ДҮР БА ТОГЛОГЧИЙН ХЭСЭГ (COMPANION HERO BANNER) ─── */}
      <View style={styles.companionBanner}>
        <View style={styles.companionHeaderRow}>
          <View style={styles.avatarWrap}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require('../../assets/companion-nomad.jpg')}
              style={styles.companionAvatar}
              resizeMode="cover"
            />
            <View style={[styles.avatarTierBadge, { borderColor: tierColor(tier) }]}>
              <Text style={styles.avatarTierBadgeText}>{profile.rankTitle}</Text>
            </View>
          </View>

          <View style={styles.companionInfo}>
            <Text style={styles.greetingSub}>САЙН УУ, АЯЛАГЧ АА!</Text>
            <Text style={styles.greetingName} numberOfLines={1}>
              {profile.displayName}
            </Text>
            <Text style={[styles.rankEraText, { color: tierColor(tier) }]}>
              {profile.rankTitle} · {profile.rankEra}
            </Text>
          </View>

          <StreakBadge days={profile.streakDays} paused={profile.streakFreeMode} />
        </View>

        {/* RPG Level XP Gauge */}
        <View style={styles.xpGaugeWrap}>
          <View style={styles.xpTextRow}>
            <Text style={styles.xpLabelText}>ТҮВШНИЙ АХИЦ</Text>
            <Text style={styles.xpValuesText}>
              <Text style={styles.xpCurrent}>{profile.xp} XP</Text>
              {profile.nextTierMinXp
                ? ` / ${profile.nextTierMinXp} XP`
                : ' · Дээд түвшин!'}
            </Text>
          </View>
          <ProgressBar progress={tierProgress} color={tierColor(tier)} />
        </View>
      </View>

      <CloudDivider opacity={0.5} style={styles.headerDivider} />

      {/* ─── 2. ГОЛ ДААЛГАВАР: ӨДРИЙН СОРИЛ (EPIC MAIN QUEST) ─── */}
      <Card feature glow style={styles.dailyQuestCard} accent={colors.primary}>
        <View style={styles.questTopRow}>
          <View style={styles.questBadge}>
            <Icon name="bolt" size={13} color={colors.primary} />
            <Text style={styles.questBadgeText}>ӨДРИЙН ГОЛ СОРИЛ</Text>
          </View>
          <View style={styles.questRewardBadge}>
            <Text style={styles.questRewardText}>+50 XP ШАГНАЛ</Text>
          </View>
        </View>

        <Text style={styles.questTitle}>Эртний түүхийн сорилт</Text>
        <Text style={styles.questDesc}>
          10 асуулт · ~3 минут · өдөр бүр шинэ сорилтууд нээгдэнэ
        </Text>

        <PrimaryButton
          title={profile.dailyDone ? 'Дахин дадлага хийх' : '⚔️ Сорилоо эхэлье'}
          onPress={() => navigation.navigate('Quiz', { mode: 'daily' })}
        />

        {profile.dailyDone && (
          <View style={styles.questDoneBadge}>
            <Text style={styles.doneNote}>
              ✓ Өнөөдрийн сорил биелсэн (+50 XP олгогдсон)
            </Text>
          </View>
        )}
      </Card>

      {/* ─── 3. ТОГЛООМЫН АЯЛАЛ & ГОРИМУУД (BENTO GAME JOURNEYS) ─── */}
      <View style={styles.journeysSection}>
        <SectionTitle>Тоглоомын аялал</SectionTitle>

        {/* C2 · Интерактив өгүүлэмж — Уран зурагт Hero Story Card */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => navigation.navigate('Story')}
          style={styles.storyHeroWrap}>
          <ImageBackground
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            source={require('../../assets/warrior-eagle.jpg')}
            style={styles.storyCardBg}
            imageStyle={styles.storyCardImage}
            resizeMode="cover">
            <LinearGradient
              colors={['rgba(8,14,24,0.15)', 'rgba(8,14,24,0.92)'] as const}
              style={styles.storyOverlay}
            />
            <View style={styles.storyContent}>
              <View style={styles.storyTag}>
                <Icon name="scroll" size={12} color="#F5D38A" />
                <Text style={styles.storyTagText}>ИНТЕРАКТИВ ӨГҮҮЛЭМЖ</Text>
              </View>
              <Text style={styles.storyTitle}>Түүхэн сонголт</Text>
              <Text style={styles.storyDesc} numberOfLines={2}>
                Та тэр үед байсан бол юу хийх байсан бэ? Шийдвэрээс тань хамаарч түүх өөрөөр өрнөнө.
              </Text>
              <View style={styles.storyCtaBtn}>
                <Text style={styles.storyCtaText}>Өгүүлэмж эхлүүлэх →</Text>
              </View>
            </View>
          </ImageBackground>
        </TouchableOpacity>

        {/* 2-Column Bento: Чөлөөт горим + Өвөө эмээгийн сан */}
        <View style={styles.bentoRow}>
          {/* Чөлөөт горим */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Quiz', { mode: 'free' })}
            style={[styles.bentoCard, styles.bentoCardSky]}>
            <View style={styles.bentoIconDiskSky}>
              <Icon name="crown" size={18} color={colors.sky} />
            </View>
            <Text style={styles.bentoTitle}>Чөлөөт эрин</Text>
            <Text style={styles.bentoDesc} numberOfLines={2}>
              Эринээ өөрөө сонгож дарамтгүй дадлагаж.
            </Text>
            <Text style={styles.bentoCtaSky}>Аялах →</Text>
          </TouchableOpacity>

          {/* Өвөө эмээгийн сан */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Contribution')}
            style={[styles.bentoCard, styles.bentoCardJade]}>
            <View style={styles.bentoIconDiskJade}>
              <Icon name="khuur" size={18} color={colors.zurag.jade} />
            </View>
            <Text style={styles.bentoTitle}>Өвөөгийн өв</Text>
            <Text style={styles.bentoDesc} numberOfLines={2}>
              Өвөөгийнхөө домгийг бичиж бусдад өвлүүл.
            </Text>
            <Text style={styles.bentoCtaJade}>Хуваалцах →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* C3 · Босоо монгол бичиг — өдөрт нэг үсэг */}
      <ScriptCard />

      {/* B5 · Тоглогчийн замаар эрэмбэлнэ.
          ⚠ ЮУ Ч ХАСАГДАХГҮЙ — зөвхөн дараалал өөрчлөгдөнө (Бүлэг 3.7) */}
      <View style={styles.quickGrid}>
        {orderActions(QUICK_ACTIONS, profile.playerPath).map((action) => {
          const meta = QUICK_META[action];
          if (!meta) return null;
          return (
            <QuickAction
              key={action}
              icon={meta.icon}
              label={meta.label}
              onPress={() => navigation.navigate(meta.screen)}
            />
          );
        })}
      </View>
    </ScrollView>
    </ScreenCanvas>
  );
}

function tierColor(tier: RankTier): string {
  return (
    { bronze: colors.bronze, silver: colors.silver, gold: colors.gold, platinum: colors.platinum }[
      tier
    ] ?? colors.primary
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.quickAction}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.8}>
      <View style={styles.quickIconCircle}>
        <Icon name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  /**
   * ⚠ ДЭВСГЭРГҮЙ: `ScreenCanvas` дэвсгэр, үүл, жаазыг өөрөө зурдаг.
   * Энд `backgroundColor` тавибал тунгалаггүй давхарга үүсч чимэглэлийг
   * бүрэн далдална — ачаалалт ба алдааны төлөвт яг тэр болж байв.
   */
  flex: { flex: 1 },
  center: { justifyContent: 'center' },
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  canvasScroll: { flex: 1, backgroundColor: 'transparent' },
  headerDivider: { alignSelf: 'stretch', marginVertical: spacing.sm },

  /* ─── 1. Хамтрагч дүр ба Профайл баннер ─── */
  companionBanner: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.2,
    borderColor: 'rgba(221, 176, 88, 0.35)',
    elevation: 3,
  },
  companionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarWrap: {
    position: 'relative',
    alignItems: 'center',
  },
  companionAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.bgCardLight,
  },
  avatarTierBadge: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: '#080E18',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  avatarTierBadgeText: {
    color: colors.primaryLight,
    fontSize: 8,
    fontWeight: '800',
    fontFamily: fontFamily.display,
    letterSpacing: 0.5,
  },
  companionInfo: {
    flex: 1,
  },
  greetingSub: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    fontFamily: fontFamily.display,
    letterSpacing: 1,
  },
  greetingName: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
    fontFamily: fontFamily.display,
    marginTop: 1,
  },
  rankEraText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginTop: 2,
  },
  xpGaugeWrap: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  xpTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  xpLabelText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    fontFamily: fontFamily.display,
    letterSpacing: 0.8,
  },
  xpValuesText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  xpCurrent: {
    color: colors.primary,
    fontWeight: '800',
  },

  /* ─── 2. Өдрийн сорил (Epic Quest) ─── */
  dailyQuestCard: {
    borderWidth: 1.2,
    borderColor: 'rgba(221, 176, 88, 0.45)',
  },
  questTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  questBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(221, 176, 88, 0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(221, 176, 88, 0.35)',
  },
  questBadgeText: {
    color: colors.primary,
    fontSize: 9,
    fontFamily: fontFamily.display,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  questRewardBadge: {
    backgroundColor: 'rgba(245, 211, 138, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  questRewardText: {
    color: colors.primaryLight,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  questTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
    fontFamily: fontFamily.display,
    marginTop: spacing.xs,
  },
  questDesc: {
    color: colors.textMuted,
    fontSize: fontSize.sm - 1,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  questDoneBadge: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  doneNote: {
    color: colors.success,
    fontSize: fontSize.sm - 1,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* ─── 3. Bento Тоглоомын аялал ─── */
  journeysSection: {
    marginTop: spacing.md,
  },
  storyHeroWrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(221, 176, 88, 0.4)',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    elevation: 3,
  },
  storyCardBg: {
    minHeight: 155,
    justifyContent: 'flex-end',
  },
  storyCardImage: {
    borderRadius: radius.md,
  },
  storyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  storyContent: {
    padding: spacing.md,
    zIndex: 2,
  },
  storyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(8, 14, 24, 0.8)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(245, 211, 138, 0.4)',
    marginBottom: spacing.xs,
  },
  storyTagText: {
    color: '#F5D38A',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: fontFamily.display,
  },
  storyTitle: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontWeight: '800',
    fontFamily: fontFamily.display,
  },
  storyDesc: {
    color: '#E0E6ED',
    fontSize: fontSize.xs,
    lineHeight: 17,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  storyCtaBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  storyCtaText: {
    color: '#080E18',
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  bentoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  bentoCard: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    minHeight: 130,
    justifyContent: 'space-between',
  },
  bentoCardSky: {
    backgroundColor: 'rgba(64, 186, 213, 0.08)',
    borderColor: 'rgba(64, 186, 213, 0.35)',
  },
  bentoCardJade: {
    backgroundColor: 'rgba(46, 204, 113, 0.08)',
    borderColor: 'rgba(46, 204, 113, 0.35)',
  },
  bentoIconDiskSky: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(64, 186, 213, 0.15)',
    borderWidth: 1,
    borderColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  bentoIconDiskJade: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    borderWidth: 1,
    borderColor: colors.zurag.jade,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  bentoTitle: {
    color: colors.text,
    fontSize: fontSize.md - 1,
    fontWeight: '800',
    fontFamily: fontFamily.display,
  },
  bentoDesc: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  bentoCtaSky: {
    color: colors.sky,
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  bentoCtaJade: {
    color: colors.zurag.jade,
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginTop: spacing.xs,
  },

  /* ─── 4. Хурдан үйлдлүүд ─── */
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  quickAction: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 88,
    justifyContent: 'center',
  },
  quickIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.bgSunken,
    borderWidth: 1,
    borderColor: 'rgba(221, 176, 88, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600' },
});

/**
 * B5 · Нүүр дэлгэцийн хурдан үйлдлүүд.
 *
 * `orderActions` нь эдгээрийг тоглогчийн замаар эрэмбэлнэ. Жагсаалтад
 * байгаа бүх зүйл ҮРГЭЛЖ харагдана — зам нь зөвхөн дарааллыг өөрчилнө.
 */
const QUICK_ACTIONS: PathAction[] = [
  'mentor',
  'battle',
  'voiceBattle',
  'contribution',
];

const QUICK_META: Partial<
  Record<PathAction, { icon: IconName; label: string; screen: 'Mentor' | 'Battle' | 'VoiceBattle' | 'Contribution' | 'Paywall' }>
> = {
  mentor: { icon: 'crown', label: 'AI зөвлөх', screen: 'Mentor' },
  battle: { icon: 'bow', label: 'Сур харваа', screen: 'Battle' },
  voiceBattle: { icon: 'mic', label: 'Түргэн хэллэг', screen: 'VoiceBattle' },
  contribution: { icon: 'book', label: 'Өвөө эмээ', screen: 'Contribution' },
};
