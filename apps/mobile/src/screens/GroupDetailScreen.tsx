/**
 * Бүлгийн самбар — долоо хоногийн чансаа + өнөөдрийн дүн + урилга
 *
 * Тоглоогүй гишүүн ч жагсаалтад 0-ээр харагдана — өөрийгөө олж харахгүй
 * хүн дараагийн өдөр эргэж ирэхгүй.
 */
import React, { useState } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DAILY_QUESTION_COUNT } from '@nomad/core';
import { ApiError } from '@/api/client';
import { Card, EmptyState, ErrorState, Loading, PrimaryButton, SectionTitle } from '@/components/ui';
import { ScreenCanvas } from '@/components/ScreenCanvas';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FadeInUp } from '@/components/motion';
import { ScoreMarks } from '@/components/game/ScoreMarks';
import { FlashText, PersonRow, SmallButton, useFlash } from '@/components/game/bits';
import { useGroup, useLeaveGroup } from '@/hooks/game';
import { formatDayLabel } from '@/lib/format';
import { copyText, groupUrl, shareLink } from '@/lib/share';
import type { AppScreenProps } from '@/navigation/routes';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

function confirm(message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(message) : false);
  }
  return new Promise((resolve) =>
    Alert.alert('Бүлгээс гарах', message, [
      { text: 'Болих', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Гарах', style: 'destructive', onPress: () => resolve(true) },
    ])
  );
}

export default function GroupDetailScreen({ navigation, route }: AppScreenProps<'GroupDetail'>) {
  const id = Number(route.params.id);
  const insets = useSafeAreaInsets();
  const q = useGroup(id);
  const leave = useLeaveGroup();
  const [message, flash] = useFlash();
  const [busy, setBusy] = useState(false);

  if (q.isLoading) {
    return (
      <View style={styles.center}>
        <Loading />
      </View>
    );
  }

  if (q.error instanceof ApiError && q.error.status === 404) {
    return (
      <View style={styles.center}>
        <EmptyState icon="users" title="Бүлэг олдсонгүй" message="Та энэ бүлгийн гишүүн биш эсвэл бүлэг устсан байна.">
          <PrimaryButton title="Бүлгүүд рүү" onPress={() => navigation.navigate('Tabs', { screen: 'Groups' })} />
        </EmptyState>
      </View>
    );
  }

  if (q.error || !q.data) {
    return (
      <View style={styles.center}>
        <ErrorState icon="offline" title="Ачаалж чадсангүй" message="Дахин оролдоно уу." actionLabel="Дахин оролдох" onAction={() => void q.refetch()} />
      </View>
    );
  }

  const { group, members, weekStart } = q.data;
  const url = groupUrl(group.code);

  async function invite() {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await shareLink({
        title: `«${group.name}» бүлэг`,
        text: `«${group.name}» бүлэгт нэгдээрэй — өдөр бүр Монголын түүхийн 5 асуулт, долоо хоног бүр чансаа.`,
        url,
      });
      if (outcome === 'copied') flash('Урилгын линк хуулагдлаа');
      if (outcome === 'failed') flash('Хуваалцаж чадсангүй — кодыг хуулж илгээгээрэй');
    } finally {
      setBusy(false);
    }
  }

  async function leaveGroup() {
    const ok = await confirm(`«${group.name}» бүлгээс гарах уу? Дахин нэгдэхэд код хэрэгтэй.`);
    if (!ok) return;
    await leave.mutateAsync(group.id).catch(() => undefined);
    navigation.navigate('Tabs', { screen: 'Groups' });
  }

  return (
    <ScreenCanvas spine="ger">
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 56 }]}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} />}>
        <ScreenHeader
          title={group.name}
          subtitle={`${group.memberCount} гишүүн · долоо хоног: ${formatDayLabel(weekStart)} – өнөөдөр`}
        />

        <FadeInUp>
          <Card feature>
            <Text style={styles.label}>УРИЛГЫН КОД</Text>
            <Text style={styles.code} selectable>
              {group.code}
            </Text>
            <PrimaryButton title={busy ? 'Бэлдэж байна…' : 'Урилга илгээх'} onPress={() => void invite()} disabled={busy} />
            <View style={styles.row}>
              <SmallButton
                label="Код хуулах"
                icon="copy"
                style={styles.flex}
                onPress={() => void copyText(group.code).then((ok) => flash(ok ? 'Код хуулагдлаа' : 'Хуулж чадсангүй'))}
              />
              <SmallButton
                label="Линк хуулах"
                icon="link"
                style={styles.flex}
                onPress={() => void copyText(url).then((ok) => flash(ok ? 'Линк хуулагдлаа' : 'Хуулж чадсангүй'))}
              />
            </View>
            <FlashText message={message} />
          </Card>
        </FadeInUp>

        <FadeInUp delay={60}>
          <View style={styles.section}>
            <SectionTitle>Долоо хоногийн чансаа</SectionTitle>
            <Card>
              {members.map((m) => (
                <PersonRow
                  key={m.userId}
                  name={m.isMe ? `${m.displayName} (чи)` : m.displayName}
                  seed={m.userId}
                  highlight={m.isMe}
                  subtitle={`${m.title} · ${m.daysPlayed}/7 өдөр`}
                  left={<Text style={[styles.rank, m.rank <= 3 && styles.rankTop]}>{m.rank}</Text>}
                  right={
                    <View style={styles.right}>
                      <Text style={styles.week}>{m.weekCorrect}</Text>
                      {m.today.played ? (
                        <ScoreMarks marks={m.today.marks} total={DAILY_QUESTION_COUNT} size={9} />
                      ) : (
                        <Text style={styles.notToday}>өнөөдөр —</Text>
                      )}
                    </View>
                  }
                />
              ))}
            </Card>
            <Text style={styles.hint}>Тоо нь энэ долоо хоногийн нийт зөв хариулт. Тэнцвэл олон өдөр тоглосон нь дээр.</Text>
          </View>
        </FadeInUp>

        <PrimaryButton title="Бүлгээс гарах" variant="ghost" onPress={() => void leaveGroup()} />
      </ScrollView>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.md },
  container: { paddingHorizontal: spacing.md + 26, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  label: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '800', letterSpacing: 1.2 },
  code: {
    fontFamily: fontFamily.display,
    color: colors.primary,
    fontSize: 40,
    letterSpacing: 8,
    textAlign: 'center',
    marginVertical: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bgSunken,
  },
  section: { gap: spacing.xs },
  rank: { width: 22, textAlign: 'center', color: colors.textMuted, fontFamily: fontFamily.display, fontSize: fontSize.md },
  rankTop: { color: colors.primary },
  right: { alignItems: 'flex-end', gap: 4 },
  week: { color: colors.text, fontFamily: fontFamily.display, fontSize: fontSize.lg },
  notToday: { color: colors.textDim, fontSize: fontSize.xs },
  hint: { color: colors.textDim, fontSize: fontSize.xs + 1, lineHeight: 17, paddingHorizontal: spacing.xs },
});
