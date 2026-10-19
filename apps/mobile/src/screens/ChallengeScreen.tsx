/**
 * Сорилт — `/c/:code` линкээр орж ирсэн найзын эхний дэлгэц
 *
 * «Бат чамайг сорьж байна · 4/5 · 38 сек — давж чадах уу?»
 *
 * Нэг товч, нэг алхам: бүртгэл, суулгалт, заавар ХЭРЭГГҮЙ. Тоглож
 * дууссаны дараа тулааны дүн энд гарч, «Буцааж сорих» боломжтой болно.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDuration } from '@nomad/core';
import { ApiError } from '@/api/client';
import { Card, EmptyState, ErrorState, Loading, PrimaryButton } from '@/components/ui';
import { ScreenCanvas } from '@/components/ScreenCanvas';
import { FadeInUp } from '@/components/motion';
import { ScoreMarks } from '@/components/game/ScoreMarks';
import { ShareActions } from '@/components/game/ShareActions';
import { Avatar, Chip } from '@/components/game/bits';
import { useChallenge, useMe } from '@/hooks/game';
import { formatDayLabel, formatRecord } from '@/lib/format';
import type { AppScreenProps } from '@/navigation/routes';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export default function ChallengeScreen({ navigation, route }: AppScreenProps<'Challenge'>) {
  const { code } = route.params;
  const insets = useSafeAreaInsets();
  const q = useChallenge(code);
  const me = useMe();

  if (q.isLoading) {
    return (
      <View style={styles.center}>
        <Loading label="Сорилтыг нээж байна…" />
      </View>
    );
  }

  if (q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 400)) {
    return (
      <View style={styles.center}>
        <EmptyState icon="link" title="Сорилт олдсонгүй" message="Линк буруу эсвэл хуучирсан байж магадгүй. Өнөөдрийн тавыг тоглоод өөрөө найзаа сорь.">
          <PrimaryButton title="Өнөөдрийн тав" onPress={() => navigation.navigate('Tabs', { screen: 'Today' })} />
        </EmptyState>
      </View>
    );
  }

  if (q.error || !q.data) {
    return (
      <View style={styles.center}>
        <ErrorState
          icon="offline"
          title="Холбогдож чадсангүй"
          message="Интернэтээ шалгаад дахин оролдоно уу."
          actionLabel="Дахин оролдох"
          onAction={() => void q.refetch()}
        />
      </View>
    );
  }

  const c = q.data;
  const viewer = c.viewer;
  const isOwner = viewer?.isOwner === true;
  const owner = c.owner;
  const result = c.ownerResult;

  return (
    <ScreenCanvas spine="mongol">
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 64 }]}>
        <FadeInUp>
          <View style={styles.hero}>
            <Avatar name={owner.displayName} seed={owner.displayName.length * 7} size={64} />
            <Text style={styles.kicker}>{isOwner ? 'ТАНЫ СОРИЛТ' : 'СОРИЛТ'}</Text>
            <Text style={styles.headline}>
              {isOwner ? 'Найздаа илгээгээрэй' : `${owner.displayName} чамайг сорьж байна`}
            </Text>
            {owner.title ? <Text style={styles.ownerTitle}>{owner.title}</Text> : null}
          </View>
        </FadeInUp>

        <FadeInUp delay={60}>
          <Card feature>
            <View style={styles.cardHead}>
              <Chip label={`ӨДРИЙН ТАВ #${c.dayNumber}`} tone="gold" icon="bolt" />
              <Text style={styles.date}>{c.isToday ? 'Өнөөдөр' : formatDayLabel(c.dayKey)}</Text>
            </View>
            <View style={styles.scoreRow}>
              <Text style={styles.score}>
                {result.correct}
                <Text style={styles.scoreTotal}>/{result.total}</Text>
              </Text>
              <View style={styles.scoreSide}>
                <ScoreMarks marks={result.marks} total={result.total} size={22} />
                <Text style={styles.time}>{formatDuration(result.totalMs)}</Text>
              </View>
            </View>
          </Card>
        </FadeInUp>

        <FadeInUp delay={110}>
          {isOwner ? (
            <Card>
              <ShareActions
                shareCode={c.code}
                dayNumber={c.dayNumber}
                correct={result.correct}
                total={result.total}
                totalMs={result.totalMs}
                marks={result.marks}
                needsName={me.data ? me.data.displayName === null : false}
                primaryLabel="Дахин илгээх"
              />
            </Card>
          ) : viewer?.status === 'finished' && viewer.duel ? (
            <Card accent={viewer.duel.outcome === 'win' ? colors.primary : viewer.duel.outcome === 'loss' ? colors.accent : colors.sky} glow>
              <Text style={styles.duelHeadline}>{viewer.duel.headline}</Text>
              <Text style={styles.body}>{viewer.duel.detail}</Text>
              {viewer.duel.record.days > 1 && (
                <Text style={styles.record}>Нийт тулаан {formatRecord(viewer.duel.record)}</Text>
              )}
              <View style={styles.actions}>
                <PrimaryButton title="Буцааж сорих" onPress={() => navigation.navigate('Result', { dayKey: c.dayKey })} />
                {!c.isToday && (
                  <PrimaryButton
                    title="Өнөөдрийн тав"
                    variant="ghost"
                    onPress={() => navigation.navigate('Tabs', { screen: 'Today' })}
                  />
                )}
              </View>
            </Card>
          ) : (
            <Card>
              <Text style={styles.body}>
                {c.isToday
                  ? 'Өнөөдрийн 5 асуулт — бүх хүнд ижил. Асуулт бүрт 20 секунд. Бүртгэл хэрэггүй.'
                  : `${formatDayLabel(c.dayKey)} · 5 асуулт. Өнөөдрийн тав тусдаа — дараа нь тоглож болно.`}
              </Text>
              <View style={styles.actions}>
                <PrimaryButton
                  title={viewer?.status === 'in_progress' ? 'Үргэлжлүүлэх' : 'Сорилтыг хүлээн авах'}
                  onPress={() => navigation.navigate('Play', { dayKey: c.dayKey, challengeCode: c.code })}
                />
              </View>
            </Card>
          )}
        </FadeInUp>

        <Text style={styles.footer}>Эртний Өв · Монголын түүх, домог, зүйр үг — өдөр бүр 5 асуулт</Text>
      </ScrollView>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.md },
  container: { paddingHorizontal: spacing.md + 26, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  kicker: { color: colors.sky, fontSize: fontSize.xs, fontWeight: '800', letterSpacing: 1.6, marginTop: spacing.sm },
  headline: { fontFamily: fontFamily.display, color: colors.text, fontSize: fontSize.xl, textAlign: 'center', lineHeight: fontSize.xl * 1.25 },
  ownerTitle: { color: colors.textMuted, fontSize: fontSize.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  date: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '700' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  score: { fontFamily: fontFamily.display, color: colors.primary, fontSize: 70, lineHeight: 76 },
  scoreTotal: { color: colors.textMuted, fontSize: 34 },
  scoreSide: { alignItems: 'flex-end', gap: spacing.sm },
  time: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  body: { color: colors.text, fontSize: fontSize.md, lineHeight: 22 },
  duelHeadline: { fontFamily: fontFamily.display, color: colors.text, fontSize: fontSize.xl, marginBottom: 4 },
  record: { color: colors.sky, fontSize: fontSize.sm, fontWeight: '700', marginTop: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  footer: { color: colors.textDim, fontSize: fontSize.xs + 1, textAlign: 'center', marginTop: spacing.md },
});
