/**
 * PvP тулаан — 1 vs 1 (Бүлэг 7.3)
 *
 * 🔴 АЛДААНЫ ЗАСВАР №2: өмнөх хувилбарт `selected` state тойрог хооронд
 * reset хийгддэггүй байсан тул 1-р тойргийн дараа БҮРЭН ТҮГЖДЭГ байв.
 * 5 тойрог хэзээ ч дуусахгүй, эцсийн дүн харагдахгүй. `forceRender`
 * анти-паттерн бүрэн устсан — одоо цэвэр React төлөв.
 *
 * ⚠ ХЯЗГААР: бодит real-time PvP (Ably/Socket.io) хараахан холбогдоогүй.
 * Өрсөлдөгч нь серверийн талын бот. Оноолт бүрэн server-authoritative.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  applyRound,
  BATTLE_ROUNDS,
  battleResult,
  emptyTally,
  type BattleTally,
  type RoundWinner,
} from '@nomad/core';
import type { CreateSessionResponse } from '@nomad/contracts';
import { ApiError, apiRequest } from '@/api/client';
import { createQuizSession } from '@/api/endpoints';
import { Card, ErrorState, Loading, PrimaryButton } from '@/components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { z } from 'zod';
import type { RootScreenProps } from '@/navigation/types';

const RoundResultSchema = z.object({
  playerCorrect: z.boolean(),
  opponentCorrect: z.boolean(),
  playerMs: z.number(),
  opponentMs: z.number(),
  winner: z.enum(['player', 'opponent', 'none']),
  correctIndex: z.number().int(),
  explanation: z.string(),
  opponentIsBot: z.boolean(),
});
type RoundResult = z.infer<typeof RoundResultSchema>;

type Props = RootScreenProps<'Battle'>;

export default function BattleScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState<CreateSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [tally, setTally] = useState<BattleTally>(emptyTally());
  const [selected, setSelected] = useState<number | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const question = session?.questions[tally.round];

  const start = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    setTally(emptyTally());
    setSelected(null);
    setRoundResult(null);
    try {
      const s = await createQuizSession({
        mode: 'battle',
        questionCount: BATTLE_ROUNDS,
      });
      setSession(s);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError ? err.message : 'Тулаан эхлүүлж чадсангүй'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void start();
  }, [start]);

  async function answer(optionIndex: number) {
    if (selected !== null || submitting || !session || !question) return;
    setSelected(optionIndex);
    setSubmitting(true);

    try {
      const res = await apiRequest('/api/battle/round', RoundResultSchema, {
        method: 'POST',
        body: {
          token: session.token,
          questionId: question.id,
          selectedIndex: optionIndex,
        },
      });
      setRoundResult(res);
    } catch (err) {
      setSelected(null);
      setErrorMsg(
        err instanceof ApiError ? err.message : 'Тойрог илгээж чадсангүй'
      );
    } finally {
      setSubmitting(false);
    }
  }

  /** ✅ Дараагийн тойрог — selected БОЛОН roundResult ХОЁУЛАА цэвэрлэгдэнэ */
  function nextRound(winner: RoundWinner) {
    setTally((t) => applyRound(t, winner));
    setSelected(null);
    setRoundResult(null);
  }

  if (loading) return <Loading label="Өрсөлдөгч хайж байна…" />;

  if (errorMsg && !session) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ErrorState
          title="Тулаан эхэлсэнгүй"
          message={errorMsg}
          actionLabel="Дахин оролдох"
          onAction={() => void start()}
          secondaryLabel="Нүүр рүү"
          onSecondary={() => navigation.popToTop()}
        />
      </View>
    );
  }

  // ─── Тулаан дууссан ───
  if (tally.finished || !question) {
    const result = battleResult(tally);
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={{ fontSize: 64 }}>
          {result === 'win' ? '🏆' : result === 'draw' ? '🤝' : '💪'}
        </Text>
        <Text style={styles.title}>
          {result === 'win'
            ? 'Та яллаа!'
            : result === 'draw'
              ? 'Тэнцлээ'
              : 'Хожигдлоо — дараагийн удаа!'}
        </Text>
        <Text style={styles.scoreLine}>
          {tally.playerScore} : {tally.opponentScore}
        </Text>
        <View style={{ gap: spacing.sm, alignSelf: 'stretch', padding: spacing.lg }}>
          <PrimaryButton title="Дахин тулаанах" onPress={() => void start()} />
          <PrimaryButton
            title="Нүүр рүү"
            variant="ghost"
            onPress={() => navigation.popToTop()}
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.sm },
      ]}>
      <View style={styles.scoreboard}>
        <Text style={styles.scoreSide}>Та {tally.playerScore}</Text>
        <Text style={styles.roundNote}>
          Тойрог {tally.round + 1}/{BATTLE_ROUNDS}
        </Text>
        <Text style={styles.scoreSide}>Бот {tally.opponentScore}</Text>
      </View>

      <Text style={styles.botNote}>
        🤖 Одоогоор ботын эсрэг. Бодит хүнтэй тулаан удахгүй нэмэгдэнэ.
      </Text>

      <Card>
        <Text style={styles.question}>{question.body}</Text>
      </Card>

      <View style={{ gap: spacing.sm }}>
        {question.options.map((opt, i) => {
          let border = colors.border;
          let bg = colors.bgCard;
          if (roundResult) {
            if (i === roundResult.correctIndex) {
              border = colors.success;
              bg = '#1d3a1f';
            } else if (i === selected) {
              border = colors.error;
              bg = '#3a1d1d';
            }
          } else if (i === selected) {
            border = colors.primary;
          }

          return (
            <TouchableOpacity
              key={i}
              onPress={() => void answer(i)}
              disabled={selected !== null}
              accessibilityRole="button"
              accessibilityLabel={opt}
              style={[styles.option, { borderColor: border, backgroundColor: bg }]}>
              <Text style={styles.optionText}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {roundResult && (
        <Card style={styles.roundResult}>
          <Text style={styles.roundResultText}>
            {roundResult.winner === 'player'
              ? '✓ Та энэ тойргийг авлаа!'
              : roundResult.winner === 'opponent'
                ? `✗ Бот ${(roundResult.opponentMs / 1000).toFixed(1)} сек-т түрүүллээ`
                : '— Тойрог тэнцлээ'}
          </Text>
          <Text style={styles.explanation}>{roundResult.explanation}</Text>
          <PrimaryButton
            title={
              tally.round + 1 >= BATTLE_ROUNDS
                ? 'Эцсийн дүнг харах →'
                : 'Дараагийн тойрог →'
            }
            onPress={() => nextRound(roundResult.winner)}
          />
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  scoreboard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreSide: { color: colors.text, fontSize: fontSize.md, fontWeight: '800' },
  roundNote: { color: colors.textMuted, fontSize: fontSize.sm },
  botNote: {
    color: colors.textMuted,
    fontSize: fontSize.sm - 2,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  question: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    lineHeight: 28,
  },
  option: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  optionText: { color: colors.text, fontSize: fontSize.md },
  roundResult: { borderColor: colors.primaryDark, gap: spacing.sm },
  roundResultText: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  explanation: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 19 },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '900', fontFamily: fontFamily.display, },
  scoreLine: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
});
