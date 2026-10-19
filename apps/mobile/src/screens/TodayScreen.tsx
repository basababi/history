/**
 * Өнөөдөр — нүүр дэлгэц
 *
 * Нэг л гол асуулт: «Өнөөдрийн тавыг тоглосон уу?»
 *   • Тоглоогүй    → ганц том товч «Эхлэх»
 *   • Дундаа      → «Үргэлжлүүлэх»
 *   • Дууссан     → дүн + «Найзаа сорих» + дараагийн тав хүртэлх цаг
 *
 * Доор нь өрсөлдөгчид — «Бат өнөөдөр 4/5 авсан» нь эргэж ирэх шалтгаан.
 */
import React, { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDuration } from '@nomad/core';
import { ApiError } from '@/api/client';
import { Card, ErrorState, Loading, PrimaryButton, SectionTitle, StreakBadge } from '@/components/ui';
import { ScreenCanvas } from '@/components/ScreenCanvas';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon, type IconName } from '@/components/Icon';
import { FadeInUp } from '@/components/motion';
import { ScoreMarks } from '@/components/game/ScoreMarks';
import { ShareActions } from '@/components/game/ShareActions';
import { Chip, Countdown, PersonRow } from '@/components/game/bits';
import { useMe, useRivals, useToday } from '@/hooks/game';
import { formatDayLong, formatRecord } from '@/lib/format';
import type { TabScreenProps } from '@/navigation/routes';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

const HOW_IT_WORKS: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'bolt', title: 'Өдөр бүр ижил 5 асуулт', text: 'Монголын түүх, домог, зүйр үг. Асуулт бүрт 20 секунд.' },
  { icon: 'share', title: 'Найзаа сорь', text: 'Дүнгээ Messenger-ээр илгээ — найз чинь линкээр шууд тоглоно.' },
  { icon: 'flame', title: 'Цувралаа бүү тасла', text: 'Өдөр алгасахгүй тоглох тусам цол чинь ахина.' },
];

export default function TodayScreen({ navigation }: TabScreenProps<'Today'>) {
  const insets = useSafeAreaInsets();
  const today = useToday();
  const rivals = useRivals();
  const me = useMe();

  const refresh = useCallback(() => {
    void today.refetch();
    void rivals.refetch();
    void me.refetch();
  }, [today, rivals, me]);

  if (today.isLoading) {
    return (
      <View style={styles.center}>
        <Loading label="Өнөөдрийн тавыг бэлдэж байна…" />
      </View>
    );
  }

  if (today.error || !today.data) {
    const noQuestions = today.error instanceof ApiError && today.error.code === 'NO_QUESTIONS';
    return (
      <View style={styles.center}>
        <ErrorState
          icon={noQuestions ? 'clock' : 'offline'}
          title={noQuestions ? 'Асуулт бэлэн болоогүй байна' : 'Холбогдож чадсангүй'}
          message={today.error instanceof ApiError ? today.error.message : 'Интернэтээ шалгаад дахин оролдоно уу.'}
          actionLabel="Дахин оролдох"
          onAction={refresh}
        />
      </View>
    );
  }

  const t = today.data;
  const { play } = t;
  const firstTime = (me.data?.stats.plays ?? 0) === 0 && play.status === 'not_started';

  return (
    <ScreenCanvas spine="tenger">
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 56 }]}
        refreshControl={<RefreshControl refreshing={today.isRefetching} onRefresh={refresh} tintColor={colors.primary} />}>
        <ScreenHeader
          title="Өдрийн тав"
          subtitle={`#${t.dayNumber} · ${formatDayLong(t.dayKey)}`}
          right={me.data ? <StreakBadge days={me.data.streak.current} /> : undefined}
        />

        <FadeInUp>
          <Card feature style={styles.mainCard}>
            {play.status === 'not_started' && (
              <View style={styles.mainBody}>
                <Chip label={`ӨДРИЙН ТАВ #${t.dayNumber}`} tone="gold" icon="bolt" />
                <Text style={styles.bigTitle}>5 асуулт · 2 минут</Text>
                <Text style={styles.body}>
                  Өнөөдөр бүх хүнд ижил асуулт. Хамгийн олон зөв, хамгийн хурдан нь ялна.
                </Text>
                <ScoreMarks marks={[]} total={play.total} size={26} />
                <Text style={styles.social}>
                  {t.playersToday > 0 ? `Өнөөдөр ${t.playersToday} хүн тоглосон` : 'Өнөөдрийн анхны тоглогч болоорой'}
                </Text>
                <PrimaryButton title="Эхлэх" onPress={() => navigation.navigate('Play', { dayKey: t.dayKey })} />
              </View>
            )}

            {play.status === 'in_progress' && (
              <View style={styles.mainBody}>
                <Chip label="ДУНДАА БАЙНА" tone="teal" icon="clock" />
                <Text style={styles.bigTitle}>
                  {play.answered}/{play.total} хариулсан
                </Text>
                <ScoreMarks marks={play.marks} total={play.total} size={26} current={play.answered} />
                <Text style={styles.body}>Хуудсаа хаасан ч таймер хэвээр — үргэлжлүүлээд дуусга.</Text>
                <PrimaryButton title="Үргэлжлүүлэх" onPress={() => navigation.navigate('Play', { dayKey: t.dayKey })} />
              </View>
            )}

            {play.status === 'finished' && (
              <View style={styles.mainBody}>
                <Chip label="ӨНӨӨДРИЙН ДҮН" tone="gold" icon="check" />
                <View style={styles.scoreRow}>
                  <Text style={styles.score}>
                    {play.correct}
                    <Text style={styles.scoreTotal}>/{play.total}</Text>
                  </Text>
                  <View style={styles.scoreSide}>
                    <ScoreMarks marks={play.marks} total={play.total} size={22} />
                    <Text style={styles.time}>{formatDuration(play.totalMs)}</Text>
                  </View>
                </View>
                {play.shareCode ? (
                  <ShareActions
                    shareCode={play.shareCode}
                    dayNumber={t.dayNumber}
                    correct={play.correct}
                    total={play.total}
                    totalMs={play.totalMs}
                    marks={play.marks}
                    needsName={me.data ? me.data.displayName === null : true}
                  />
                ) : null}
                <PrimaryButton
                  title="Дүн, тайлбарыг харах"
                  variant="ghost"
                  onPress={() => navigation.navigate('Result', { dayKey: t.dayKey })}
                />
                <View style={styles.nextRow}>
                  <Icon name="clock" size={18} color={colors.textMuted} />
                  <Text style={styles.nextLabel}>Дараагийн тав</Text>
                  <Countdown ms={t.msUntilNext} onDone={refresh} />
                </View>
              </View>
            )}
          </Card>
        </FadeInUp>

        {firstTime && (
          <FadeInUp delay={80}>
            <Card>
              {HOW_IT_WORKS.map((s) => (
                <View key={s.title} style={styles.step}>
                  <View style={styles.stepIcon}>
                    <Icon name={s.icon} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.stepText}>
                    <Text style={styles.stepTitle}>{s.title}</Text>
                    <Text style={styles.stepBody}>{s.text}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </FadeInUp>
        )}

        <FadeInUp delay={120}>
          <View style={styles.section}>
            <SectionTitle>Өрсөлдөгчид</SectionTitle>
            {rivals.data && rivals.data.rivals.length > 0 ? (
              <Card>
                {rivals.data.rivals.map((r) => (
                  <PersonRow
                    key={r.userId}
                    name={r.displayName}
                    seed={r.userId}
                    subtitle={`${r.title} · тулаан ${formatRecord(r.record)}`}
                    right={
                      r.today.played && r.today.correct !== null ? (
                        <Chip label={`${r.today.correct}/${play.total}`} tone="gold" />
                      ) : (
                        <Text style={styles.waiting}>өнөөдөр тоглоогүй</Text>
                      )
                    }
                  />
                ))}
              </Card>
            ) : (
              <Card>
                <Text style={styles.emptyRivals}>
                  Дүнгээ найздаа илгээ. Найз чинь линкээр тоглоход энд өрсөлдөгч болж гарч ирнэ — өдөр бүр хэн нь
                  илүү мэддэгийг харна.
                </Text>
              </Card>
            )}
          </View>
        </FadeInUp>

        <FadeInUp delay={160}>
          <Card>
            <PersonRow
              name="Найзын бүлэг"
              seed={4}
              subtitle="Найзууд, ангиараа долоо хоног бүр өрсөл"
              onPress={() => navigation.navigate('Groups')}
            />
          </Card>
        </FadeInUp>
      </ScrollView>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.md },
  container: { paddingHorizontal: spacing.md + 26, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  mainCard: { marginTop: spacing.sm },
  mainBody: { gap: spacing.md },
  bigTitle: { fontFamily: fontFamily.display, color: colors.text, fontSize: fontSize.xl, lineHeight: fontSize.xl * 1.2 },
  body: { color: colors.textMuted, fontSize: fontSize.sm + 1, lineHeight: 21 },
  social: { color: colors.sky, fontSize: fontSize.sm, fontWeight: '700' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  score: { fontFamily: fontFamily.display, color: colors.primary, fontSize: 64, lineHeight: 70 },
  scoreTotal: { color: colors.textMuted, fontSize: 32 },
  scoreSide: { alignItems: 'flex-end', gap: spacing.sm },
  time: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center' },
  nextLabel: { color: colors.textMuted, fontSize: fontSize.sm },
  section: { gap: spacing.xs },
  waiting: { color: colors.textDim, fontSize: fontSize.xs + 1 },
  emptyRivals: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
  step: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm, alignItems: 'flex-start' },
  stepIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(221, 176, 88, 0.12)',
  },
  stepText: { flex: 1, gap: 2 },
  stepTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  stepBody: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 19 },
});
