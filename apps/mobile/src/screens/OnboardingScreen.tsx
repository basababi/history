/**
 * Onboarding — эхний ялалт 20 секундэд (ROADMAP B6)
 *
 * ЯАГААД ӨӨРЧИЛСӨН: Өмнө нь энэ дэлгэц МАЯГТ БӨГЛӨХ байсан —
 * нэр бичих → emoji сонгох → нүүр дэлгэц. Нэг ч сэтгэл хөдөлгөм зүйл
 * болохгүй тул хэрэглэгч аппыг юу гэдгийг ойлгохоос өмнө гарч болзошгүй.
 *
 * > Бүлэг 10: «Эхний саруудад хамгийн их хөрөнгө оруулах ёстой газар:
 * >  (1) контентийн чанар, (2) onboarding-ийн эхний 3 минут, (3) хэмжилт.»
 *
 * ШИНЭ УРСГАЛ:
 *   1. «Аль эрин чамайг татаж байна?» — НЭР биш, СОНГОЛТООР эхэлнэ
 *   2. Шууд нэг асуулт — хариултаа мэдэхгүй ч зүгээр
 *   3. «+10 XP» тоологдож гарна — эхний ялалт ~20 секундэд
 *   4. Одоо л нэр асууна. Тэр үед хэрэглэгч үлдэхээр шийдсэн байна.
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
import { useMutation } from '@tanstack/react-query';
import type { ServedQuestion } from '@nomad/contracts';
import { createQuizSession, submitAnswer } from '@/api/endpoints';
import { useCatalog, useUpdateProfile } from '@/hooks/queries';
import { Card, ErrorState, PrimaryButton, Skeleton } from '@/components/ui';
import { CountUp } from '@/components/CountUp';
import { Animated, FadeInUp, usePulse, useShake } from '@/components/motion';
import { CloudBand, CloudDivider, Ulzii } from '@/components/Ornament';
import { correctFeedback, selectFeedback, wrongFeedback } from '@/feedback';
import { useGameStore } from '@/store/useGameStore';
import {
  colors,
  eraColor,
  fontFamily,
  fontSize,
  radius,
  spacing,
} from '@/theme';

type Step = 'era' | 'question' | 'reward' | 'name';

const AVATARS = ['🧑‍🌾', '🏹', '🐎', '🦅', '⚔️', '👑'];

export default function OnboardingScreen() {
  const catalog = useCatalog();
  const updateProfile = useUpdateProfile();
  /**
   * ⚠ ГАЦААНЫ ЗАСВАР: навигаци нь ЛОКАЛ `onboardingSeen`-ээр шилждэг
   * (`App.tsx` → `RootNavigator`). Энэ дэлгэц зөвхөн сервер рүү
   * `onboardingDone` илгээгээд локал тугийг тавьдаггүй байсан тул
   * хүсэлт амжилттай болсон ч навигаци ХЭЗЭЭ Ч шилждэггүй — хэрэглэгч
   * «Аялалаа эхэлье» дараад мөнхөд энэ дэлгэцэд үлддэг байв.
   */
  const markOnboardingSeen = useGameStore((st) => st.markOnboardingSeen);

  const [step, setStep] = useState<Step>('era');
  const [eraName, setEraName] = useState('');
  const [question, setQuestion] = useState<ServedQuestion | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [xp, setXp] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [sourceRef, setSourceRef] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]!);

  const pulse = usePulse();
  const shake = useShake();

  /** Сонгосон эринээс НЭГ асуулт татна */
  const startQuestion = useMutation({
    mutationFn: async (era: number) => {
      const session = await createQuizSession({ questionCount: 1, eraId: era, mode: 'free' });
      return session;
    },
    onSuccess: (session) => {
      const q = session.questions[0];
      if (!q) return;
      setQuestion(q);
      setToken(session.token);
      setStep('question');
    },
  });

  const answer = useMutation({
    mutationFn: async (index: number) => {
      if (!token || !question) throw new Error('no session');
      return submitAnswer({ token, questionId: question.id, selectedIndex: index });
    },
    onSuccess: (res) => {
      setCorrectIndex(res.correctIndex);
      setXp(res.xpAwarded);
      setExplanation(res.explanation);
      setSourceRef(res.sourceRef);
      if (res.isCorrect) {
        correctFeedback();
        pulse.pulse();
      } else {
        wrongFeedback();
        shake.shake();
      }
      // Тайлбарыг уншуулаад шагнал руу
      setTimeout(() => setStep('reward'), 2200);
    },
  });

  // ─────────────────────────────────────────────────────────────
  // 1. Эрин сонгох
  // ─────────────────────────────────────────────────────────────

  if (step === 'era') {
    const eras = catalog.data?.eras ?? [];

    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
        <FadeInUp>
          <View style={styles.brand}>
            <CloudBand tone="brass" height={28} opacity={0.3} style={styles.brandBand} />
            <Ulzii size={58} color={colors.primary} strokeWidth={4} glowing />
            <Text style={styles.logo}>ЭРТНИЙ ӨВ</Text>
            <CloudDivider width={220} opacity={0.8} />
          </View>
        </FadeInUp>

        <FadeInUp delay={120}>
          <Text style={styles.question}>Аль эрин чамайг татаж байна?</Text>
          <Text style={styles.hint}>Дараа нь өөрчилж болно</Text>
        </FadeInUp>

        {catalog.isLoading && (
          <View style={{ gap: spacing.sm }}>
            <Skeleton height={92} />
            <Skeleton height={92} />
            <Skeleton height={92} />
          </View>
        )}

        {catalog.isError && (
          <ErrorState
            title="Ачаалж чадсангүй"
            message="Сүлжээгээ шалгаад дахин оролдоно уу."
            actionLabel="Дахин оролдох"
            onAction={() => void catalog.refetch()}
          />
        )}

        {eras.map((era, i) => {
          const c = eraColor(era.orderIndex);
          return (
            <FadeInUp key={era.id} delay={200 + i * 90}>
              <Pressable
                onPress={() => {
                  selectFeedback();
                  setEraName(era.name);
                  startQuestion.mutate(era.id);
                }}
                disabled={startQuestion.isPending}
                accessibilityRole="button"
                accessibilityLabel={`${era.name} эринг сонгох`}
                style={[styles.eraCard, { borderColor: c.main }]}>
                <View style={[styles.eraStripe, { backgroundColor: c.main }]} />
                <Text style={[styles.eraName, { color: c.main }]}>{era.name}</Text>
                <Text style={styles.eraYears}>
                  {era.startYear} — {era.endYear}
                </Text>
                <Text style={styles.eraDesc} numberOfLines={2}>
                  {era.description}
                </Text>
              </Pressable>
            </FadeInUp>
          );
        })}

        {startQuestion.isError && (
          <Text style={styles.errorNote}>
            Асуулт татаж чадсангүй. Дахин сонгоно уу.
          </Text>
        )}
      </ScrollView>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Эхний асуулт
  // ─────────────────────────────────────────────────────────────

  if (step === 'question' && question) {
    const answered = correctIndex !== null;

    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
        <Text style={styles.stepBadge}>Эхний асуулт</Text>
        <Text style={styles.hint}>
          Хариултаа мэдэхгүй ч зүгээр — тайлбар нь хамгийн сонирхолтой хэсэг
        </Text>

        <Animated.View style={answered && correctIndex === selected ? pulse.style : shake.style}>
          <Card accent={colors.primary} glow>
            <Text style={styles.qBody}>{question.body}</Text>
          </Card>
        </Animated.View>

        <View style={{ gap: spacing.sm }}>
          {question.options.map((opt, i) => {
            const isCorrect = answered && i === correctIndex;
            const isWrongPick = answered && i === selected && i !== correctIndex;
            return (
              <Pressable
                key={i}
                onPress={() => {
                  if (answered || answer.isPending) return;
                  setSelected(i);
                  answer.mutate(i);
                }}
                disabled={answered || answer.isPending}
                accessibilityRole="button"
                accessibilityLabel={opt}
                style={[
                  styles.option,
                  isCorrect && styles.optionCorrect,
                  isWrongPick && styles.optionWrong,
                ]}>
                <Text style={styles.optionText}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>

        {answered && (
          <FadeInUp>
            <Card>
              <Text style={styles.explain}>{explanation}</Text>
              {sourceRef !== '—' && <Text style={styles.source}>📚 {sourceRef}</Text>}
            </Card>
          </FadeInUp>
        )}
      </ScrollView>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Эхний ялалт
  // ─────────────────────────────────────────────────────────────

  if (step === 'reward') {
    return (
      <View style={[styles.flex, styles.centered]}>
        <FadeInUp>
          <View style={styles.rewardWrap}>
            <Ulzii size={92} color={colors.primary} strokeWidth={5} />
            <Text style={styles.rewardTitle}>
              {xp > 0 ? 'Эхний ялалт!' : 'Сайн эхлэл!'}
            </Text>

            {xp > 0 ? (
              <CountUp value={xp} prefix="+" suffix=" XP" style={styles.rewardXp} />
            ) : (
              <Text style={styles.rewardMuted}>
                Санаа зоволтгүй — түүх сурах гэж энд ирсэн шүү дээ
              </Text>
            )}

            <CloudDivider width={240} opacity={0.85} />

            <Text style={styles.rewardNote}>
              Өдөр бүр 3 минут. Оноо цуглуулж баатруудыг нээ, гэрээ засаж
              найзуудтайгаа өрсөл.
            </Text>

            <PrimaryButton title="Үргэлжлүүлэх →" onPress={() => setStep('name')} />
          </View>
        </FadeInUp>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Нэр — ХАМГИЙН СҮҮЛД
  // ─────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.stepBadge}>Сүүлийн алхам</Text>
        <Text style={styles.question}>Чамайг юу гэж дуудах вэ?</Text>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Нүүдэлчин"
          placeholderTextColor={colors.textDim}
          maxLength={20}
          accessibilityLabel="Дэлгэцийн нэр"
        />
        <Text style={styles.hint}>
          Бодит нэрээ бичих албагүй — чансаанд энэ нэр харагдана
        </Text>

        <Text style={styles.label}>Аватар</Text>
        <View style={styles.avatarRow}>
          {AVATARS.map((a) => (
            <Pressable
              key={a}
              onPress={() => {
                selectFeedback();
                setAvatar(a);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Аватар ${a}`}
              accessibilityState={{ selected: avatar === a }}
              style={[styles.avatar, avatar === a && styles.avatarActive]}>
              <Text style={{ fontSize: 30 }}>{a}</Text>
            </Pressable>
          ))}
        </View>

        <PrimaryButton
          title={updateProfile.isPending ? 'Бэлдэж байна…' : 'Аялалаа эхэлье →'}
          disabled={updateProfile.isPending}
          onPress={() =>
            updateProfile.mutate(
              {
                displayName: name.trim() || 'Нүүдэлчин',
                avatarEmoji: avatar,
                onboardingDone: true,
              },
              {
                // Сервер хүлээж авсны ДАРАА л шилжинэ
                onSuccess: () => markOnboardingSeen(),
                /**
                 * ⚠ Сүлжээ унасан ч хэрэглэгчийг барихгүй. Профайл
                 * дараагийн холболтоор синк болно; энд гацаах нь
                 * аппыг бүрэн ашиглах боломжгүй болгоно.
                 */
                onError: () => markOnboardingSeen(),
              }
            )
          }
        />

        {updateProfile.isError && (
          <Text style={styles.errorNote}>
            Хадгалж чадсангүй. Дахин оролдоно уу.
          </Text>
        )}

        {eraName !== '' && (
          <Text style={styles.hint}>Сонгосон эрин: {eraName}</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  centered: { justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },

  brand: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  brandBand: { alignSelf: 'stretch' },
  logo: {
    fontFamily: fontFamily.display,
    color: colors.primary,
    fontSize: fontSize.xxl,
    letterSpacing: 3,
  },

  stepBadge: {
    color: colors.sky,
    fontSize: fontSize.sm,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  question: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '900',
    fontFamily: fontFamily.display,
  },
  hint: { color: colors.textMuted, fontSize: fontSize.sm },
  label: { color: colors.text, fontSize: fontSize.md, fontWeight: '700', marginTop: spacing.sm },

  // Эриний карт
  eraCard: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    padding: spacing.md,
    paddingLeft: spacing.md + 6,
    overflow: 'hidden',
    minHeight: 92,
    justifyContent: 'center',
  },
  eraStripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  eraName: { fontSize: fontSize.lg, fontWeight: '800', fontFamily: fontFamily.display },
  eraYears: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  eraDesc: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs, lineHeight: 18 },

  // Асуулт
  qBody: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700', lineHeight: 27 },
  option: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    padding: spacing.md,
    minHeight: 52,
    justifyContent: 'center',
  },
  optionCorrect: { borderColor: colors.success, backgroundColor: '#12301F' },
  optionWrong: { borderColor: colors.error, backgroundColor: '#301715' },
  optionText: { color: colors.text, fontSize: fontSize.md },
  explain: { color: colors.text, fontSize: fontSize.sm, lineHeight: 21 },
  source: { color: colors.textDim, fontSize: fontSize.xs, marginTop: spacing.sm, fontStyle: 'italic' },

  // Шагнал
  rewardWrap: { alignItems: 'center', gap: spacing.md, maxWidth: 340 },
  rewardTitle: {
    fontFamily: fontFamily.display,
    color: colors.text,
    fontSize: fontSize.xl,
  },
  rewardXp: {
    fontFamily: fontFamily.display,
    color: colors.primary,
    fontSize: fontSize.display,
    fontVariant: ['tabular-nums'],
  },
  rewardMuted: { color: colors.textMuted, fontSize: fontSize.md, textAlign: 'center' },
  rewardNote: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Нэр
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
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActive: { borderColor: colors.primary, backgroundColor: colors.bgCardLight },

  errorNote: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },
});
