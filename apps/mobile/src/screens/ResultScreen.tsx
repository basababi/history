/**
 * Үр дүн — сессийн эргэцүүлэл (Бүлэг 3.7)
 *
 * Алдааны засвар №9: «Эринээр ахиц» нь ОДОО БОДИТ. Сервер `attempts`-аас
 * эрин тус бүрийн нарийвчлалыг тооцоолж `eraBreakdown`-оор буцаана.
 * Өмнө нь бүх эринд ижилхэн `xp/2000` прогресс харуулдаг байсан.
 *
 * Мөн: «Дараагийн сессийн зорилгоо хэрэглэгч өөрөө сонгоно» (Бүлэг 3.7).
 */
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import type { FinishSessionResponse } from '@nomad/contracts';
import type { RankTier } from '@nomad/core';
import { ApiError } from '@/api/client';
import { finishSession } from '@/api/endpoints';
import { Card, ErrorState, Loading, PrimaryButton, ProgressBar, SectionTitle } from '@/components/ui';
import { ShareCard } from '@/components/ShareCard';
import { queryKeys, useProfile } from '@/hooks/queries';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import type { RootScreenProps } from '@/navigation/types';

type Props = RootScreenProps<'Result'>;

export default function ResultScreen({ navigation, route }: Props) {
  const { data: profile } = useProfile();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { token, offline, total } = route.params;

  const [outcome, setOutcome] = useState<FinishSessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!offline);

  useEffect(() => {
    if (offline || !token) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    finishSession(token)
      .then((res) => {
        if (cancelled) return;
        setOutcome(res);
        void qc.invalidateQueries({ queryKey: queryKeys.profile });
        void qc.invalidateQueries({ queryKey: queryKeys.league });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError ? err.message : 'Дүн тооцоолж чадсангүй'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, offline, qc]);

  if (loading) {
    return <Loading label="Дүн тооцож байна…" />;
  }

  // ─── Офлайн горим ───
  if (offline) {
    return (
      <View style={[styles.flex, styles.center, { paddingTop: insets.top }]}>
        <ErrorState
          emoji="📴"
          title="Хариултууд хадгалагдлаа"
          message={
            `${total} асуултын хариултыг төхөөрөмж дээр хадгаллаа. ` +
            'Сүлжээ сэргэхэд сервер оноолж, XP болон streak-ийг шинэчилнэ.'
          }
          actionLabel="Нүүр рүү буцах"
          onAction={() => navigation.popToTop()}
        />
      </View>
    );
  }

  if (error || !outcome) {
    return (
      <View style={[styles.flex, styles.center, { paddingTop: insets.top }]}>
        <ErrorState
          title="Дүн харуулж чадсангүй"
          message={error ?? 'Тодорхойгүй алдаа.'}
          actionLabel="Нүүр рүү буцах"
          onAction={() => navigation.popToTop()}
        />
      </View>
    );
  }

  const percent =
    outcome.totalQuestions > 0
      ? Math.round((outcome.correctCount / outcome.totalQuestions) * 100)
      : 0;

  // Хамгийн сул эрин — eraBreakdown нь серверээс нарийвчлалаар эрэмбэлэгдэж ирнэ
  const weakest = outcome.eraBreakdown[0];

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.xl },
      ]}>
      <View style={styles.resultCrestWrap}>
        {percent >= 70 ? (
          <Image
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            source={require('../../assets/soyombo-badge.jpg')}
            style={styles.resultSeal}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.resultEmojiCircle}>
            <Text style={styles.emoji}>
              {percent >= 40 ? '🐎' : '🌱'}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.title}>
        {percent >= 70 ? 'Маш сайн!' : percent >= 40 ? 'Сайхан аялал!' : 'Дадлага боллоо!'}
      </Text>
      <View style={styles.scorePill}>
        <Text style={styles.score}>
          {outcome.correctCount}/{outcome.totalQuestions} зөв · +{outcome.totalXp} XP
        </Text>
      </View>

      {/* C4 · Хуваалцах карт — баримт бичиг сошиал хуваалцалтыг өсөлтийн
          суваг №1 гэж заасан. ХАМГИЙН СЭТГЭЛ ХӨДӨЛГӨМ мөчид гарна. */}
      {profile && (
        <ShareCard
          data={{
            displayName: profile.displayName,
            avatarEmoji: profile.avatarEmoji,
            headline: `${outcome.correctCount}/${outcome.totalQuestions}`,
            subline: `${percent}% зөв · +${outcome.totalXp} XP`,
            rankTitle: profile.rankTitle,
            detail:
              outcome.streakIncreased && profile.streakDays > 1
                ? `🔥 ${profile.streakDays} хоног дараалан`
                : undefined,
          }}
        />
      )}

      {/* Бонусын задаргаа */}
      {outcome.bonusXp > 0 && (
        <Card style={styles.banner}>
          <Text style={styles.bannerText}>🎁 Бонус +{outcome.bonusXp} XP</Text>
          <Text style={styles.bonusDetail}>
            {outcome.dailyChallengeAwarded ? 'Өдрийн сорил +50  ' : ''}
            {outcome.streak7Awarded ? 'Streak 7 хоног +200' : ''}
          </Text>
        </Card>
      )}

      {outcome.streakIncreased && (
        <Card style={styles.banner}>
          <Text style={styles.bannerText}>
            🔥 Streak: {outcome.streakDays} өдөр!
          </Text>
          {outcome.shieldUsed && (
            <Text style={styles.bonusDetail}>
              🛡️ Streak хамгаалалт ажиллаж, тасрахаас сэргийллээ
            </Text>
          )}
        </Card>
      )}

      {outcome.rankUp && (
        <Card
          style={[
            styles.banner,
            { borderColor: tierColor(outcome.rankUp as RankTier) },
          ]}>
          <Text
            style={[
              styles.bannerText,
              { color: tierColor(outcome.rankUp as RankTier) },
            ]}>
            ⬆ Шинэ цол: {outcome.newRankTitle}!
          </Text>
          {outcome.unlockedHeroIds.length > 0 && (
            <Text style={styles.bonusDetail}>
              🎉 {outcome.unlockedHeroIds.length} шинэ баатар нээгдлээ
            </Text>
          )}
        </Card>
      )}

      {outcome.unlockedArtifactIds.length > 0 && (
        <Card style={styles.banner}>
          <Text style={styles.bannerText}>
            🏺 Шинэ олдвор цуглууллаа! Музейгээ шалгаарай.
          </Text>
        </Card>
      )}

      {/* ─── Бодит эринээр ахиц (алдааны засвар №9) ─── */}
      <Card style={{ marginTop: spacing.md, alignSelf: 'stretch' }}>
        <SectionTitle>Энэ сессийн эринээр ахиц</SectionTitle>
        {outcome.eraBreakdown.length === 0 ? (
          <Text style={styles.hint}>Энэ сессид эрин тодорхойлогдсонгүй.</Text>
        ) : (
          outcome.eraBreakdown.map((era) => (
            <View key={era.eraId} style={{ marginBottom: spacing.sm }}>
              <View style={styles.eraRow}>
                <Text style={styles.eraName}>{era.eraName}</Text>
                <Text style={styles.eraStat}>
                  {era.correct}/{era.attempted}
                </Text>
              </View>
              <ProgressBar
                progress={era.accuracy}
                color={era.accuracy >= 0.7 ? colors.success : colors.accent}
              />
            </View>
          ))
        )}
      </Card>

      {/* ─── Метакогнитив: итгэлтэй байж алдсан (Бүлэг 3.7) ─── */}
      {outcome.overconfidentQuestionIds.length > 0 && (
        <Card style={[styles.banner, { borderColor: colors.accent }]}>
          <Text style={styles.overconfidentTitle}>
            🎯 Анхаарах зүйл
          </Text>
          <Text style={styles.bonusDetail}>
            Итгэлтэй байж {outcome.overconfidentQuestionIds.length} асуултад
            алдлаа. Эдгээр давтах дараалалд эрт орно.
          </Text>
        </Card>
      )}

      {/* ─── Дараагийн зорилгоо ӨӨРӨӨ сонгох (Бүлэг 3.7) ─── */}
      {weakest && weakest.accuracy < 0.7 && (
        <Card style={{ marginTop: spacing.md, alignSelf: 'stretch' }}>
          <SectionTitle>Дараагийн зорилго</SectionTitle>
          <Text style={styles.hint}>
            «{weakest.eraName}» эринд арай сул байна. Дадлага хийх үү?
          </Text>
          <TouchableOpacity
            style={styles.goalBtn}
            accessibilityRole="button"
            accessibilityLabel={`${weakest.eraName} эринд дадлага хийх`}
            onPress={() =>
              navigation.replace('Quiz', { mode: 'free', eraId: weakest.eraId })
            }>
            <Text style={styles.goalBtnText}>
              📚 {weakest.eraName} дээр дадлагажих
            </Text>
          </TouchableOpacity>
        </Card>
      )}

      <View style={{ marginTop: spacing.lg, gap: spacing.sm, alignSelf: 'stretch' }}>
        <PrimaryButton title="Нүүр рүү буцах" onPress={() => navigation.popToTop()} />
      </View>
    </ScrollView>
  );
}

function tierColor(tier: RankTier): string {
  return (
    { bronze: colors.bronze, silver: colors.silver, gold: colors.gold, platinum: colors.platinum }[
      tier
    ] ?? colors.primary
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultCrestWrap: {
    marginBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultSeal: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  resultEmojiCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.bgCardLight,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 44 },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '900', fontFamily: fontFamily.display },
  scorePill: {
    backgroundColor: 'rgba(221, 176, 88, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(221, 176, 88, 0.35)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginTop: 2,
  },
  score: { color: colors.primaryLight, fontSize: fontSize.sm, fontWeight: '700' },
  banner: { alignSelf: 'stretch', marginTop: spacing.md, alignItems: 'center' },
  bannerText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '800',
    textAlign: 'center',
  },
  bonusDetail: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
    lineHeight: 19,
  },
  overconfidentTitle: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  eraRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  eraName: { color: colors.text, fontSize: fontSize.sm },
  eraStat: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '700' },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  goalBtn: {
    backgroundColor: colors.bgCardLight,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  goalBtnText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700' },
});
