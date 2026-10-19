/**
 * Интерактив өгүүлэмж (ROADMAP C2)
 *
 * СУДАЛГААНЫ ҮНДЭСЛЭЛ: Khan-ы тоймд өгүүлэмж хамгийн олон давтагдсан
 * элемент. López-Enríquez нарын ангиллаар энэ дэлгэц нь аппыг
 * «Structural»-аас «Narrative» түвшинд гаргана.
 *
 * ЗОХИОМЖИЙН ЗАРЧИМ:
 *   • АЛЬ Ч СОНГОЛТ БУРУУ БИШ. «Зөв хариулт» гэсэн үзэл байхгүй —
 *     эс тэгвээс энэ нь дахин нэг сорил болж хувирна.
 *   • Түүхэн баримт нь сонгосны ДАРАА, ҮР ДАГАВРААР харагдана.
 *   • Дахин тоглох нь урамшуулагдана — өөр төгсгөл олдоно.
 *   • XP-г СЕРВЕР олгоно; клиент зөвхөн явсан замаа илгээнэ (Бүлэг 6.1).
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STORY_START_KEY, type StoryNode } from '@nomad/core';
import type { Story as StoryDto } from '@nomad/contracts';
import { completeStory, fetchStories } from '@/api/endpoints';
import { Card, EmptyState, ErrorState, PrimaryButton, Skeleton } from '@/components/ui';
import { CountUp } from '@/components/CountUp';
import { FadeInUp } from '@/components/motion';
import { HornBorder, OrnamentDivider, Ulzii } from '@/components/Ornament';
import { celebrateFeedback, selectFeedback } from '@/feedback';
import { colors, eraColor, fontFamily, fontSize, radius, spacing } from '@/theme';

export default function StoryScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const list = useQuery({ queryKey: ['stories'], queryFn: fetchStories });

  const [active, setActive] = useState<StoryDto | null>(null);
  /** `start`-аас хойш сонгосон зангилаанууд */
  const [path, setPath] = useState<string[]>([]);
  /** Сонгосны дараа харагдах түүхэн баримт */
  const [fact, setFact] = useState<string | null>(null);
  const [reward, setReward] = useState<{ xp: number; already: boolean } | null>(null);

  const finish = useMutation({
    mutationFn: (p: { storyId: number; path: string[] }) => completeStory(p),
    onSuccess: (res) => {
      celebrateFeedback();
      setReward({ xp: res.xpAwarded, already: res.alreadyCompleted });
      void qc.invalidateQueries({ queryKey: ['stories'] });
      void qc.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  function reset() {
    setPath([]);
    setFact(null);
    setReward(null);
  }

  function open(story: StoryDto) {
    selectFeedback();
    setActive(story);
    reset();
  }

  // ─────────────────────────────────────────────────────────
  // Жагсаалт
  // ─────────────────────────────────────────────────────────

  if (!active) {
    return (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}>
        <Text style={styles.title}>Түүхэн сонголт</Text>
        <HornBorder width={200} height={16} opacity={0.5} />
        <Text style={styles.lead}>
          Та тэр үед байсан бол юу хийх байсан бэ? Буруу хариулт байхгүй —
          зөвхөн өөр өөр үр дагавар.
        </Text>

        {list.isLoading && (
          <View style={{ gap: spacing.sm }}>
            <Skeleton height={110} />
            <Skeleton height={110} />
          </View>
        )}

        {list.isError && (
          <ErrorState
            title="Ачаалж чадсангүй"
            message="Сүлжээгээ шалгаад дахин оролдоно уу."
            actionLabel="Дахин оролдох"
            onAction={() => void list.refetch()}
          />
        )}

        {list.data && list.data.stories.length === 0 && (
          <EmptyState
            emoji="📜"
            title="Өгүүлэмж хараахан бэлэн болоогүй"
            message="Түүхч хянаж баталсны дараа энд гарна. Удахгүй."
          />
        )}

        {list.data?.stories.map((s, i) => {
          const c = eraColor(s.eraId);
          return (
            <FadeInUp key={s.id} delay={i * 90}>
              <Pressable
                onPress={() => open(s)}
                accessibilityRole="button"
                accessibilityLabel={`${s.title}: ${s.summary}`}
                style={[styles.storyCard, { borderColor: c.main }]}>
                <View style={[styles.stripe, { backgroundColor: c.main }]} />
                <Text style={[styles.storyTitle, { color: c.main }]}>{s.title}</Text>
                <Text style={styles.storySummary}>{s.summary}</Text>
                <Text style={styles.storyMeta}>
                  📚 {s.sourceRef}
                  {s.completedEnding ? ' · ✓ үзсэн' : ` · +${s.xpReward} XP`}
                </Text>
              </Pressable>
            </FadeInUp>
          );
        })}
      </ScrollView>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Тоглож байна
  // ─────────────────────────────────────────────────────────

  const nodes = active.nodes as StoryNode[];
  const currentKey = path.length > 0 ? path[path.length - 1]! : STORY_START_KEY;
  const node = nodes.find((n) => n.key === currentKey);

  // ӨС-ийн граф эвдэрсэн бол хоосон дэлгэц гаргахгүй
  if (!node) {
    return (
      <View style={[styles.flex, styles.center, { paddingTop: insets.top }]}>
        <ErrorState
          title="Өгүүлэмж эвдэрсэн байна"
          message="Энэ хэсэг ачаалагдсангүй. Жагсаалт руу буцна уу."
          actionLabel="Буцах"
          onAction={() => setActive(null)}
        />
      </View>
    );
  }

  const isEnding = node.choices.length === 0;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
      ]}>
      <Pressable
        onPress={() => setActive(null)}
        accessibilityRole="button"
        accessibilityLabel="Жагсаалт руу буцах"
        style={styles.backBtn}>
        <Text style={styles.backText}>← {active.title}</Text>
      </Pressable>

      {/* Явцын заалт — хэр удаан болохыг мэдэгдэнэ */}
      <Text style={styles.step}>
        {isEnding ? 'Төгсгөл' : `${path.length + 1}-р хэсэг`}
      </Text>

      <FadeInUp key={node.key}>
        <Card accent={eraColor(active.eraId).main}>
          <Text style={styles.body}>{node.body}</Text>
        </Card>
      </FadeInUp>

      {/* Өмнөх сонголтын түүхэн баримт */}
      {fact && !isEnding && (
        <FadeInUp>
          <View style={styles.factBox}>
            <Text style={styles.factText}>📜 {fact}</Text>
          </View>
        </FadeInUp>
      )}

      {/* ─── Сонголтууд ─── */}
      {!isEnding &&
        node.choices.map((c, i) => (
          <Pressable
            key={`${node.key}-${i}`}
            onPress={() => {
              selectFeedback();
              setFact(c.factNote ?? null);
              setPath((p) => [...p, c.nextKey]);
            }}
            accessibilityRole="button"
            accessibilityLabel={c.label}
            style={styles.choice}>
            <Text style={styles.choiceText}>{c.label}</Text>
          </Pressable>
        ))}

      {/* ─── Төгсгөл ─── */}
      {isEnding && (
        <FadeInUp>
          <View style={styles.endWrap}>
            <Ulzii size={64} color={colors.primary} strokeWidth={4} />
            {node.endingLabel && (
              <Text style={styles.endingLabel}>«{node.endingLabel}»</Text>
            )}

            {fact && <Text style={styles.factText}>📜 {fact}</Text>}

            {!reward && (
              <PrimaryButton
                title={finish.isPending ? 'Хадгалж байна…' : 'Дуусгах'}
                disabled={finish.isPending}
                onPress={() => finish.mutate({ storyId: active.id, path })}
              />
            )}

            {finish.isError && (
              <Text style={styles.error}>
                Хадгалж чадсангүй. Сүлжээгээ шалгаад дахин оролдоно уу.
              </Text>
            )}

            {reward && (
              <>
                {reward.xp > 0 ? (
                  <CountUp value={reward.xp} prefix="+" suffix=" XP" style={styles.xp} />
                ) : (
                  <Text style={styles.alreadyNote}>
                    Энэ өгүүлэмжид XP аль хэдийн авсан — гэхдээ шинэ төгсгөл
                    олсон нь өөрөө сонирхолтой.
                  </Text>
                )}

                <OrnamentDivider />

                <Text style={styles.replayNote}>
                  Өөр сонголт хийвэл өөр төгсгөлд хүрнэ. Аль нь ч буруу биш.
                </Text>

                <PrimaryButton title="Дахин үзэх" variant="ghost" onPress={reset} />
                <PrimaryButton
                  title="Жагсаалт руу"
                  variant="ghost"
                  onPress={() => setActive(null)}
                />
              </>
            )}

            <Text style={styles.source}>📚 {active.sourceRef}</Text>
          </View>
        </FadeInUp>
      )}
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
  lead: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 21 },

  storyCard: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    padding: spacing.md,
    paddingLeft: spacing.md + 6,
    overflow: 'hidden',
    gap: spacing.xs,
  },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  storyTitle: { fontSize: fontSize.lg, fontWeight: '800', fontFamily: fontFamily.display },
  storySummary: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
  storyMeta: { color: colors.textDim, fontSize: fontSize.xs },

  backBtn: { minHeight: 40, justifyContent: 'center' },
  backText: { color: colors.textMuted, fontSize: fontSize.sm },
  step: {
    color: colors.sky,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '800',
  },

  body: { color: colors.text, fontSize: fontSize.md, lineHeight: 25 },

  factBox: {
    borderLeftWidth: 3,
    borderLeftColor: colors.sky,
    paddingLeft: spacing.md,
    paddingVertical: spacing.sm,
  },
  factText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },

  choice: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    padding: spacing.md,
    minHeight: 56,
    justifyContent: 'center',
  },
  choiceText: { color: colors.text, fontSize: fontSize.md, lineHeight: 22 },

  endWrap: { alignItems: 'center', gap: spacing.md },
  endingLabel: {
    color: colors.primary,
    fontSize: fontSize.xl,
    fontFamily: fontFamily.display,
    textAlign: 'center',
  },
  xp: {
    fontFamily: fontFamily.display,
    color: colors.primary,
    fontSize: fontSize.display,
    fontVariant: ['tabular-nums'],
  },
  alreadyNote: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  replayNote: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  source: { color: colors.textDim, fontSize: fontSize.xs, fontStyle: 'italic' },
  error: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },
});
