/**
 * «Өвөө эмээгийн дуу хоолой» — хувь нэмрийн дэлгэц (ROADMAP B3)
 *
 * СУДАЛГААНЫ ҮНДЭСЛЭЛ: Khan — «биет бус өв нь биет өвөөс илүү чухал».
 * LOCUS төслийн үе хоорондын контент бүтээлт. Энэ дэлгэц нь аппыг
 * ХЭРЭГЛЭГЧЭЭС ЗОХИОГЧ болгож хувиргана — R1 контентийн эрсдэлийн шийдэл.
 *
 * ЗОХИОМЖИЙН ЗАРЧИМ:
 *   • Зөвшөөрөл нь чагтлах нүд биш, БОДИТ АЛХАМ — асуухыг нь сануулна.
 *   • «Хянагдана» гэдгийг ил хэлнэ — татгалзвал гэнэтийн зүйл болохгүй.
 *   • XP нь ИЛГЭЭХЭД олгогдоно. Түүхч татгалзсан ч XP буцаагдахгүй —
 *     хүүхэд өвөөгөөсөө асуусан нь өөрөө үнэ цэнтэй (Бүлэг 6.3).
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CONTRIBUTION_LABEL,
  CONTRIBUTION_LIMITS,
  type ContributionKind,
} from '@nomad/core';
import { fetchContributions, submitContribution } from '@/api/endpoints';
import { Card, ErrorState, PrimaryButton, Skeleton } from '@/components/ui';
import { FadeInUp } from '@/components/motion';
import { HornBorder, OrnamentDivider } from '@/components/Ornament';
import { celebrateFeedback, selectFeedback, tapFeedback, warnFeedback } from '@/feedback';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

const KINDS: ContributionKind[] = ['proverb', 'legend', 'story', 'custom', 'song'];

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  pending: { text: '⏳ Хянагдаж байна', color: colors.warning },
  approved: { text: '✓ Батлагдсан', color: colors.success },
  rejected: { text: '· Оруулаагүй', color: colors.textDim },
};

export default function ContributionScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const list = useQuery({ queryKey: ['contributions'], queryFn: fetchContributions });

  const [kind, setKind] = useState<ContributionKind>('proverb');
  const [body, setBody] = useState('');
  const [elderLabel, setElderLabel] = useState('');
  const [regionNote, setRegionNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      submitContribution({
        kind,
        body: body.trim(),
        elderLabel: elderLabel.trim(),
        regionNote: regionNote.trim() || undefined,
        consentConfirmed: consent,
      }),
    onSuccess: (res) => {
      if (!res.accepted) {
        warnFeedback();
        setNotice(res.message ?? 'Хүлээж авч чадсангүй.');
        return;
      }
      celebrateFeedback();
      setNotice(`Баярлалаа! +${res.xpAwarded} XP. Одоо түүхч хянана.`);
      setBody('');
      setElderLabel('');
      setRegionNote('');
      setConsent(false);
      void qc.invalidateQueries({ queryKey: ['contributions'] });
      void qc.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: () => {
      warnFeedback();
      setNotice('Илгээж чадсангүй. Сүлжээгээ шалгаад дахин оролдоно уу.');
    },
  });

  const limits = CONTRIBUTION_LIMITS[kind];
  const len = body.trim().length;
  const canSend =
    consent && elderLabel.trim().length >= 2 && len >= limits.min && len <= limits.max;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}>
        <FadeInUp>
          <Text style={styles.title}>Өвөө эмээгийн дуу хоолой</Text>
          <HornBorder width={220} height={16} opacity={0.5} />
          <Text style={styles.lead}>
            Энэ апп дахь түүх ХЭН НЭГНИЙХ. Өвөө эмээгээсээ сонссон зүйр үг,
            домог, үлгэрээ энд бичвэл бусад хүүхдүүд сурна — доор нь чиний
            нэр гарна.
          </Text>
        </FadeInUp>

        {/* ─── Төрөл ─── */}
        <Text style={styles.label}>Юу сонссон бэ?</Text>
        <View style={styles.kindRow}>
          {KINDS.map((k) => (
            <Pressable
              key={k}
              onPress={() => {
                selectFeedback();
                setKind(k);
              }}
              accessibilityRole="button"
              accessibilityLabel={CONTRIBUTION_LABEL[k]}
              accessibilityState={{ selected: kind === k }}
              style={[styles.kindChip, kind === k && styles.kindChipActive]}>
              <Text style={[styles.kindText, kind === k && styles.kindTextActive]}>
                {CONTRIBUTION_LABEL[k]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ─── Бичвэр ─── */}
        <Text style={styles.label}>Сонссоноо бичээрэй</Text>
        <TextInput
          style={styles.bodyInput}
          value={body}
          onChangeText={(t) => {
            setBody(t);
            setNotice(null);
          }}
          placeholder="Сонссоноороо, өөрчлөлгүй бич…"
          placeholderTextColor={colors.textDim}
          multiline
          maxLength={limits.max}
          accessibilityLabel="Цуглуулсан бичвэр"
        />
        <Text style={styles.counter}>
          {len}/{limits.max}
          {len < limits.min ? ` · дор хаяж ${limits.min}` : ''}
        </Text>

        {/* ─── Хэнээс ─── */}
        <Text style={styles.label}>Хэнээс сонссон бэ?</Text>
        <TextInput
          style={styles.input}
          value={elderLabel}
          onChangeText={setElderLabel}
          placeholder="Ж нь: Дорж өвөө"
          placeholderTextColor={colors.textDim}
          maxLength={60}
          accessibilityLabel="Ахмад хүний таних тэмдэг"
        />
        <Text style={styles.hint}>
          Бүтэн нэр бичих шаардлагагүй — хэрхэн дуудахаа бичихэд хангалттай.
        </Text>

        <Text style={styles.label}>Аль нутгийнх вэ? (сонголтоор)</Text>
        <TextInput
          style={styles.input}
          value={regionNote}
          onChangeText={setRegionNote}
          placeholder="Ж нь: Завхан, Тосонцэнгэл"
          placeholderTextColor={colors.textDim}
          maxLength={200}
          accessibilityLabel="Нутгийн тэмдэглэл"
        />

        {/* ─── Зөвшөөрөл ─── */}
        <Pressable
          onPress={() => {
            tapFeedback();
            setConsent((c) => !c);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          accessibilityLabel="Зөвшөөрөл авсныг баталгаажуулах"
          style={[styles.consent, consent && styles.consentOn]}>
          <Text style={styles.consentBox}>{consent ? '☑' : '☐'}</Text>
          <Text style={styles.consentText}>
            Би өвөө/эмээгээсээ «Үүнийг апп дээр тавьж болох уу?» гэж асуугаад
            зөвшөөрөл авсан.
          </Text>
        </Pressable>

        <PrimaryButton
          title={submit.isPending ? 'Илгээж байна…' : 'Илгээх'}
          disabled={!canSend || submit.isPending}
          onPress={() => {
            setNotice(null);
            submit.mutate();
          }}
        />

        {notice && <Text style={styles.notice}>{notice}</Text>}

        <Text style={styles.policy}>
          Илгээсэн зүйлийг түүхч хянана. Батлагдаагүй ч XP хэвээр үлдэнэ —
          өвөөгөөсөө асуусан нь өөрөө үнэ цэнтэй.
        </Text>

        <OrnamentDivider />

        {/* ─── Миний хувь нэмэр ─── */}
        <Text style={styles.label}>Миний цуглуулсан</Text>

        {list.isLoading && <Skeleton height={72} />}

        {list.isError && (
          <ErrorState
            title="Ачаалж чадсангүй"
            message="Сүлжээгээ шалгаад дахин оролдоно уу."
            actionLabel="Дахин оролдох"
            onAction={() => void list.refetch()}
          />
        )}

        {list.data && list.data.items.length === 0 && (
          <Text style={styles.empty}>
            Одоогоор хоосон. Эхний зүйлээ илгээвэл энд харагдана.
          </Text>
        )}

        {list.data?.items.map((item) => {
          const st = STATUS_LABEL[item.status] ?? STATUS_LABEL.pending!;
          return (
            <Card key={item.id} style={{ gap: spacing.xs }}>
              <View style={styles.itemHead}>
                <Text style={styles.itemKind}>
                  {CONTRIBUTION_LABEL[item.kind as ContributionKind]}
                </Text>
                <Text style={[styles.itemStatus, { color: st.color }]}>{st.text}</Text>
              </View>
              <Text style={styles.itemBody} numberOfLines={4}>
                {item.body}
              </Text>
              <Text style={styles.itemElder}>— {item.elderLabel}</Text>
              {item.reviewNote && (
                <Text style={styles.itemNote}>Тэмдэглэл: {item.reviewNote}</Text>
              )}
            </Card>
          );
        })}

        {list.data && (
          <Text style={styles.hint}>
            Өнөөдөр {list.data.remainingToday} удаа илгээх боломжтой ·
            Батлагдсан: {list.data.approvedCount}
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.md, gap: spacing.sm },

  title: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: '900',
    fontFamily: fontFamily.display,
  },
  lead: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 21, marginTop: spacing.sm },

  label: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  hint: { color: colors.textDim, fontSize: fontSize.xs, lineHeight: 17 },

  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  kindChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  kindChipActive: { borderColor: colors.primary, backgroundColor: colors.bgCardLight },
  kindText: { color: colors.textMuted, fontSize: fontSize.sm },
  kindTextActive: { color: colors.primary, fontWeight: '700' },

  input: {
    backgroundColor: colors.bgCard,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: fontSize.md,
    minHeight: 48,
  },
  bodyInput: {
    backgroundColor: colors.bgCard,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    padding: spacing.md,
    fontSize: fontSize.md,
    minHeight: 140,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  counter: { color: colors.textDim, fontSize: fontSize.xs, textAlign: 'right' },

  consent: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  consentOn: { borderColor: colors.success, backgroundColor: colors.bgCard },
  consentBox: { color: colors.success, fontSize: fontSize.lg },
  consentText: { color: colors.text, fontSize: fontSize.sm, flex: 1, lineHeight: 20 },

  notice: { color: colors.sky, fontSize: fontSize.sm, lineHeight: 20 },
  policy: { color: colors.textDim, fontSize: fontSize.xs, lineHeight: 17 },
  empty: { color: colors.textDim, fontSize: fontSize.sm },

  itemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemKind: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700' },
  itemStatus: { fontSize: fontSize.xs },
  itemBody: { color: colors.text, fontSize: fontSize.sm, lineHeight: 20 },
  itemElder: { color: colors.textMuted, fontSize: fontSize.xs, fontStyle: 'italic' },
  itemNote: { color: colors.textDim, fontSize: fontSize.xs },
});
