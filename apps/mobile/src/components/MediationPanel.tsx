/**
 * «Дүү нартаа тайлбарла» — зуучлалын самбар (ROADMAP C1)
 *
 * СУДАЛГААНЫ ҮНДЭСЛЭЛ: López-Enríquez нарын тоймд 105 баримтын нэг нь ч
 * CEFR-ийн зуучлалыг хэмжээгүй. Энэ бол дипломын шинэлэг талын гол механик.
 *
 * ЗОХИОМЖИЙН ГОЛ ЗАРЧИМ:
 *   • Заавал биш — алгасаж болно. Албадвал сурах бус, төвөг болно.
 *   • «Унасан» гэж хэзээ ч хэлэхгүй — дахин оролдох урилга л байна.
 *   • Хуулж буулгавал ил хэлнэ. Ойлгосон эсэхийг хуулбар нотлохгүй.
 *   • Бичсэн текст өөр хэрэглэгчид ХАРАГДАХГҮЙ — модерацийн эрсдэлгүй.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import type { MediationResult } from '@nomad/contracts';
import { submitMediation } from '@/api/endpoints';
import { Card } from '@/components/ui';
import { FadeInUp } from '@/components/motion';
import { OrnamentDivider } from '@/components/Ornament';
import { correctFeedback, tapFeedback, warnFeedback } from '@/feedback';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

/** Сервертэй ижил хязгаар — MEDIATION_MAX_CHARS */
const MAX_CHARS = 280;
const MIN_CHARS = 20;

export function MediationPanel({ questionId }: { questionId: number }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [result, setResult] = useState<MediationResult | null>(null);

  const submit = useMutation({
    mutationFn: () => submitMediation({ questionId, userText: text.trim() }),
    onSuccess: (res) => {
      setResult(res);
      if (res.passed) correctFeedback();
      else warnFeedback();
    },
  });

  // ─── Хаалттай — урилга ───
  if (!open) {
    return (
      <Pressable
        onPress={() => {
          tapFeedback();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Дүү нартаа тайлбарлах даалгавар нээх"
        style={styles.invite}>
        <Text style={styles.inviteText}>
          🗣 Дүү дээ, энэ юу гэсэн үг вэ? — өөрийн үгээр тайлбарлаад нэмэлт XP ав
        </Text>
      </Pressable>
    );
  }

  const tooShort = text.trim().length < MIN_CHARS;

  return (
    <FadeInUp>
      <Card accent={colors.sky}>
        <Text style={styles.title}>Дүү нартаа тайлбарла</Text>
        <Text style={styles.hint}>
          Багадаа дүүдээ тайлбарлаж байгаа юм шиг НЭГ өгүүлбэрээр бич.
          Тайлбарыг хуулах нь ойлгосны нотолгоо болохгүй.
        </Text>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (result) setResult(null);
          }}
          placeholder="Жишээ нь: «Тэр хүн анх…»"
          placeholderTextColor={colors.textDim}
          multiline
          maxLength={MAX_CHARS}
          editable={!submit.isPending}
          accessibilityLabel="Өөрийн тайлбар"
        />
        <Text style={styles.counter}>
          {text.trim().length}/{MAX_CHARS}
          {tooShort ? ' · бүтэн өгүүлбэр болгоно уу' : ''}
        </Text>

        <View style={styles.row}>
          <Pressable
            onPress={() => {
              tapFeedback();
              setOpen(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Алгасах"
            style={styles.skip}>
            <Text style={styles.skipText}>Алгасах</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (tooShort || submit.isPending) return;
              tapFeedback();
              submit.mutate();
            }}
            disabled={tooShort || submit.isPending}
            accessibilityRole="button"
            accessibilityLabel="Тайлбараа илгээх"
            style={[styles.send, (tooShort || submit.isPending) && styles.sendOff]}>
            <Text style={styles.sendText}>
              {submit.isPending ? 'Шалгаж байна…' : 'Илгээх'}
            </Text>
          </Pressable>
        </View>

        {submit.isError && (
          <Text style={styles.error}>
            Илгээж чадсангүй. Сүлжээгээ шалгаад дахин оролдоно уу.
          </Text>
        )}

        {result && (
          <FadeInUp>
            <OrnamentDivider />
            <View style={styles.resultBox}>
              <Text
                style={[
                  styles.score,
                  { color: result.passed ? colors.success : colors.warning },
                ]}>
                {result.score}/100
              </Text>
              <Text style={styles.feedback}>{result.feedback}</Text>

              {result.xpAwarded > 0 && (
                <Text style={styles.xp}>+{result.xpAwarded} XP</Text>
              )}
              {result.alreadyRewarded && (
                <Text style={styles.note}>
                  Энэ асуултад XP аль хэдийн авсан — дахин бичих нь чөлөөтэй
                </Text>
              )}

              {result.missedTerms.length > 0 && !result.copied && (
                <Text style={styles.note}>
                  Дурдвал зохих: {result.missedTerms.join(' · ')}
                </Text>
              )}
            </View>
          </FadeInUp>
        )}
      </Card>
    </FadeInUp>
  );
}

const styles = StyleSheet.create({
  invite: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.sky,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  inviteText: { color: colors.sky, fontSize: fontSize.sm, lineHeight: 20 },

  title: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
    fontFamily: fontFamily.display,
  },
  hint: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 19 },

  input: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    padding: spacing.md,
    fontSize: fontSize.md,
    minHeight: 88,
    textAlignVertical: 'top',
  },
  counter: { color: colors.textDim, fontSize: fontSize.xs, textAlign: 'right' },

  row: { flexDirection: 'row', gap: spacing.sm },
  skip: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skipText: { color: colors.textMuted, fontSize: fontSize.md },
  send: {
    flex: 2,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  sendOff: { opacity: 0.45 },
  sendText: { color: colors.bg, fontSize: fontSize.md, fontWeight: '800' },

  resultBox: { gap: spacing.xs },
  score: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    fontVariant: ['tabular-nums'],
  },
  feedback: { color: colors.text, fontSize: fontSize.sm, lineHeight: 20 },
  xp: { color: colors.primary, fontSize: fontSize.md, fontWeight: '800' },
  note: { color: colors.textDim, fontSize: fontSize.xs, lineHeight: 17 },
  error: { color: colors.error, fontSize: fontSize.sm },
});
