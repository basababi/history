/**
 * Найзын бүлэг — найзууд, анги, гэр бүл, клуб
 *
 * Бүлгийн гишүүд өдөр бүр ижил тавыг тоглоод долоо хоногоор жагсана.
 * Урилгын линкээр (`/g/КОД`) эсвэл 6 тэмдэгтийн кодоор нэгдэнэ.
 */
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GROUP_CODE_LENGTH, GROUP_NAME_MAX, normalizeGroupCode } from '@nomad/core';
import type { GroupAction } from '@nomad/contracts';
import { ApiError } from '@/api/client';
import { Card, EmptyState, ErrorState, Loading, PrimaryButton, SectionTitle } from '@/components/ui';
import { ScreenCanvas } from '@/components/ScreenCanvas';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FadeInUp } from '@/components/motion';
import { NameSheet } from '@/components/game/NameSheet';
import { Chip, PersonRow } from '@/components/game/bits';
import { useGroupAction, useGroups, useMe } from '@/hooks/game';
import type { TabScreenProps } from '@/navigation/routes';
import { colors, fontSize, radius, spacing } from '@/theme';

export default function GroupsScreen({ navigation }: TabScreenProps<'Groups'>) {
  const insets = useSafeAreaInsets();
  const groups = useGroups();
  const me = useMe();
  const action = useGroupAction();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<GroupAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** `named` — нэр дөнгөж хадгалсан (кэш хараахан шинэчлэгдээгүй байж болно) */
  async function run(a: GroupAction, named = false) {
    setError(null);
    if (!named && me.data && me.data.displayName === null) {
      setPending(a);
      return;
    }
    try {
      const res = await action.mutateAsync(a);
      setName('');
      setCode('');
      navigation.navigate('GroupDetail', { id: res.group.id });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NAME_REQUIRED') {
        setPending(a);
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Алдаа гарлаа. Дахин оролдоно уу.');
    }
  }

  if (groups.isLoading) {
    return (
      <View style={styles.center}>
        <Loading />
      </View>
    );
  }

  if (groups.error || !groups.data) {
    return (
      <View style={styles.center}>
        <ErrorState
          icon="offline"
          title="Ачаалж чадсангүй"
          message="Интернэтээ шалгаад дахин оролдоно уу."
          actionLabel="Дахин оролдох"
          onAction={() => void groups.refetch()}
        />
      </View>
    );
  }

  const list = groups.data.groups;
  const atLimit = list.length >= groups.data.maxGroups;
  const codeReady = normalizeGroupCode(code).length === GROUP_CODE_LENGTH;

  return (
    <ScreenCanvas spine="ger">
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 56 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={groups.isRefetching} onRefresh={() => void groups.refetch()} tintColor={colors.primary} />}>
        <ScreenHeader title="Найзын бүлэг" subtitle="Найзууд, анги, гэр бүлээрээ долоо хоног бүр хэн нь илүү мэддэгийг харьцуул." />

        {list.length === 0 ? (
          <FadeInUp>
            <Card>
              <EmptyState
                icon="users"
                title="Бүлэг хараахан алга"
                message="Бүлэг үүсгээд урилгын линкээ Messenger группдээ илгээ — найзууд чинь нэг товчоор нэгдэнэ."
              />
            </Card>
          </FadeInUp>
        ) : (
          <FadeInUp>
            <View style={styles.section}>
              <SectionTitle>Миний бүлгүүд</SectionTitle>
              <Card>
                {list.map((g) => (
                  <PersonRow
                    key={g.id}
                    name={g.name}
                    seed={g.id}
                    subtitle={`${g.memberCount} гишүүн · байр ${g.myRank}/${g.memberCount}`}
                    right={<Chip label={`өнөөдөр ${g.playedToday}/${g.memberCount}`} tone={g.playedToday > 0 ? 'teal' : 'muted'} />}
                    onPress={() => navigation.navigate('GroupDetail', { id: g.id })}
                  />
                ))}
              </Card>
            </View>
          </FadeInUp>
        )}

        <FadeInUp delay={60}>
          <Card>
            <Text style={styles.label}>ШИНЭ БҮЛЭГ</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Жишээ нь: ШУТИС 3-р курс"
              placeholderTextColor={colors.textDim}
              maxLength={GROUP_NAME_MAX}
              style={styles.input}
              accessibilityLabel="Бүлгийн нэр"
              editable={!atLimit}
            />
            <PrimaryButton
              title={action.isPending ? 'Үүсгэж байна…' : 'Бүлэг үүсгэх'}
              disabled={atLimit || action.isPending || name.trim().length < 2}
              onPress={() => void run({ action: 'create', name })}
            />
          </Card>
        </FadeInUp>

        <FadeInUp delay={100}>
          <Card>
            <Text style={styles.label}>КОДООР НЭГДЭХ</Text>
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="ABC234"
              placeholderTextColor={colors.textDim}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={GROUP_CODE_LENGTH + 2}
              style={[styles.input, styles.codeInput]}
              accessibilityLabel="Бүлгийн код"
            />
            <PrimaryButton
              title="Нэгдэх"
              variant="ghost"
              disabled={!codeReady || action.isPending}
              onPress={() => void run({ action: 'join', code })}
            />
          </Card>
        </FadeInUp>

        {atLimit && <Text style={styles.note}>Хамгийн ихдээ {groups.data.maxGroups} бүлэгт байж болно.</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <NameSheet
        visible={pending !== null}
        reason="Бүлгийн гишүүд чамайг нэрээр чинь таньна."
        onClose={() => setPending(null)}
        onSaved={() => {
          const next = pending;
          setPending(null);
          if (next) void run(next, true);
        }}
      />
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.md },
  container: { paddingHorizontal: spacing.md + 26, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  section: { gap: spacing.xs },
  label: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '800', letterSpacing: 1.2, marginBottom: spacing.sm },
  input: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    color: colors.text,
    fontSize: fontSize.md,
    backgroundColor: colors.bgSunken,
    marginBottom: spacing.sm,
  },
  codeInput: { letterSpacing: 6, fontSize: fontSize.lg, fontWeight: '800', textAlign: 'center' },
  note: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  error: { color: colors.error, fontSize: fontSize.sm, fontWeight: '600', textAlign: 'center' },
});
