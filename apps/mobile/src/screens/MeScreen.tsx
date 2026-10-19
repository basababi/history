/**
 * Би — нэр, цол, цуврал, түүх, бүртгэлийн сэргээх код
 *
 * Сэргээх код = нууц үг. Хөтчийн өгөгдөл цэвэрлэгдэх, утас солих үед
 * цувралаа алдахгүй байх ЦОРЫН ГАНЦ арга тул тодорхой тайлбартай байна.
 */
import React, { useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { formatDuration, formatRecoveryCode, isValidRecoveryCode, normalizeRecoveryCode } from '@nomad/core';
import { ApiError, configureApi } from '@/api/client';
import { restoreSession } from '@/api/game';
import { Card, ErrorState, Loading, PrimaryButton, ProgressBar, SectionTitle } from '@/components/ui';
import { ScreenCanvas } from '@/components/ScreenCanvas';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon, type IconName } from '@/components/Icon';
import { FadeInUp } from '@/components/motion';
import { NameSheet } from '@/components/game/NameSheet';
import { FlashText, PersonRow, SmallButton, useFlash } from '@/components/game/bits';
import { useMe } from '@/hooks/game';
import { formatDayLabel } from '@/lib/format';
import { copyText } from '@/lib/share';
import type { TabScreenProps } from '@/navigation/routes';
import { useSession } from '@/store/session';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

function Stat({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={20} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function MeScreen({ navigation }: TabScreenProps<'Me'>) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const me = useMe();
  const recoveryCode = useSession((s) => s.recoveryCode);
  const haptics = useSession((s) => s.hapticsEnabled);
  const setHaptics = useSession((s) => s.setHapticsEnabled);
  const switchAccount = useSession((s) => s.switchAccount);

  const [editing, setEditing] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreInput, setRestoreInput] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [message, flash] = useFlash();

  async function restore() {
    const code = normalizeRecoveryCode(restoreInput);
    if (!isValidRecoveryCode(code)) {
      setRestoreError('Код 25 тэмдэгт байх ёстой (I, O, 0, 1 ордоггүй).');
      return;
    }
    setRestoring(true);
    setRestoreError(null);
    try {
      const res = await restoreSession(code);
      configureApi({ token: res.token });
      switchAccount({ token: res.token, userId: res.userId, recoveryCode: code });
      qc.clear();
      setRestoreOpen(false);
      setRestoreInput('');
      flash('Бүртгэл сэргээгдлээ');
    } catch (err) {
      setRestoreError(err instanceof ApiError ? err.message : 'Сэргээж чадсангүй. Дахин оролдоно уу.');
    } finally {
      setRestoring(false);
    }
  }

  if (me.isLoading) {
    return (
      <View style={styles.center}>
        <Loading />
      </View>
    );
  }

  if (me.error || !me.data) {
    return (
      <View style={styles.center}>
        <ErrorState icon="offline" title="Ачаалж чадсангүй" message="Дахин оролдоно уу." actionLabel="Дахин оролдох" onAction={() => void me.refetch()} />
      </View>
    );
  }

  const m = me.data;
  const name = m.displayName ?? 'Зочин';

  return (
    <ScreenCanvas spine="hero">
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 56 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={me.isRefetching} onRefresh={() => void me.refetch()} tintColor={colors.primary} />}>
        <ScreenHeader
          title={name}
          subtitle={m.title.label}
          right={<SmallButton label={m.displayName ? 'Засах' : 'Нэр тавих'} icon="edit" onPress={() => setEditing(true)} />}
        />

        <FadeInUp>
          <Card feature>
            <View style={styles.titleRow}>
              <Icon name="crown" size={28} color={colors.primary} />
              <View style={styles.flex}>
                <Text style={styles.titleLabel}>{m.title.label}</Text>
                <Text style={styles.small}>
                  {m.title.nextLabel
                    ? `${m.title.nextLabel} хүртэл ${m.title.remaining} зөв хариулт`
                    : 'Хамгийн дээд цол — Түмэний ноён!'}
                </Text>
              </View>
            </View>
            <View style={styles.progress}>
              <ProgressBar progress={m.title.progress} />
            </View>
            <Text style={styles.hint}>Цол нь Их Монгол Улсын аравтын зохион байгуулалтаар: аравт → зуут → мянгат → түмэн.</Text>
          </Card>
        </FadeInUp>

        <FadeInUp delay={50}>
          <Card>
            <View style={styles.stats}>
              <Stat icon="flame" value={String(m.streak.current)} label="цуврал" />
              <Stat icon="star" value={String(m.streak.best)} label="дээд амжилт" />
              <Stat icon="check" value={String(m.stats.plays)} label="тоглосон өдөр" />
              <Stat icon="crown" value={String(m.stats.perfectDays)} label="бүрэн оноо" />
            </View>
            <Text style={styles.avg}>Дундаж: {m.stats.averageCorrect} зөв · нийт {m.stats.totalCorrect} зөв хариулт</Text>
          </Card>
        </FadeInUp>

        <FadeInUp delay={90}>
          <View style={styles.section}>
            <SectionTitle>Түүх</SectionTitle>
            <Card>
              {m.history.length === 0 ? (
                <Text style={styles.small}>Энд таны өдөр бүрийн дүн хадгалагдана.</Text>
              ) : (
                m.history.map((h) => (
                  <PersonRow
                    key={h.dayKey}
                    name={`#${h.dayNumber} · ${formatDayLabel(h.dayKey)}`}
                    seed={h.dayNumber}
                    subtitle={formatDuration(h.totalMs)}
                    right={<Text style={[styles.histScore, h.correct === h.total && { color: colors.primary }]}>{h.correct}/{h.total}</Text>}
                    onPress={() => navigation.navigate('Result', { dayKey: h.dayKey })}
                  />
                ))
              )}
            </Card>
          </View>
        </FadeInUp>

        <FadeInUp delay={120}>
          <Card accent={colors.sky}>
            <View style={styles.titleRow}>
              <Icon name="key" size={24} color={colors.sky} />
              <Text style={styles.cardTitle}>Сэргээх код</Text>
            </View>
            <Text style={styles.body}>
              Утас солих, хөтчөө цэвэрлэхэд цувралаа сэргээх ЦОРЫН ГАНЦ арга. Хэнд ч бүү үзүүл — кодтой хүн таны бүртгэлд орно.
            </Text>
            {recoveryCode ? (
              <>
                <Text style={styles.code} selectable>
                  {showCode ? formatRecoveryCode(recoveryCode) : '•••••-•••••-•••••-•••••-•••••'}
                </Text>
                <View style={styles.row}>
                  <SmallButton label={showCode ? 'Нуух' : 'Харуулах'} onPress={() => setShowCode((v) => !v)} style={styles.flex} />
                  <SmallButton
                    label="Хуулах"
                    icon="copy"
                    style={styles.flex}
                    onPress={() =>
                      void copyText(formatRecoveryCode(recoveryCode)).then((ok) => flash(ok ? 'Код хуулагдлаа — аюулгүй газар хадгал' : 'Хуулж чадсангүй'))
                    }
                  />
                </View>
              </>
            ) : (
              <Text style={styles.small}>Энэ төхөөрөмж дээр код хадгалагдаагүй байна.</Text>
            )}

            {!restoreOpen ? (
              <PrimaryButton title="Өөр төхөөрөмжийн кодоор нэвтрэх" variant="ghost" onPress={() => setRestoreOpen(true)} />
            ) : (
              <View style={styles.restore}>
                <TextInput
                  value={restoreInput}
                  onChangeText={setRestoreInput}
                  placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                  placeholderTextColor={colors.textDim}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={styles.input}
                  accessibilityLabel="Сэргээх код"
                />
                <Text style={styles.hint}>
                  Анхаар: одоогийн бүртгэлийн кодоо хадгалаагүй бол түүн рүү буцаж орох боломжгүй болно.
                </Text>
                {restoreError && <Text style={styles.error}>{restoreError}</Text>}
                <PrimaryButton title={restoring ? 'Шалгаж байна…' : 'Нэвтрэх'} onPress={() => void restore()} disabled={restoring} />
                <PrimaryButton title="Болих" variant="ghost" onPress={() => setRestoreOpen(false)} />
              </View>
            )}
            <FlashText message={message} />
          </Card>
        </FadeInUp>

        {Platform.OS !== 'web' && (
          <Card>
            <View style={styles.switchRow}>
              <Text style={styles.body}>Чичиргээ</Text>
              <Switch value={haptics} onValueChange={setHaptics} trackColor={{ true: colors.primaryDark, false: colors.border }} thumbColor={colors.text} />
            </View>
          </Card>
        )}

        <Text style={styles.about}>
          Асуулт бүр эх сурвалжтай. Алдаа олвол асуултын доорх «алдаа байна уу?»-г дарна уу — түүхч шалгана.
        </Text>
      </ScrollView>

      <NameSheet
        visible={editing}
        initial={m.displayName}
        reason="Найзууд, бүлгийн гишүүдэд энэ нэрээр харагдана."
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          flash('Нэр хадгалагдлаа');
        }}
      />
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.md },
  container: { paddingHorizontal: spacing.md + 26, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.sm },
  section: { gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titleLabel: { fontFamily: fontFamily.display, color: colors.primary, fontSize: fontSize.xl },
  cardTitle: { fontFamily: fontFamily.display, color: colors.text, fontSize: fontSize.lg },
  progress: { marginTop: spacing.md },
  small: { color: colors.textMuted, fontSize: fontSize.sm },
  hint: { color: colors.textDim, fontSize: fontSize.xs + 1, lineHeight: 17, marginTop: spacing.sm },
  body: { color: colors.text, fontSize: fontSize.sm + 1, lineHeight: 20, marginTop: spacing.sm },
  stats: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: spacing.md },
  stat: { alignItems: 'center', minWidth: '22%', gap: 2 },
  statValue: { fontFamily: fontFamily.display, color: colors.text, fontSize: fontSize.xl },
  statLabel: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center' },
  avg: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.md },
  histScore: { color: colors.text, fontFamily: fontFamily.display, fontSize: fontSize.md },
  code: {
    fontFamily: Platform.select({ web: 'ui-monospace, Menlo, Consolas, monospace', ios: 'Menlo', default: 'monospace' }),
    color: colors.sky,
    fontSize: fontSize.md,
    letterSpacing: 1,
    textAlign: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgSunken,
  },
  restore: { gap: spacing.sm, marginTop: spacing.md },
  input: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    color: colors.text,
    fontSize: fontSize.md,
    backgroundColor: colors.bgSunken,
    letterSpacing: 1,
  },
  error: { color: colors.error, fontSize: fontSize.sm, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  about: { color: colors.textDim, fontSize: fontSize.xs + 1, lineHeight: 17, textAlign: 'center', paddingHorizontal: spacing.md },
});
