/**
 * Оноон тэмдэг — ■■□■■
 *
 * Хуваалцах текст, OG зураг, апп — гурвуулаа ИЖИЛ хэл: алтан дүүрэн = зөв,
 * шүрэн хүрээ = буруу. Хэрэглэгч нэг удаа сурч, хаана ч таньдаг.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

export function ScoreMarks({
  marks,
  total,
  size = 22,
  /** Одоо хариулж буй асуултын байрлал — тод хүрээтэй */
  current,
}: {
  marks: readonly boolean[];
  total: number;
  size?: number;
  current?: number;
}) {
  const label = `${marks.filter(Boolean).length}/${total} зөв`;
  return (
    <View style={[styles.row, { gap: size * 0.32 }]} accessibilityLabel={label} accessible>
      {Array.from({ length: total }, (_, i) => {
        const answered = i < marks.length;
        const ok = marks[i] === true;
        const isCurrent = current === i && !answered;
        return (
          <View
            key={i}
            style={[
              {
                width: size,
                height: size,
                borderRadius: size * 0.24,
                borderWidth: Math.max(1.5, size * 0.09),
              },
              ok
                ? styles.correct
                : answered
                  ? styles.wrong
                  : isCurrent
                    ? styles.current
                    : styles.pending,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  correct: { backgroundColor: colors.primary, borderColor: colors.primary },
  wrong: { backgroundColor: 'rgba(230, 92, 62, 0.12)', borderColor: colors.accent },
  current: { backgroundColor: 'rgba(221, 176, 88, 0.12)', borderColor: colors.primaryLight },
  pending: { backgroundColor: 'transparent', borderColor: colors.borderStrong },
});
