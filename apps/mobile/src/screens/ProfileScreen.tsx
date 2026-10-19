/**
 * Профайл — статистик, тохиргоо (Бүлэг 6.5)
 *
 * Бүлэг 3.7 (бие даасан байдал): «Streak-гүй горим — хэрэглэгч streak-ийн
 * даралтыг түр унтраах боломжтой. Дадал биш, сонирхлоор ирдэг хэрэглэгчийг
 * алдахгүй.» Энэ нь «багажгүй үргэлжлэл» KPI-ийн суурь (Бүлэг 8.5).
 */
import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, ErrorState, SectionTitle, Skeleton, StreakBadge } from '@/components/ui';
import { PLAYER_PATH_META, PLAYER_PATHS } from '@nomad/core';
import { selectFeedback } from '@/feedback';
import { useProfile, useUpdateProfile } from '@/hooks/queries';
import { clearOfflineData } from '@/offline/queue';
import { useGameStore } from '@/store/useGameStore';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { data: profile, isLoading, isError, refetch } = useProfile();
  const updateProfile = useUpdateProfile();
  const signOut = useGameStore((s) => s.signOut);
  const pendingSyncCount = useGameStore((s) => s.pendingSyncCount);

  function confirmSignOut() {
    Alert.alert(
      'Гарах уу?',
      'Таны ахиц серверт хадгалагдана. Дахин нэвтрэхэд бүгд сэргэнэ.',
      [
        { text: 'Үгүй', style: 'cancel' },
        {
          text: 'Гарах',
          style: 'destructive',
          onPress: () => {
            void clearOfflineData();
            signOut();
          },
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ padding: spacing.md }}>
          <Skeleton height={80} />
          <Skeleton height={180} />
        </View>
      </View>
    );
  }

  if (isError || !profile) {
    return (
      <View style={[styles.flex, styles.center, { paddingTop: insets.top }]}>
        <ErrorState
          title="Профайл ачаалж чадсангүй"
          message="Сүлжээгээ шалгаад дахин оролдоно уу."
          actionLabel="Дахин оролдох"
          onAction={() => void refetch()}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.md },
      ]}>
      <View style={styles.header}>
        <View style={styles.avatarMedallion}>
          <View style={styles.avatarInner}>
            <Text style={styles.avatarEmoji}>{profile.avatarEmoji}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{profile.displayName}</Text>
          <View style={styles.tierPill}>
            <Text style={styles.tier}>
              {profile.rankTitle} · {profile.rankEra}
            </Text>
          </View>
        </View>
        <StreakBadge days={profile.streakDays} paused={profile.streakFreeMode} />
      </View>

      <Card style={{ marginTop: spacing.md }}>
        <SectionTitle>Статистик</SectionTitle>
        <Stat label="Нийт XP" value={`${profile.xp}`} />
        <Stat label="Нээсэн баатар" value={`${profile.unlockedHeroIds.length}`} />
        <Stat label="Цуглуулсан олдвор" value={`${profile.artifactIds.length}`} />
        <Stat
          label="Сүүлийн идэвх"
          value={profile.dailyDone ? 'Өнөөдөр' : (profile.lastActiveDate ?? '—')}
        />
        {pendingSyncCount > 0 && (
          <Stat label="Sync хүлээж буй" value={`${pendingSyncCount}`} />
        )}
      </Card>

      {/* ─── Бүлэг 3.7: бие даасан байдлын зохиомж ─── */}
      {/* B5 · Тоглогчийн зам — Khan: «хувийн болголт нь сэдэлд амин чухал».
          ⚠ ХААЛТ БИШ: юу ч нуугдахгүй, зөвхөн нүүрний эрэмбэ өөрчлөгдөнө. */}
      <Card style={{ marginTop: spacing.md }}>
        <SectionTitle>Чи ямар хүн бэ?</SectionTitle>
        <Text style={styles.pathLead}>
          Нүүр дэлгэц чиний сонирхолд тохируулан эрэмбэлэгдэнэ. Юу ч
          хаагдахгүй — хүссэн үедээ солиод бай.
        </Text>

        {PLAYER_PATHS.map((path) => {
          const meta = PLAYER_PATH_META[path];
          const active = profile.playerPath === path;
          return (
            <Pressable
              key={path}
              onPress={() => {
                selectFeedback();
                // Дахин дарвал сонголтыг цуцална
                updateProfile.mutate({ playerPath: active ? null : path });
              }}
              disabled={updateProfile.isPending}
              accessibilityRole="button"
              accessibilityLabel={`${meta.label}: ${meta.selfDescription}`}
              accessibilityState={{ selected: active }}
              style={[styles.pathRow, active && styles.pathRowActive]}>
              <Text style={styles.pathEmoji}>{meta.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pathLabel, active && styles.pathLabelActive]}>
                  {meta.label}
                </Text>
                <Text style={styles.pathDesc}>{meta.selfDescription}</Text>
              </View>
              {active && <Text style={styles.pathCheck}>✓</Text>}
            </Pressable>
          );
        })}
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <SectionTitle>Streak-гүй горим</SectionTitle>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Даралтыг унтраах</Text>
            <Text style={styles.switchHint}>
              Streak тоолуур зогсоно. Ахиц, оноо хэвээр — зүгээр л өдөр бүр
              ирэх шаардлагагүй болно.
            </Text>
          </View>
          <Switch
            value={profile.streakFreeMode}
            disabled={updateProfile.isPending}
            onValueChange={(v) => updateProfile.mutate({ streakFreeMode: v })}
            trackColor={{ false: colors.border, true: colors.primaryDark }}
            thumbColor={profile.streakFreeMode ? colors.primary : colors.textMuted}
            accessibilityLabel="Streak-гүй горим"
          />
        </View>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <SectionTitle>Хувийн мэдээлэл</SectionTitle>
        <Text style={styles.privacyNote}>
          Апп зөвхөн дэлгэцийн нэр ашигладаг — бодит нэр, төрсөн огноо,
          регистрийн дугаар шаардахгүй. Дуу хоолойн бичлэгийг оноолсны дараа
          шууд устгана. Хэрэглэгч хоорондын шууд мессеж байхгүй.
        </Text>
      </Card>

      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={confirmSignOut}
        accessibilityRole="button"
        accessibilityLabel="Системээс гарах">
        <Text style={styles.signOutText}>Гарах</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Эртний Өв · Nomad Legacy v0.2.0</Text>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow} accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pathLead: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 19 },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 64,
    marginTop: spacing.sm,
    backgroundColor: colors.bgCard,
  },
  pathRowActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(221, 176, 88, 0.08)',
  },
  pathEmoji: { fontSize: 26 },
  pathLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  pathLabelActive: { color: colors.primary },
  pathDesc: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 17 },
  pathCheck: { color: colors.primary, fontSize: fontSize.lg, fontWeight: '900' },

  flex: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center' },
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarMedallion: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.bgCardLight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  avatarInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(221, 176, 88, 0.25)',
  },
  avatarEmoji: {
    fontSize: 32,
  },
  tierPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(221, 176, 88, 0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(221, 176, 88, 0.3)',
  },
  name: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800', fontFamily: fontFamily.display },
  tier: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '700' },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  statLabel: { color: colors.textMuted, fontSize: fontSize.sm },
  statValue: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  switchHint: {
    color: colors.textMuted,
    fontSize: fontSize.sm - 1,
    lineHeight: 18,
    marginTop: 2,
  },
  privacyNote: { color: colors.textMuted, fontSize: fontSize.sm - 1, lineHeight: 18 },
  signOutBtn: {
    marginTop: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    minHeight: 44,
  },
  signOutText: { color: colors.error, fontSize: fontSize.sm, fontWeight: '600' },
  version: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
