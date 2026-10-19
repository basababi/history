/**
 * Тоглох — өдрийн таван асуулт
 *
 * Сервер асуулт бүрийг НЭГ НЭГЭЭР нээж, хугацааг өөрөө хэмжинэ. Клиент
 * зөвхөн харагдах индексээ илгээнэ; зөв хариулт хариулсны ДАРАА л ирнэ.
 * Хуудсаа сэргээвэл ижил асуулт үлдсэн хугацаатайгаа гарна.
 *
 * Тайлбар уншиж буй хугацаа тооцогдохгүй — дараагийн асуулт «Дараах»-ыг
 * дарсны дараа л нээгдэнэ. Суралцахыг шийтгэхгүй.
 *
 * Вэб дээр гараар тоглож болно: 1–4 (эсвэл А–Г) сонгоно, Enter — дараах.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QUESTION_FORMAT_LABEL } from '@nomad/core';
import type { DailyAnswerResult, DailyQuestion } from '@nomad/contracts';
import { ApiError } from '@/api/client';
import { openNextQuestion, reportDailyQuestion, submitDailyAnswer } from '@/api/game';
import { Card, ErrorState, Loading, PrimaryButton, ProgressBar } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Animated, FadeInUp, usePulse, useShake } from '@/components/motion';
import { ScoreMarks } from '@/components/game/ScoreMarks';
import { Chip } from '@/components/game/bits';
import { comboFeedback, warnFeedback, wrongFeedback } from '@/feedback';
import { useInvalidateAfterPlay } from '@/hooks/game';
import { formatPercent, formatSeconds } from '@/lib/format';
import type { AppScreenProps } from '@/navigation/routes';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];
const KEY_TO_INDEX: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3, а: 0, б: 1, в: 2, г: 3 };

type Phase = 'loading' | 'question' | 'submitting' | 'feedback' | 'error';

/** Хулгана/гартай төхөөрөмж (компьютер) — утсанд гарын зөвлөмж хэрэггүй */
const HAS_KEYBOARD =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: fine)').matches;

export default function PlayScreen({ navigation, route }: AppScreenProps<'Play'>) {
  const { dayKey, challengeCode } = route.params;
  const insets = useSafeAreaInsets();
  const invalidate = useInvalidateAfterPlay();

  const [phase, setPhase] = useState<Phase>('loading');
  const [question, setQuestion] = useState<DailyQuestion | null>(null);
  const [marks, setMarks] = useState<boolean[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<DailyAnswerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [reported, setReported] = useState(false);
  const [combo, setCombo] = useState(0);

  const deadline = useRef(0);
  const firstOpen = useRef(true);
  const busy = useRef(false);
  const pulse = usePulse();
  const shake = useShake();

  const goResult = useCallback(() => {
    invalidate();
    navigation.replace('Result', { dayKey });
  }, [invalidate, navigation, dayKey]);

  // ─── Дараагийн асуулт нээх ───
  const openNext = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      const res = await openNextQuestion({
        dayKey,
        // Сорилтын код зөвхөн АНХНЫ нээлтэд — сервер ч мөн адил хамгаална
        ...(firstOpen.current && challengeCode ? { challengeCode } : {}),
      });
      firstOpen.current = false;
      if (res.done) {
        goResult();
        return;
      }
      setQuestion(res.question);
      setMarks(res.marks);
      setSelected(null);
      setResult(null);
      setReported(false);
      deadline.current = Date.now() + res.question.remainingMs;
      setTimeLeft(res.question.remainingMs);
      setPhase('question');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Асуулт нээж чадсангүй');
      setPhase('error');
    }
  }, [dayKey, challengeCode, goResult]);

  // Анхны асуултыг НЭГ л удаа нээнэ — callback-ийн хамаарал өөрчлөгдсөн ч
  // дахин дуудахгүй (дахин дуудвал хариулсан асуулт алгасагдана)
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void openNext();
  }, [openNext]);

  // ─── Хариулах ───
  const answer = useCallback(
    async (displayIndex: number) => {
      if (!question || busy.current) return;
      busy.current = true;
      setSelected(displayIndex);
      setPhase('submitting');
      try {
        const res = await submitDailyAnswer({ dayKey, position: question.position, selectedIndex: displayIndex });
        setResult(res);
        setMarks((m) => (m.length > question.position ? m : [...m, res.isCorrect]));
        setPhase('feedback');
        if (res.isCorrect) {
          const next = combo + 1;
          setCombo(next);
          comboFeedback(next);
          pulse.pulse();
        } else {
          setCombo(0);
          if (res.timedOut) warnFeedback();
          else wrongFeedback();
          shake.shake();
        }
      } catch (err) {
        // Асуулт нээгдээгүй / тоглолт олдоогүй — серверийн төлөвөөс дахин эхэлнэ
        if (err instanceof ApiError && (err.code === 'NOT_SERVED' || err.code === 'NO_PLAY')) {
          void openNext();
          return;
        }
        setSelected(null);
        setError(err instanceof ApiError ? err.message : 'Хариулт илгээж чадсангүй');
        setPhase('error');
      } finally {
        busy.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pulse/shake нь тогтвортой
    [question, dayKey, combo, openNext]
  );

  // ─── Таймер ───
  useEffect(() => {
    if (phase !== 'question') return;
    const iv = setInterval(() => {
      const left = Math.max(0, deadline.current - Date.now());
      setTimeLeft(left);
      if (left <= 0) {
        clearInterval(iv);
        void answer(-1);
      }
    }, 200);
    return () => clearInterval(iv);
  }, [phase, answer]);

  const advance = useCallback(() => {
    if (result?.finished) goResult();
    else void openNext();
  }, [result, goResult, openNext]);

  // ─── Вэбийн гар ───
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (phase === 'question' && question) {
        const idx = KEY_TO_INDEX[e.key.toLowerCase()];
        if (idx !== undefined && idx < question.options.length) {
          e.preventDefault();
          void answer(idx);
        }
      } else if (phase === 'feedback' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, question, answer, advance]);

  function close() {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Tabs');
  }

  // ─── Рендер ───

  if (phase === 'loading' && !question) {
    return (
      <View style={styles.center}>
        <Loading label="Асуулт нээж байна…" />
      </View>
    );
  }

  if (phase === 'error' || !question) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ErrorState
          icon="offline"
          title="Алдаа гарлаа"
          message={error ?? 'Дахин оролдоно уу.'}
          actionLabel="Дахин оролдох"
          onAction={() => void openNext()}
          secondaryLabel="Нүүр рүү"
          onSecondary={close}
        />
      </View>
    );
  }

  const answered = phase === 'feedback' && result !== null;
  const ratio = question.timeLimitMs > 0 ? timeLeft / question.timeLimitMs : 0;
  const seconds = Math.ceil(timeLeft / 1000);
  const binary = question.format === 'myth_or_fact' && question.options.length === 2;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      {/* ─── Дээд мөр ─── */}
      <View style={styles.topBar}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Хаах" style={styles.iconBtn}>
          <Icon name="cross" size={22} color={colors.textMuted} />
        </Pressable>
        <ScoreMarks marks={marks} total={question.total} size={18} current={question.position} />
        <View
          style={[styles.timer, seconds <= 5 && !answered && styles.timerUrgent]}
          accessibilityLabel={`Үлдсэн хугацаа ${seconds} секунд`}>
          <Icon name="clock" size={16} color={seconds <= 5 && !answered ? colors.accent : colors.text} strokeWidth={2.1} />
          <Text style={[styles.timerText, seconds <= 5 && !answered && { color: colors.accent }]}>
            {answered ? '—' : seconds}
          </Text>
        </View>
      </View>
      <View style={styles.timeBar}>
        <ProgressBar plain progress={answered ? 0 : ratio} color={seconds <= 5 ? colors.accent : colors.primary} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.chips}>
          <Chip label={QUESTION_FORMAT_LABEL[question.format]} tone="gold" />
          <Chip label={question.eraName} />
          <Text style={styles.counter}>
            {question.position + 1}/{question.total}
          </Text>
        </View>

        <Text style={styles.question} accessibilityRole="header">
          {question.body}
        </Text>

        <View style={[styles.options, binary && styles.optionsBinary]}>
          {question.options.map((opt, i) => {
            const isCorrect = answered && result.correctIndex === i;
            const isWrongPick = answered && selected === i && !result.isCorrect;
            const isPicked = !answered && selected === i;
            const dim = answered && !isCorrect && !isWrongPick;
            return (
              <Pressable
                key={`${question.questionId}-${i}`}
                onPress={() => void answer(i)}
                disabled={phase !== 'question'}
                accessibilityRole="button"
                accessibilityLabel={`${LETTERS[i] ?? i + 1}. ${opt}`}
                accessibilityState={{ disabled: phase !== 'question', selected: selected === i }}
                style={({ pressed }) => [
                  styles.option,
                  binary && styles.optionBinary,
                  pressed && phase === 'question' && styles.optionPressed,
                  isPicked && styles.optionPicked,
                  isCorrect && styles.optionCorrect,
                  isWrongPick && styles.optionWrong,
                  dim && styles.optionDim,
                ]}>
                {!binary && (
                  <View
                    style={[
                      styles.badge,
                      isCorrect && { backgroundColor: colors.success, borderColor: colors.success },
                      isWrongPick && { backgroundColor: colors.error, borderColor: colors.error },
                    ]}>
                    <Text style={[styles.badgeText, (isCorrect || isWrongPick) && { color: colors.bg }]}>
                      {LETTERS[i] ?? i + 1}
                    </Text>
                  </View>
                )}
                <Text style={[styles.optionText, binary && styles.optionTextBinary]}>{opt}</Text>
                {isCorrect && <Icon name="check" size={20} color={colors.success} strokeWidth={2.4} />}
              </Pressable>
            );
          })}
        </View>

        {phase === 'submitting' && <Loading />}

        {answered && (
          <FadeInUp>
            <Animated.View style={result.isCorrect ? pulse.style : shake.style}>
              <Card accent={result.isCorrect ? colors.success : result.timedOut ? colors.warning : colors.error} glow>
                <View style={styles.feedbackHead}>
                  <Text
                    style={[
                      styles.feedbackTitle,
                      { color: result.isCorrect ? colors.success : result.timedOut ? colors.warning : colors.error },
                    ]}>
                    {result.isCorrect ? 'Зөв!' : result.timedOut ? 'Хугацаа дууслаа' : 'Буруу'}
                  </Text>
                  {!result.timedOut && <Text style={styles.feedbackTime}>{formatSeconds(result.responseMs)}</Text>}
                </View>

                <Text style={styles.explanation}>{result.explanation}</Text>

                <View style={styles.sourceRow}>
                  <Icon name="book" size={15} color={colors.textMuted} />
                  <Text style={styles.source}>{result.sourceRef}</Text>
                </View>

                {result.correctRate !== null && (
                  <Text style={styles.rate}>Өнөөдөр {formatPercent(result.correctRate)} нь зөв хариулсан</Text>
                )}

                <View style={styles.nextBtn}>
                  <PrimaryButton title={result.finished ? 'Дүнгээ харах' : 'Дараагийн асуулт'} onPress={advance} />
                </View>

                <Pressable
                  onPress={() => {
                    if (reported) return;
                    setReported(true);
                    void reportDailyQuestion({ questionId: question.questionId, reason: 'factually_wrong' }).catch(
                      () => undefined
                    );
                  }}
                  disabled={reported}
                  accessibilityRole="button"
                  accessibilityLabel="Энэ асуултад алдаа байна гэж мэдээлэх"
                  style={styles.report}>
                  <Text style={styles.reportText}>
                    {reported ? 'Баярлалаа — түүхч шалгана' : 'Энэ асуултад алдаа байна уу?'}
                  </Text>
                </Pressable>
              </Card>
            </Animated.View>
          </FadeInUp>
        )}

        {HAS_KEYBOARD && phase === 'question' && (
          <Text style={styles.keysHint}>Гараар: 1–{question.options.length} товч</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.md },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 64,
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  timerUrgent: { borderColor: colors.accent, backgroundColor: 'rgba(230, 92, 62, 0.1)' },
  timerText: { color: colors.text, fontFamily: fontFamily.display, fontSize: fontSize.md, fontVariant: ['tabular-nums'] },
  timeBar: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, maxWidth: 680, width: '100%', alignSelf: 'center' },

  container: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 680, width: '100%', alignSelf: 'center' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  counter: { marginLeft: 'auto', color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '700' },
  question: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
    lineHeight: fontSize.xl * 1.32,
    marginVertical: spacing.sm,
  },

  options: { gap: spacing.sm },
  optionsBinary: { flexDirection: 'row' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 58,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  optionBinary: { flex: 1, justifyContent: 'center', minHeight: 84 },
  optionPressed: { borderColor: colors.primary, backgroundColor: 'rgba(221, 176, 88, 0.08)' },
  optionPicked: { borderColor: colors.primary, backgroundColor: 'rgba(221, 176, 88, 0.12)' },
  optionCorrect: { borderColor: colors.success, backgroundColor: 'rgba(56, 193, 114, 0.14)' },
  optionWrong: { borderColor: colors.error, backgroundColor: 'rgba(240, 82, 82, 0.14)' },
  optionDim: { opacity: 0.5 },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  badgeText: { color: colors.primaryLight, fontFamily: fontFamily.display, fontSize: fontSize.sm },
  optionText: { flex: 1, color: colors.text, fontSize: fontSize.md, lineHeight: 22 },
  optionTextBinary: { flex: 0, fontFamily: fontFamily.display, fontSize: fontSize.lg, textAlign: 'center' },

  feedbackHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm },
  feedbackTitle: { fontFamily: fontFamily.display, fontSize: fontSize.lg },
  feedbackTime: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '700' },
  explanation: { color: colors.text, fontSize: fontSize.md, lineHeight: 23 },
  sourceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: spacing.sm },
  source: { flex: 1, color: colors.textMuted, fontSize: fontSize.sm - 1, fontStyle: 'italic', lineHeight: 18 },
  rate: { color: colors.sky, fontSize: fontSize.sm, fontWeight: '700', marginTop: spacing.sm },
  nextBtn: { marginTop: spacing.md },
  report: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  reportText: { color: colors.textDim, fontSize: fontSize.sm - 1 },
  keysHint: { color: colors.textDim, fontSize: fontSize.xs + 1, textAlign: 'center' },
});
