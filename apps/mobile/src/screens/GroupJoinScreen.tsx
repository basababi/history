/**
 * Бүлгийн урилга — `/g/:code` линкээр орж ирсэн хүн
 *
 * «ШУТИС 3-р курс · 12 гишүүн — нэгдэх үү?» Нэг товч. Нэргүй зочин бол
 * эхлээд нэрээ тавина (гишүүд нэрээр нь таньна).
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/api/client';
import { Card, EmptyState, ErrorState, Loading, PrimaryButton } from '@/components/ui';
import { ScreenCanvas } from '@/components/ScreenCanvas';
import { Icon } from '@/components/Icon';
import { FadeInUp } from '@/components/motion';
import { NameSheet } from '@/components/game/NameSheet';
import { useGroupAction, useGroupPreview, useMe } from '@/hooks/game';
import type { AppScreenProps } from '@/navigation/routes';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export default function GroupJoinScreen({ navigation, route }: AppScreenProps<'GroupJoin'>) {
  const { code } = route.params;
  const preview = useGroupPreview(code);
  const me = useMe();
  const action = useGroupAction();
  const [askName, setAskName] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** `named` — нэр дөнгөж хадгалсан (кэш хараахан шинэчлэгдээгүй байж болно) */
  async function join(named = false) {
    setError(null);
    if (!named && me.data?.displayName === null) {
      setAskName(true);
      return;
    }
    try {
      const res = await action.mutateAsync({ action: 'join', code });
      navigation.replace('GroupDetail', { id: res.group.id });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NAME_REQUIRED') {
        setAskName(true);
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Нэгдэж чадсангүй. Дахин оролдоно уу.');
    }
  }

  if (preview.isLoading) {
    return (
      <View style={styles.center}>
        <Loading />
      </View>
    );
  }

  if (preview.error instanceof ApiError && (preview.error.status === 404 || preview.error.status === 400)) {
    return (
      <View style={styles.center}>
        <EmptyState icon="users" title="Урилга олдсонгүй" message="Код буруу эсвэл бүлэг устсан байна. Бүлгийн гишүүнээсээ шинэ линк асуугаарай.">
          <PrimaryButton title="Өнөөдрийн тав" onPress={() => navigation.navigate('Tabs', { screen: 'Today' })} />
        </EmptyState>
      </View>
    );
  }

  if (preview.error || !preview.data) {
    return (
      <View style={styles.center}>
        <ErrorState icon="offline" title="Холбогдож чадсангүй" message="Дахин оролдоно уу." actionLabel="Дахин оролдох" onAction={() => void preview.refetch()} />
      </View>
    );
  }

  const g = preview.data;

  return (
    <ScreenCanvas spine="ger">
      <View style={styles.wrap}>
        <FadeInUp>
          <Card feature>
            <View style={styles.head}>
              <Icon name="users" size={44} color={colors.primary} />
              <Text style={styles.kicker}>НАЙЗЫН БҮЛГИЙН УРИЛГА</Text>
              <Text style={styles.name}>{g.name}</Text>
              <Text style={styles.meta}>{g.memberCount} гишүүн · өдөр бүр 5 асуулт · долоо хоног бүр чансаа</Text>
            </View>

            {g.isMember && g.groupId !== null ? (
              <PrimaryButton title="Бүлэг рүү очих" onPress={() => navigation.replace('GroupDetail', { id: g.groupId as number })} />
            ) : g.full ? (
              <Text style={styles.error}>Энэ бүлэг дүүрсэн байна.</Text>
            ) : (
              <PrimaryButton title={action.isPending ? 'Нэгдэж байна…' : 'Бүлэгт нэгдэх'} onPress={() => void join()} disabled={action.isPending} />
            )}
            {error && <Text style={styles.error}>{error}</Text>}
          </Card>
        </FadeInUp>
        <PrimaryButton title="Өнөөдрийн тав руу" variant="ghost" onPress={() => navigation.navigate('Tabs', { screen: 'Today' })} />
      </View>

      <NameSheet
        visible={askName}
        reason="Бүлгийн гишүүд чамайг нэрээр чинь таньна."
        onClose={() => setAskName(false)}
        onSaved={() => {
          setAskName(false);
          void join(true);
        }}
      />
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.md },
  wrap: { flex: 1, justifyContent: 'center', padding: spacing.md + 26, gap: spacing.md, maxWidth: 560, width: '100%', alignSelf: 'center' },
  head: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  kicker: { color: colors.sky, fontSize: fontSize.xs, fontWeight: '800', letterSpacing: 1.6, marginTop: spacing.sm },
  name: { fontFamily: fontFamily.display, color: colors.text, fontSize: fontSize.xxl, textAlign: 'center', lineHeight: fontSize.xxl * 1.2 },
  meta: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', lineHeight: 19 },
  error: { color: colors.error, fontSize: fontSize.sm, fontWeight: '600', textAlign: 'center', marginTop: spacing.sm },
});
