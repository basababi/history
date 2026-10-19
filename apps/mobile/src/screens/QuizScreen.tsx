/**
 * Quiz дэлгэц — server-authoritative урсгал (Бүлэг 6.1)
 *
 * Клиент зөвхөн сонголтоо илгээнэ; зөв хариулт үр дүнгийн дараа л ирнэ.
 *
 * Засагдсан алдаанууд:
 *   №3 — сесс дуусахад ТҮГЖИГДЭХГҮЙ: SESSION_EXPIRED → сэргээх дэлгэц
 *   №4 — хурдан бонусыг сервер асуулт тус бүрийн servedAt-аас хэмжинэ
 *   №7 — 50/50 perk серверээс бодитоор ажиллана
 *   №15 — таймер хариулсны дараа ЦЭВЭРЛЭГДЭНЭ
 * Шинэ: метакогнитив итгэлийн үнэлгээ (Бүлэг 3.7), офлайн дараалал (6.6)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  AnswerResult,
  ConfidenceLevel,
  CreateSessionResponse,
  QuizMode,
  ServedQuestion,
} from '@nomad/contracts';
import { ApiError } from '@/api/client';
import {
  createQuizSession,
  requestFiftyFifty,
  submitAnswer,
} from '@/api/endpoints';
import { enqueueAttempt } from '@/offline/queue';
import { loadOfflinePack } from '@/offline/queue';
import { useGameStore } from '@/store/useGameStore';
import { Card, ErrorState, PrimaryButton, ProgressBar } from '@/components/ui';
import { CountUp } from '@/components/CountUp';
import { Animated, usePulse, useShake } from '@/components/motion';
import { comboFeedback, warnFeedback, wrongFeedback } from '@/feedback';
import { reportQuestion } from '@/api/endpoints';
import { MediationPanel } from '@/components/MediationPanel';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import type { RootScreenProps } from '@/navigation/types';

const QUESTION_TIME_SEC = 20;
const OPTION_PREFIX = ['А', 'Б', 'В', 'Г'];

type Phase = 'loading' | 'confidence' | 'answering' | 'result' | 'error';

type Props = RootScreenProps<'Quiz'>;

const CONFIDENCE_OPTIONS: Array<{
  level: ConfidenceLevel;
  emoji: string;
  label: string;
}> = [
  { level: 1, emoji: '🤔', label: 'Таамаглаж байна' },
  { level: 2, emoji: '🙂', label: 'Магадгүй' },
  { level: 3, emoji: '💪', label: 'Итгэлтэй байна' },
];

export default function QuizScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const mode: QuizMode = route.params?.mode ?? 'daily';
  const eraId = route.params?.eraId;
  const setOffline = useGameStore((s) => s.setOffline);

  const [session, setSession] = useState<CreateSessionResponse | null>(null);
  const [offlineQuestions, setOfflineQuestions] = useState<ServedQuestion[] | null>(
    null
  );
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const [index, setIndex] = useState(0);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  /** Дараалсан зөв хариултын тоо — combo тэмдэг (ROADMAP A2) */
  const [combo, setCombo] = useState(0);
  /** Буруу асуулт мэдээлсэн эсэх — G3 (Бүлэг 6.2) */
  const [reported, setReported] = useState(false);

  const pulse = usePulse();
  const shake = useShake();
  const [hiddenIndexes, setHiddenIndexes] = useState<number[]>([]);
  const [fiftyUsed, setFiftyUsed] = useState(false);

  const [totalXp, setTotalXp] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_SEC);

  const questionShownAt = useRef(Date.now());

  const questions = session?.questions ?? offlineQuestions ?? [];
  const question = questions[index];
  const isOfflineMode = session === null && offlineQuestions !== null;

  const perQuestionSec =
    QUESTION_TIME_SEC + (session?.extraSecondsPerQuestion ?? 0);

  // ─── Сесс эхлүүлэх ───
  const startSession = useCallback(async () => {
    setPhase('loading');
    setErrorMsg(null);
    setSessionExpired(false);
    try {
      const s = await createQuizSession({ mode, eraId, questionCount: 10 });
      setSession(s);
      setOfflineQuestions(null);
      setOffline(false);
      setIndex(0);
      setTotalXp(0);
      setCorrectCount(0);
      setFiftyUsed(false);
      resetQuestionState();
      setPhase('confidence');
    } catch (err) {
      // Сүлжээгүй → офлайн багц руу шилжинэ (Бүлэг 6.6)
      if (err instanceof ApiError && (err.isOffline || err.code === 'TIMEOUT')) {
        const cached = await loadOfflinePack();
        if (cached.length > 0) {
          setOffline(true);
          setOfflineQuestions(cached.slice(0, 10));
          setSession(null);
          setIndex(0);
          setTotalXp(0);
          setCorrectCount(0);
          resetQuestionState();
          setPhase('confidence');
          return;
        }
      }
      setErrorMsg(
        err instanceof ApiError ? err.message : 'Сорил эхлүүлж чадсангүй'
      );
      setPhase('error');
    }
  }, [mode, eraId, setOffline]);

  useEffect(() => {
    void startSession();
  }, [startSession]);

  function resetQuestionState() {
    setConfidence(null);
    setSelected(null);
    setResult(null);
    setHiddenIndexes([]);
  }

  // ─── Таймер (алдааны засвар №15: хариулсны дараа ЦЭВЭРЛЭГДЭНЭ) ───
  useEffect(() => {
    if (phase !== 'answering') return;

    questionShownAt.current = Date.now();
    setTimeLeft(perQuestionSec);

    const startedAt = Date.now();
    const iv = setInterval(() => {
      const left = perQuestionSec - (Date.now() - startedAt) / 1000;
      if (left <= 0) {
        clearInterval(iv);
        void handleSelect(-1); // хугацаа дуусав
      } else {
        setTimeLeft(Math.ceil(left));
      }
    }, 250);

    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index]);

  // ─── Хариулт илгээх ───
  async function handleSelect(optionIndex: number) {
    if (selected !== null || result !== null || !question) return;
    setSelected(optionIndex);

    const responseMs = Date.now() - questionShownAt.current;

    // Офлайн горим — дараалалд хийж, дараа sync хийнэ
    if (isOfflineMode) {
      await enqueueAttempt({
        questionId: question.id,
        selectedIndex: optionIndex,
        confidenceLevel: confidence ?? undefined,
        answeredAt: Date.now(),
        responseMs,
      });
      // Офлайнд зөв хариултыг МЭДЭХГҮЙ — сервер л оноолно
      setResult({
        questionId: question.id,
        isCorrect: false,
        correctIndex: -1,
        xpAwarded: 0,
        timeBonusApplied: false,
        eraBonusApplied: false,
        responseMs,
        explanation:
          'Офлайн горимд байна. Сүлжээ сэргэхэд сервер таны хариултыг оноолж, оноог нэмнэ.',
        sourceRef: '—',
      });
      setPhase('result');
      return;
    }

    if (!session) return;

    try {
      const res = await submitAnswer({
        token: session.token,
        questionId: question.id,
        selectedIndex: optionIndex,
        confidenceLevel: confidence ?? undefined,
      });
      setResult(res);
      setPhase('result');
      setReported(false);

      // ROADMAP A2: зөв → цохилт + чичиргээ; буруу → сэгсрэлт
      if (res.isCorrect) {
        setCorrectCount((c) => c + 1);
        setTotalXp((x) => x + res.xpAwarded);
        const next = combo + 1;
        setCombo(next);
        comboFeedback(next);
        pulse.pulse();
      } else {
        setCombo(0);
        if (optionIndex === -1) warnFeedback();
        else wrongFeedback();
        shake.shake();
      }
    } catch (err) {
      // ⚠ Алдааны засвар №3: сесс дуусахад ТҮГЖИГДЭХГҮЙ
      if (err instanceof ApiError && err.isSessionExpired) {
        setSessionExpired(true);
        setPhase('error');
        setErrorMsg(err.message);
        return;
      }
      if (err instanceof ApiError && err.code === 'ALREADY_ANSWERED') {
        handleNext();
        return;
      }
      setSelected(null);
      setErrorMsg(
        err instanceof ApiError ? err.message : 'Хариулт илгээж чадсангүй'
      );
      setPhase('error');
    }
  }

  // ─── 50/50 perk (алдааны засвар №7) ───
  async function handleFiftyFifty() {
    if (!session || fiftyUsed || !question) return;
    try {
      const res = await requestFiftyFifty({
        token: session.token,
        questionId: question.id,
      });
      setHiddenIndexes(res.hiddenIndexes);
      setFiftyUsed(true);
    } catch {
      setFiftyUsed(true); // дахин оролдохгүй
    }
  }

  function handleNext() {
    if (index + 1 >= questions.length) {
      navigation.replace('Result', {
        token: session?.token ?? null,
        offline: isOfflineMode,
        localXp: totalXp,
        localCorrect: correctCount,
        total: questions.length,
      });
      return;
    }
    setIndex((i) => i + 1);
    resetQuestionState();
    setPhase('confidence');
  }

  // ─── Рендер ───

  if (phase === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Сорил бэлдэж байна…</Text>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ErrorState
          emoji={sessionExpired ? '⏳' : '⚠️'}
          title={sessionExpired ? 'Сессийн хугацаа дууслаа' : 'Алдаа гарлаа'}
          message={
            errorMsg ??
            'Тодорхойгүй алдаа. Дахин оролдоно уу.'
          }
          actionLabel={sessionExpired ? 'Шинэ сорил эхлүүлэх' : 'Дахин оролдох'}
          onAction={() => void startSession()}
          secondaryLabel="Нүүр рүү буцах"
          onSecondary={() => navigation.popToTop()}
        />
      </View>
    );
  }

  if (!question) {
    return (
      <View style={styles.center}>
        <ErrorState
          emoji="📭"
          title="Асуулт олдсонгүй"
          message="Одоогоор нийтлэгдсэн асуулт байхгүй байна."
          actionLabel="Нүүр рүү"
          onAction={() => navigation.popToTop()}
        />
      </View>
    );
  }

  // ─── Итгэлийн үнэлгээ (Бүлэг 3.7 метакогнитив дэмжлэг) ───
  if (phase === 'confidence') {
    return (
      <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.confidenceWrap}>
          <Text style={styles.counter}>
            Асуулт {index + 1}/{questions.length}
          </Text>
          <Card style={{ marginVertical: spacing.lg }}>
            <Text style={styles.question}>{question.body}</Text>
          </Card>
          <Text style={styles.confidencePrompt}>
            Хариулахаасаа өмнө — хэр итгэлтэй байна вэ?
          </Text>
          <Text style={styles.confidenceHint}>
            Итгэлтэй байж алдсан асуулт давтах дараалалд эрт орно.
          </Text>
          <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
            {CONFIDENCE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.level}
                style={styles.confidenceBtn}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
                onPress={() => {
                  setConfidence(opt.level);
                  setPhase('answering');
                }}>
                <Text style={{ fontSize: 26 }}>{opt.emoji}</Text>
                <Text style={styles.confidenceLabel}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  }

  const timeRatio = timeLeft / perQuestionSec;

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topBar}>
        <Text style={styles.counter}>
          {index + 1}/{questions.length}
        </Text>
        <View style={{ flex: 1 }}>
          <ProgressBar progress={(index + 1) / questions.length} />
        </View>
        {phase === 'answering' && (
          <Text
            style={[styles.timer, timeRatio < 0.25 && { color: colors.error }]}
            accessibilityLabel={`Үлдсэн хугацаа ${timeLeft} секунд`}>
            ⏱ {timeLeft}
          </Text>
        )}
      </View>

      {isOfflineMode && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            📴 Офлайн горим — сүлжээ сэргэхэд оноо тооцогдоно
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.container}>
        <Card accent={colors.primary} glow>
          <Text style={styles.question}>{question.body}</Text>
        </Card>

        {session?.fiftyFiftyAvailable && !fiftyUsed && phase === 'answering' && (
          <TouchableOpacity
            style={styles.perkBtn}
            accessibilityRole="button"
            accessibilityLabel="50/50 чадвар ашиглах"
            onPress={() => void handleFiftyFifty()}>
            <Text style={styles.perkBtnText}>✂️ 50/50 ашиглах (өдөрт 1)</Text>
          </TouchableOpacity>
        )}

        <View style={styles.options}>
          {question.options.map((opt, i) => {
            if (hiddenIndexes.includes(i)) return null;

            let bg = colors.bgCard;
            let border = colors.border;
            let badgeBg = 'rgba(255,255,255,0.06)';
            let badgeColor = colors.textMuted;

            if (result && result.correctIndex === i) {
              bg = 'rgba(78, 203, 113, 0.16)';
              border = colors.success;
              badgeBg = colors.success;
              badgeColor = '#080E18';
            } else if (result && i === selected && !result.isCorrect) {
              bg = 'rgba(235, 87, 87, 0.16)';
              border = colors.error;
              badgeBg = colors.error;
              badgeColor = '#FFFFFF';
            } else if (selected === i) {
              border = colors.primary;
              bg = 'rgba(221, 176, 88, 0.1)';
              badgeBg = colors.primary;
              badgeColor = '#080E18';
            }

            return (
              <TouchableOpacity
                key={i}
                onPress={() => void handleSelect(i)}
                disabled={selected !== null}
                accessibilityRole="button"
                accessibilityLabel={opt}
                style={[styles.option, { backgroundColor: bg, borderColor: border }]}>
                <View style={[styles.optionBadge, { backgroundColor: badgeBg }]}>
                  <Text style={[styles.optionBadgeText, { color: badgeColor }]}>
                    {OPTION_PREFIX[i] ?? i + 1}
                  </Text>
                </View>
                <Text style={styles.optionText}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {result && (
          <Animated.View style={result.isCorrect ? pulse.style : shake.style}>
          <Card
            style={styles.explainCard}
            accent={result.isCorrect ? colors.success : colors.error}
            glow>
            <Text
              style={[
                styles.resultTitle,
                {
                  color: isOfflineMode
                    ? colors.textMuted
                    : result.isCorrect
                      ? colors.success
                      : colors.error,
                },
              ]}>
              {isOfflineMode
                ? '📴 Хариулт хадгалагдлаа'
                : result.isCorrect
                  ? '✓ Зөв!'
                  : selected === -1
                    ? '⏱ Хугацаа дууслаа'
                    : '✗ Буруу'}
            </Text>

            {/* ROADMAP A2: XP шууд гарахгүй — өсөж тоологдоно */}
            {!isOfflineMode && result.isCorrect && result.xpAwarded > 0 && (
              <View style={styles.xpRow}>
                <CountUp
                  value={result.xpAwarded}
                  prefix="+"
                  suffix=" XP"
                  style={styles.xpValue}
                />
                {result.timeBonusApplied && (
                  <Text style={styles.xpBonus}>⚡ хурдан ×1.5</Text>
                )}
                {result.eraBonusApplied && (
                  <Text style={styles.xpBonus}>🏛 эриний бонус</Text>
                )}
                {combo >= 3 && (
                  <Text style={styles.combo}>🔥 ×{combo} дараалан!</Text>
                )}
              </View>
            )}
            <Text style={styles.explanation}>{result.explanation}</Text>
            {result.sourceRef !== '—' && (
              <Text style={styles.source}>📚 Эх сурвалж: {result.sourceRef}</Text>
            )}
            {/* C1 · Зуучлал — зөв хариулсны ДАРАА л урина. Буруу хариулсан
                хүнээс тайлбарла гэж шаардах нь шийтгэл мэт мэдрэгдэнэ.
                Офлайн үед сервер байхгүй тул харуулахгүй. */}
            {result.isCorrect && !isOfflineMode && (
              <MediationPanel questionId={question.id} />
            )}

            <PrimaryButton
              title={index + 1 >= questions.length ? 'Дүнг харах →' : 'Үргэлжлүүлэх →'}
              onPress={handleNext}
            />

            {/* G3 · Бүлэг 6.2: олон нийтийн хяналтын давхарга.
                ⚠ Бүлэг 6.3: мэдээлэхэд XP ОГТ олгохгүй */}
            {!isOfflineMode && (
              <Pressable
                onPress={() => {
                  if (reported) return;
                  setReported(true);
                  void reportQuestion({
                    questionId: question.id,
                    reason: 'factually_wrong',
                  }).catch(() => undefined);
                }}
                disabled={reported}
                accessibilityRole="button"
                accessibilityLabel="Энэ асуулт буруу байна гэж мэдээлэх"
                style={styles.reportBtn}>
                <Text style={styles.reportText}>
                  {reported ? '✓ Мэдэгдлээ, баярлалаа' : '⚠ Энэ асуулт буруу байна'}
                </Text>
              </Pressable>
            )}
          </Card>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  xpValue: {
    color: colors.primary,
    fontSize: fontSize.xl,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  xpBonus: {
    color: colors.sky,
    fontSize: fontSize.sm - 1,
    fontWeight: '700',
  },
  combo: {
    color: colors.primaryLight,
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  reportBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportText: {
    color: colors.textDim,
    fontSize: fontSize.sm - 1,
  },
  flex: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
    padding: spacing.md,
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: spacing.md,
    fontSize: fontSize.sm,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  counter: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '700' },
  timer: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '800',
    minWidth: 52,
    textAlign: 'right',
  },
  offlineBanner: {
    backgroundColor: colors.bgCardLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  offlineText: { color: colors.textMuted, fontSize: fontSize.sm - 1, textAlign: 'center' },
  container: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  question: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    lineHeight: 28,
  },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    gap: spacing.sm,
  },
  optionBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(221, 176, 88, 0.25)',
  },
  optionBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    fontFamily: fontFamily.display,
  },
  optionText: { flex: 1, color: colors.text, fontSize: fontSize.md },
  perkBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bgCardLight,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  perkBtnText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700' },
  explainCard: { borderColor: colors.primaryDark },
  resultTitle: { fontSize: fontSize.md, fontWeight: '800', marginBottom: spacing.sm },
  explanation: {
    color: colors.text,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  source: {
    color: colors.textMuted,
    fontSize: fontSize.sm - 2,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  confidenceWrap: { flex: 1, padding: spacing.md, justifyContent: 'center' },
  confidencePrompt: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
    textAlign: 'center',
  },
  confidenceHint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  confidenceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 48,
  },
  confidenceLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
});
