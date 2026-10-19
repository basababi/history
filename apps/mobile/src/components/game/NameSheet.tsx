/**
 * Нэр тавих цонх — зөвхөн ХЭРЭГТЭЙ мөчид гарна
 *
 * Эхний айлчлалд нэр асуухгүй (линкээр орсон найз шууд тоглоно). Харин
 * найзаа сорих, бүлэгт нэгдэх үед нэр ХАРАГДАХ тул тэр мөчид л асууна —
 * яагаад хэрэгтэйг хэрэглэгч өөрөө ойлгоно.
 */
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  DISPLAY_NAME_ERROR_TEXT,
  DISPLAY_NAME_MAX,
  normalizeDisplayName,
  validateDisplayName,
} from '@nomad/core';
import { ApiError } from '@/api/client';
import { PrimaryButton } from '@/components/ui';
import { useUpdateName } from '@/hooks/game';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

export function NameSheet({
  visible,
  initial,
  reason,
  onClose,
  onSaved,
}: {
  visible: boolean;
  initial?: string | null;
  /** Яагаад асууж байгаа — «Найз чинь хэн сорьж байгааг мэдэх хэрэгтэй» */
  reason: string;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [value, setValue] = useState(initial ?? '');
  const [touched, setTouched] = useState(false);
  const update = useUpdateName();

  useEffect(() => {
    if (visible) {
      setValue(initial ?? '');
      setTouched(false);
      update.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- нээгдэх бүрд л цэвэрлэнэ
  }, [visible]);

  const check = validateDisplayName(value);
  const localError = touched && !check.ok ? DISPLAY_NAME_ERROR_TEXT[check.error] : null;
  const serverError = update.error instanceof ApiError ? update.error.message : update.error ? 'Хадгалж чадсангүй' : null;

  async function submit() {
    setTouched(true);
    if (!check.ok || update.isPending) return;
    try {
      const me = await update.mutateAsync(normalizeDisplayName(value));
      onSaved(me.displayName ?? normalizeDisplayName(value));
    } catch {
      // алдаа `update.error`-оор харагдана
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Хаах" />
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text style={styles.title}>Нэрээ тавь</Text>
          <Text style={styles.reason}>{reason}</Text>

          <TextInput
            value={value}
            onChangeText={(t) => {
              setValue(t);
              if (update.error) update.reset();
            }}
            onBlur={() => setTouched(true)}
            onSubmitEditing={() => void submit()}
            placeholder="Жишээ нь: Бат"
            placeholderTextColor={colors.textDim}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={DISPLAY_NAME_MAX + 4}
            returnKeyType="done"
            style={styles.input}
            accessibilityLabel="Дэлгэцийн нэр"
          />
          <Text style={styles.hint}>
            Найзууд, бүлгийн гишүүдэд харагдана. Бодит овог нэр шаардлагагүй.
          </Text>
          {(localError ?? serverError) ? <Text style={styles.error}>{localError ?? serverError}</Text> : null}

          <View style={styles.actions}>
            <PrimaryButton
              title={update.isPending ? 'Хадгалж байна…' : 'Хадгалах'}
              onPress={() => void submit()}
              disabled={update.isPending}
            />
            <PrimaryButton title="Дараа" variant="ghost" onPress={onClose} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 6, 12, 0.72)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderGold,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { fontFamily: fontFamily.display, color: colors.text, fontSize: fontSize.xl },
  reason: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
  input: {
    marginTop: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    color: colors.text,
    fontSize: fontSize.lg,
    backgroundColor: colors.bgSunken,
  },
  hint: { color: colors.textDim, fontSize: fontSize.xs + 1, lineHeight: 17 },
  error: { color: colors.error, fontSize: fontSize.sm, fontWeight: '600' },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
