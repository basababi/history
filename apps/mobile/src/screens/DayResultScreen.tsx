/**
 * Дүн — оноо, тулаан, хуваалцах
 *
 * Энэ дэлгэцэд хэрэглэгч «найздаа илгээх үү?» гэж шийднэ. Тиймээс:
 *   1. Оноо том, ойлгомжтой (■■□■■ 4/5 · 38 сек)
 *   2. Сорьсон найзтай харьцуулалт — «Чи Батаас 1 оноогоор түрүүллээ»
 *   3. «Найзаа сорих» — дэлгэцийн хамгийн тод товч
 *   4. Асуулт тус бүр: хэдэн хувь нь зөв хариулсан — өөрийгөө хэмжих
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDuration, msUntilNextDay } from '@nomad/core';
import type { DuelSummary } from '@nomad/contracts';
import { ApiError } from '@/api/client';
import { Card, ErrorState, Loading, PrimaryButton, SectionTitle } from '@/components/ui';
import { ScreenCanvas } from '@/components/ScreenCanvas';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon } from '@/components/Icon';
import { FadeInUp } from '@/components/motion';
import { ScoreMarks } from '@/components/game/ScoreMarks';
import { ShareActions } from '@/components/game/ShareActions';
import { Chip, Countdown, PersonRow } from '@/components/game/bits';
import { useDayResult } from '@/hooks/game';
import { formatDayLong, formatPercent, formatRank, formatRecord, formatSeconds } from '@/lib/format';
import type { AppScreenProps } from '@/navigation/routes';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

function outcomeColor(outcome: DuelSummary['outcome']): string {
  return outcome === 'win' ? colors.primary : outcome === 'loss' ? colors.accent : colors.sky;
}

function DuelCard({ duel, title }: { duel: DuelSummary; title: string }) {
  const tint = outcomeColor(duel.outcome);
  return (
    <Card accent={tint} glow>
      <Text style={styles.cardLabel}>{title}</Text>
      <Text style={[styles.duelHeadline, { color: tint }]}>{duel.headline}</Text>
      <Text style={styles.duelDetail}>{duel.detail}</Text>
      <View style={styles.duelRow}>
        <View style={styles.duelSide}>
          <Text style={styles.duelName} numberOfLines={1}>
            {duel.opponent.displayName}
          </Text>
          <Text style={styles.duelMeta}>
            {duel.opponent.correct}/{duel.opponent.total} · {formatDuration(duel.opponent.totalMs)}
          </Text>
        </View>
        <ScoreMarks marks={duel.opponent.marks} total={duel.opponent.total} size={16} />
      </View>
      {duel.record.days > 1 && (
        <Text style={styles.recordText}>
          Нийт тулаан {formatRecord(duel.record)} · {duel.record.days} өдөр
        </Text>
      )}
    </Card>
  );
}

export default function DayResultScreen({ navigation, route }: AppScreenProps<'Result'>) {
  const { dayKey } = route.params;
  const insets = useSafeAreaInsets();
  const q = useDayResult(dayKey);

  if (q.isLoading) {
    return (
      <View style={styles.center}>
        <Loading label="Дүнг тооцоолж байна…" />
      </View>
    );
  }

  if (q.error instanceof ApiError && q.error.code === 'NOT_FINISHED') {
    return (
      <View style={styles.center}>
        <ErrorState
          icon="clock"
          title="Энэ өдрийг дуусгаагүй байна"
          message="Таван асуултаа дуусгасны дараа дүн, тайлбар энд гарна."
          actionLabel="Тоглох"
          onAction={() => navigation.replace('Play', { dayKey })}
        />
      </View>
    );
  }

  if (q.error || !q.data) {
    return (
      <View style={styles.center}>
        <ErrorState
          icon="offline"
          title="Дүнг ачаалж чадсангүй"
          message={q.error instanceof ApiError ? q.error.message : 'Интернэтээ шалгаад дахин оролдоно уу.'}
          actionLabel="Дахин оролдох"
          onAction={() => void q.refetch()}
        />
      </View>
    );
  }

  const r = q.data;
  const perfect = r.correct === r.total;

  return (
    <ScreenCanvas spine="history">
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 56 }]}>
        <ScreenHeader title={`Өдрийн тав #${r.dayNumber}`} subtitle={formatDayLong(r.dayKey)} />

        {r.titleUp && (
          <FadeInUp>
            <Card accent={colors.primary} glow>
              <View style={styles.titleUp}>
                <Icon name="crown" size={30} color={colors.primary} />
                <View style={styles.flex}>
                  <Text style={styles.cardLabel}>ШИНЭ ЦОЛ</Text>
                  <Text style={styles.titleUpText}>{r.titleUp}</Text>
                  <Text style={styles.small}>Их Монгол Улсын аравтын зохион байгуулалтаар</Text>
                </View>
              </View>
            </Card>
          </FadeInUp>
        )}

        <FadeInUp delay={40}>
          <Card feature>
            <View style={styles.scoreHead}>
              <Text style={styles.score}>
                {r.correct}
                <Text style={styles.scoreTotal}>/{r.total}</Text>
              </Text>
              <View style={styles.scoreSide}>
                <Text style={styles.time}>{formatDuration(r.totalMs)}</Text>
                <Chip label={formatRank(r.rank.position, r.rank.players)} tone="teal" />
              </View>
            </View>
            <ScoreMarks marks={r.marks} total={r.total} size={34} />
            <Text style={styles.verdict}>
              {perfect
                ? 'Бүгдийг зөв! Түмэн цэргийн жанжин шиг.'
                : r.correct >= r.total - 1
                  ? 'Бараг төгс. Маргааш бүгдийг нь ав.'
                  : r.correct >= 2
                    ? 'Сайн эхлэл. Тайлбаруудыг уншаад маргааш дахин.'
                    : 'Түүх өдөр бүр сурагдана. Маргааш шинэ тав.'}
            </Text>
            <View style={styles.metaRow}>
              <Chip label={`Цуврал ${r.streak.current}`} tone="gold" icon="flame" />
              <Chip label={r.title.label} icon="crown" />
            </View>
          </Card>
        </FadeInUp>

        {r.duel && (
          <FadeInUp delay={80}>
            <DuelCard duel={r.duel} title="ЧАМАЙГ СОРЬСОН" />
          </FadeInUp>
        )}

        <FadeInUp delay={110}>
          <Card>
            <Text style={styles.cardLabel}>{r.duel ? 'БУЦААЖ СОРИХ' : 'НАЙЗАА СОРИХ'}</Text>
            <Text style={styles.shareHint}>
              Найз чинь яг ижил 5 асуултыг тоглоно. Линкээр орж ирээд шууд эхэлнэ — бүртгэл хэрэггүй.
            </Text>
            <ShareActions
              shareCode={r.shareCode}
              dayNumber={r.dayNumber}
              correct={r.correct}
              total={r.total}
              totalMs={r.totalMs}
              marks={r.marks}
              needsName={r.needsName}
              primaryLabel={r.duel ? 'Буцааж сорих' : 'Найзаа сорих'}
            />
          </Card>
        </FadeInUp>

        {r.rivals.length > 0 && (
          <FadeInUp delay={140}>
            <View style={styles.section}>
              <SectionTitle>Өрсөлдөгчид энэ өдөр</SectionTitle>
              <Card>
                {r.rivals.map((d) => (
                  <PersonRow
                    key={d.opponent.userId}
                    name={d.opponent.displayName}
                    seed={d.opponent.userId}
                    subtitle={d.detail}
                    right={<Chip label={`${d.opponent.correct}/${d.opponent.total}`} tone={d.outcome === 'win' ? 'gold' : d.outcome === 'loss' ? 'coral' : 'teal'} />}
                  />
                ))}
              </Card>
            </View>
          </FadeInUp>
        )}

        <FadeInUp delay={170}>
          <View style={styles.section}>
            <SectionTitle>Асуулт бүрээр</SectionTitle>
            <Card>
              {r.perQuestion.map((p) => (
                <View key={p.position} style={styles.qRow}>
                  <Icon
                    name={p.isCorrect ? 'check' : p.timedOut ? 'clock' : 'cross'}
                    size={20}
                    color={p.isCorrect ? colors.success : p.timedOut ? colors.warning : colors.error}
                    strokeWidth={2.3}
                  />
                  <Text style={styles.qLabel}>{p.position + 1}-р асуулт</Text>
                  <Text style={styles.qMeta}>
                    {p.timedOut ? 'хугацаа дууссан' : formatSeconds(p.responseMs)}
                    {p.correctRate !== null ? ` · ${formatPercent(p.correctRate)} зөв` : ''}
                  </Text>
                </View>
              ))}
            </Card>
          </View>
        </FadeInUp>

        {r.isToday && (
          <View style={styles.nextRow}>
            <Icon name="clock" size={18} color={colors.textMuted} />
            <Text style={styles.small}>Дараагийн тав</Text>
            <Countdown ms={msUntilNextDay()} />
          </View>
        )}

        <PrimaryButton title="Нүүр рүү" variant="ghost" onPress={() => navigation.navigate('Tabs', { screen: 'Today' })} />
      </ScrollView>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.md },
  container: { paddingHorizontal: spacing.md + 26, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  cardLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  small: { color: colors.textMuted, fontSize: fontSize.sm - 1 },
  titleUp: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titleUpText: { fontFamily: fontFamily.display, color: colors.primary, fontSize: fontSize.xl },

  scoreHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  score: { fontFamily: fontFamily.display, color: colors.primary, fontSize: 76, lineHeight: 82 },
  scoreTotal: { color: colors.textMuted, fontSize: 36 },
  scoreSide: { alignItems: 'flex-end', gap: spacing.sm },
  time: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  verdict: { color: colors.text, fontSize: fontSize.md, lineHeight: 22, marginTop: spacing.md },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },

  duelHeadline: { fontFamily: fontFamily.display, fontSize: fontSize.xl },
  duelDetail: { color: colors.text, fontSize: fontSize.md, lineHeight: 22, marginTop: 4 },
  duelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, gap: spacing.md },
  duelSide: { flex: 1 },
  duelName: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  duelMeta: { color: colors.textMuted, fontSize: fontSize.sm },
  recordText: { color: colors.sky, fontSize: fontSize.sm, fontWeight: '700', marginTop: spacing.sm },

  shareHint: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 19, marginBottom: spacing.md },
  section: { gap: spacing.xs },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  qLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  qMeta: { marginLeft: 'auto', color: colors.textMuted, fontSize: fontSize.sm },
  nextRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
});
