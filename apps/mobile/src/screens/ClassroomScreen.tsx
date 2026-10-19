/**
 * Ангийн лиг ба хамтын зорилт (ROADMAP B4)
 *
 * СУДАЛГААНЫ ҮНДЭСЛЭЛ: Lee & Ko (2026) — үе тэнгийн харилцаа нь AI-тай
 * харилцахтай ИЖИЛ үр дүн өгдөг. Энэ дэлгэцээс өмнө аппд хүн–хүний
 * харилцаа огт байгаагүй.
 *
 * ЗОХИОМЖИЙН ЗАРЧИМ:
 *   • ЧӨЛӨӨТ БИЧВЭР БАЙХГҮЙ — чат, сэтгэгдэл байхгүй тул модерацийн
 *     эрсдэл нэмэгдэхгүй (Бүлэг 6.5).
 *   • БҮХ гишүүн жагсаалтад харагдана. Эхний 3-ыг л харуулбал ангийн
 *     ихэнх нь өөрийгөө олж харахгүй.
 *   • Хамтын зорилт нь ӨРСӨЛДӨӨН БИШ — сул сурдаг хүүхэд ч хувь нэмэр
 *     оруулж байгаагаа хардаг.
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CLASSROOM_CODE_LENGTH, normalizeClassroomCode } from '@nomad/core';
import { ApiError } from '@/api/client';
import { classroomAction, fetchClassroom } from '@/api/endpoints';
import { Card, ErrorState, PrimaryButton, ProgressBar, Skeleton } from '@/components/ui';
import { FadeInUp } from '@/components/motion';
import { HornBorder, OrnamentDivider } from '@/components/Ornament';
import { celebrateFeedback, warnFeedback } from '@/feedback';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

export default function ClassroomScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const room = useQuery({ queryKey: ['classroom'], queryFn: fetchClassroom });

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const act = useMutation({
    mutationFn: classroomAction,
    onSuccess: () => {
      celebrateFeedback();
      setError(null);
      setCode('');
      setName('');
      void qc.invalidateQueries({ queryKey: ['classroom'] });
    },
    onError: (err) => {
      warnFeedback();
      setError(
        err instanceof ApiError ? err.message : 'Холбогдож чадсангүй. Дахин оролдоно уу.'
      );
    },
  });

  if (room.isLoading) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top + spacing.md, padding: spacing.md }]}>
        <Skeleton height={44} />
        <Skeleton height={120} />
        <Skeleton height={200} />
      </View>
    );
  }

  if (room.isError) {
    return (
      <View style={[styles.flex, styles.center, { paddingTop: insets.top }]}>
        <ErrorState
          title="Анги ачаалж чадсангүй"
          message="Сүлжээгээ шалгаад дахин оролдоно уу."
          actionLabel="Дахин оролдох"
          onAction={() => void room.refetch()}
        />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Ангид ороогүй — үүсгэх эсвэл нэгдэх
  // ─────────────────────────────────────────────────────────

  if (!room.data?.joined) {
    const normalized = normalizeClassroomCode(code);
    const codeReady = normalized.length === CLASSROOM_CODE_LENGTH;

    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + spacing.md },
          ]}>
          <FadeInUp>
            <Text style={styles.title}>Ангийн лиг</Text>
            <HornBorder width={200} height={16} opacity={0.5} />
            <Text style={styles.lead}>
              Ангийнхантайгаа нийлээд хамтын зорилт биелүүл. Хэн ч хоцрохгүй —
              бүх хүн хувь нэмэр оруулна.
            </Text>
          </FadeInUp>

          <Card accent={colors.sky}>
            <Text style={styles.sectionTitle}>Кодоор нэгдэх</Text>
            <Text style={styles.hint}>
              Багшаас авсан {CLASSROOM_CODE_LENGTH} тэмдэгтийн кодоо бич
            </Text>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={(t) => {
                setCode(t);
                setError(null);
              }}
              placeholder="ABC234"
              placeholderTextColor={colors.textDim}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              accessibilityLabel="Ангийн код"
            />
            <PrimaryButton
              title={act.isPending ? 'Нэгдэж байна…' : 'Нэгдэх'}
              disabled={!codeReady || act.isPending}
              onPress={() => act.mutate({ action: 'join', code: normalized })}
            />
          </Card>

          <OrnamentDivider />

          <Card>
            <Text style={styles.sectionTitle}>Багш уу? Анги үүсгэх</Text>
            <Text style={styles.hint}>
              Үүсгэсний дараа код гарах бөгөөд түүнийг сурагчиддаа өгнө
            </Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ж нь: 10А анги"
              placeholderTextColor={colors.textDim}
              maxLength={60}
              accessibilityLabel="Ангийн нэр"
            />
            <PrimaryButton
              title="Анги үүсгэх"
              variant="ghost"
              disabled={name.trim().length < 2 || act.isPending}
              onPress={() => act.mutate({ action: 'create', name: name.trim() })}
            />
          </Card>

          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Ангид орсон — зорилт ба чансаа
  // ─────────────────────────────────────────────────────────

  const { classroom, goal, entries } = room.data;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
      ]}>
      <Text style={styles.title}>{classroom.name}</Text>
      <Text style={styles.hint}>{classroom.memberCount} сурагч</Text>

      {/* Багшид зориулж код харуулна — гишүүдэд харагдахгүй */}
      {classroom.isOwner && classroom.code && (
        <Card accent={colors.primary}>
          <Text style={styles.sectionTitle}>Ангийн код</Text>
          <Text style={styles.codeDisplay}>{classroom.code}</Text>
          <Text style={styles.hint}>Сурагчиддаа энэ кодыг өгнө үү</Text>
        </Card>
      )}

      {/* ─── Хамтын зорилт ─── */}
      <Card accent={colors.sky} glow={goal.reached}>
        <Text style={styles.sectionTitle}>Хамтын зорилт</Text>
        <Text style={styles.goalNumbers}>
          {goal.current} / {goal.target} асуулт
        </Text>
        <ProgressBar progress={goal.ratio} />
        <Text style={styles.goalMessage}>{goal.message}</Text>
      </Card>

      <OrnamentDivider />

      {/* ─── Чансаа — БҮХ гишүүн ─── */}
      <Text style={styles.sectionTitle}>Энэ долоо хоног</Text>

      {entries.map((e) => (
        <View
          key={e.userId}
          style={[styles.row, e.isMe && styles.rowMe]}
          accessibilityLabel={`${e.rank}-р байр, ${e.displayName}, ${e.weeklyXp} оноо`}>
          <Text style={[styles.rank, e.isMe && styles.rankMe]}>{e.rank}</Text>
          <Text style={styles.avatar}>{e.avatarEmoji}</Text>
          <Text style={[styles.name, e.isMe && styles.nameMe]} numberOfLines={1}>
            {e.displayName}
            {e.isMe ? ' (чи)' : ''}
          </Text>
          <Text style={styles.xp}>{e.weeklyXp}</Text>
        </View>
      ))}

      <Text style={styles.footNote}>
        Оноо ням гарагт тэглэгдэнэ. Хамтын зорилт нь өрсөлдөөн биш — анги
        бүхэлдээ хүрэх ёстой тоо.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  container: { padding: spacing.md, gap: spacing.md },

  title: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: '900',
    fontFamily: fontFamily.display,
  },
  lead: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 21, marginTop: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  hint: { color: colors.textDim, fontSize: fontSize.xs, lineHeight: 17 },

  input: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: fontSize.md,
    minHeight: 48,
  },
  codeInput: {
    backgroundColor: colors.bg,
    borderColor: colors.sky,
    borderWidth: 1.5,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 28,
    letterSpacing: 6,
    textAlign: 'center',
    minHeight: 64,
    fontVariant: ['tabular-nums'],
  },
  codeDisplay: {
    color: colors.primary,
    fontSize: 34,
    letterSpacing: 8,
    textAlign: 'center',
    fontFamily: fontFamily.display,
  },

  goalNumbers: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  goalMessage: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    minHeight: 48,
  },
  rowMe: { backgroundColor: colors.bgCardLight },
  rank: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '800',
    minWidth: 28,
    fontVariant: ['tabular-nums'],
  },
  rankMe: { color: colors.primary },
  avatar: { fontSize: 22 },
  name: { color: colors.text, fontSize: fontSize.md, flex: 1 },
  nameMe: { fontWeight: '800', color: colors.primary },
  xp: { color: colors.textMuted, fontSize: fontSize.md, fontVariant: ['tabular-nums'] },

  footNote: { color: colors.textDim, fontSize: fontSize.xs, lineHeight: 17 },
  error: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },
});
