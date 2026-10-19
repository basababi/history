/**
 * Алдааны хил — аппыг цагаан дэлгэц болохоос хамгаална.
 * Production-д Sentry руу мэдээлнэ.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from './ui';
import { colors, fontSize, spacing } from '@/theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // TODO(sentry): Sentry.captureException(error, { extra: info })
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.wrap}>
        <Text style={styles.emoji}>🐎</Text>
        <Text style={styles.title}>Гэнэтийн алдаа гарлаа</Text>
        <Text style={styles.message}>
          Уучлаарай, ямар нэг зүйл буруудлаа. Дахин оролдоод үзээрэй.
        </Text>
        {typeof __DEV__ !== 'undefined' && __DEV__ && (
          <Text style={styles.devDetail}>{error.message}</Text>
        )}
        <View style={{ alignSelf: 'stretch', marginTop: spacing.lg }}>
          <PrimaryButton title="Дахин ачаалах" onPress={this.reset} />
        </View>
      </View>
    );
  }
}
const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emoji: { fontSize: 64, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  message: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  devDetail: {
    color: colors.error,
    fontSize: fontSize.sm - 2,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
