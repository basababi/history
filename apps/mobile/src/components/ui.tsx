/**
 * Хуваалцсан UI компонентууд — дизайны систем (Бүлэг 7.1, ROADMAP A1–A3)
 *
 * Хүртээмж: хүрэх талбай ≥ 44×44 pt, accessibilityRole/Label заавал.
 *
 * ROADMAP A2: товч дарагдана, карт гүнзгийрэлтэй, дөл амьд шатна.
 * Өмнө нь бүх зүйл хавтгай, хөдөлгөөнгүй байсан.
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  colors,
  elevation,
  fontSize,
  gradients,
  radius,
  spacing,
} from '@/theme';
import { tapFeedback } from '@/feedback';
import { Animated, useFlicker, usePressScale } from './motion';
import { OrnamentCorner, OrnamentProgress, Ulzii } from './Ornament';
import { Icon, type IconName } from './Icon';

// ─────────────────────────────────────────────────────────────
// Товч — дарагдаж, чичирнэ
// ─────────────────────────────────────────────────────────────

export function PrimaryButton({
  title,
  onPress,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
}) {
  const ghost = variant === 'ghost';
  const press = usePressScale(0.96);

  function handlePress() {
    tapFeedback();
    onPress();
  }

  return (
    <Animated.View style={press.style}>
      <Pressable
        onPress={handlePress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: !!disabled }}
        style={[
          styles.buttonBase,
          ghost && styles.buttonGhost,
          disabled && styles.buttonDisabled,
          !ghost && !disabled && elevation.button,
        ]}>
        {ghost ? (
          <Text style={[styles.buttonText, styles.buttonTextGhost]}>{title}</Text>
        ) : (
          <LinearGradient
            colors={gradients.brass}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.buttonFill}>
            <Text style={styles.buttonText}>{title}</Text>
          </LinearGradient>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// Карт — gradient, гүнзгийрэл, дээд гэрэл
// ─────────────────────────────────────────────────────────────

/**
 * Карт — агуулгын үндсэн сав.
 *
 * ══ ЯАГААД ДАХИН ЗОХИОСОН ВЭ ══
 *
 * Өмнөх карт бүгд ижил бараан хайрцаг байсан: нэг өнгө, 2px-ийн бараг
 * үл мэдэгдэх дээд зураас, ялгарал алга. Агуулгын талбар нь дэлгэцийн
 * ~80%-ийг эзэлдэг тул энэ уйтгар нь бүхэл аппыг тодорхойлж байв.
 *
 * Одоо гурван зэрэглэлтэй:
 *   plain    — жирийн мэдээлэл, намуун
 *   accent   — эриний/ховордлын өнгөт ЗҮҮН ИРМЭГ + булангийн угалз
 *   feature  — гол үйлдэл: тод хүрээ, туяа, өнгөт дэвсгэрийн налуу
 *
 * ⚠ Зэрэглэлгүй бол бүх карт адил чухал мэт харагдана. Хэрэглэгч юуг
 *   эхэлж хармаа мэдэхгүй — энэ нь «уйтгартай»-н техникийн шалтгаан.
 */
export function Card({
  children,
  style,
  accent,
  glow,
  /** Гол үйлдлийн карт — хамгийн их анхаарал татна */
  feature,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Эриний/ховордлын өнгө — зүүн ирмэг ба булангийн угалз */
  accent?: string;
  glow?: boolean;
  feature?: boolean;
}) {
  const edge = accent ?? (feature ? colors.primary : undefined);

  return (
    <View
      style={[
        styles.cardWrap,
        edge !== undefined && { borderColor: `${edge}55` },
        feature && styles.cardFeature,
        glow && elevation.raised,
        style,
      ]}>
      <LinearGradient
        colors={feature ? gradients.cardActive : gradients.card}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.cardFill}>
        {/* Зүүн ирмэгийн өнгөт зурвас — 2px дээд зураасаас хамаагүй тод */}
        {edge !== undefined && (
          <View style={[styles.cardEdge, { backgroundColor: edge }]} />
        )}

        {/* Булангийн эвэр угалз — картыг «хайрцаг» биш «жаазтай» болгоно */}
        {edge !== undefined && (
          <View style={styles.cardCorner} pointerEvents="none">
            <OrnamentCorner size={26} color={edge} opacity={0.5} rotate={90} />
          </View>
        )}

        {children}
      </LinearGradient>
    </View>
  );
}

/**
 * Хэсгийн гарчиг — зүүн талдаа угалзан тэмдэглэгээтэй.
 *
 * ЯАГААД: лавлах зургуудад гарчиг ХЭЗЭЭ Ч нүцгэн байдаггүй. Энэ нь
 * 16 газарт давтагддаг тул хамгийн хямд өртгөөр хамгийн өргөн нөлөө
 * үзүүлэх цэг — нэг бүрэлдэхүүн засахад бүх карт өөрчлөгдөнө.
 */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionMark} />
      <Text style={styles.sectionTitle}>{children}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Прогресс — угалзан хээтэй
// ─────────────────────────────────────────────────────────────

export function ProgressBar({
  progress,
  color = colors.primary,
  plain,
}: {
  progress: number;
  color?: string;
  /** Хээгүй энгийн — нарийн зайд */
  plain?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, progress * 100));

  if (plain) {
    return (
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    );
  }

  return <OrnamentProgress progress={progress} color={color} height={12} />;
}

// ─────────────────────────────────────────────────────────────
// Streak — дөл амьд шатна
// ─────────────────────────────────────────────────────────────

export function StreakBadge({ days, paused }: { days: number; paused?: boolean }) {
  const flicker = useFlicker(!paused && days > 0);

  return (
    <View
      style={styles.streakBadge}
      accessibilityLabel={paused ? 'Streak түр зогссон' : `${days} өдрийн streak`}>
      {/*
        ⚠ Emoji-г сольсон: 🔥 бол Google-ийн артворк — брэндгүй, төхөөрөмж
        бүрд өөр. Нүүр дэлгэцийн хамгийн харагдацтай дүрс байсан тул
        бүхэл зохиомжоос тасарч харагддаг байв.
      */}
      <Animated.View style={paused ? undefined : flicker}>
        <Icon
          name={paused ? 'lock' : 'flame'}
          size={18}
          color={paused ? colors.textDim : colors.primary}
          strokeWidth={2}
          filled={!paused}
        />
      </Animated.View>
      <Text style={styles.streakText}>{days}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Төлөвүүд
// ─────────────────────────────────────────────────────────────

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loadingWrap} accessibilityLabel={label ?? 'Ачаалж байна'}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label && <Text style={styles.loadingLabel}>{label}</Text>}
    </View>
  );
}

export function ErrorState({
  emoji,
  icon = 'warn',
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  /** ⚠ Хуучин дэлгэцүүдэд л — шинэ код `icon` ашиглана (emoji брэндгүй) */
  emoji?: string;
  icon?: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <View style={styles.stateWrap} accessibilityRole="alert">
      {emoji ? (
        <Text style={styles.stateEmoji}>{emoji}</Text>
      ) : (
        <View style={styles.stateIcon}>
          <Icon name={icon} size={46} color={colors.warning} strokeWidth={1.7} />
        </View>
      )}
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      {actionLabel && onAction && (
        <View style={styles.stateAction}>
          <PrimaryButton title={actionLabel} onPress={onAction} />
        </View>
      )}
      {secondaryLabel && onSecondary && (
        <View style={styles.stateSecondary}>
          <PrimaryButton title={secondaryLabel} onPress={onSecondary} variant="ghost" />
        </View>
      )}
    </View>
  );
}

export function EmptyState({
  emoji,
  icon,
  title,
  message,
  children,
}: {
  emoji?: string;
  icon?: IconName;
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.stateWrap}>
      {emoji ? (
        <Text style={styles.stateEmoji}>{emoji}</Text>
      ) : icon ? (
        <View style={styles.stateIcon}>
          <Icon name={icon} size={46} color={colors.primary} strokeWidth={1.7} />
        </View>
      ) : (
        <View style={{ opacity: 0.35, marginBottom: spacing.sm }}>
          <Ulzii size={54} color={colors.borderStrong} strokeWidth={3.5} />
        </View>
      )}
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      {children ? <View style={styles.stateAction}>{children}</View> : null}
    </View>
  );
}

export function Skeleton({ height = 60 }: { height?: number }) {
  return <View style={[styles.skeleton, { height }]} accessibilityLabel="Ачаалж байна" />;
}

export function OfflineBanner({ pendingCount }: { pendingCount: number }) {
  return (
    <View style={styles.offlineBanner} accessibilityRole="alert">
      <Text style={styles.offlineText}>
        📴 Офлайн горим
        {pendingCount > 0 ? ` · ${pendingCount} хариулт хүлээгдэж байна` : ''}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Товч
  buttonBase: {
    borderRadius: radius.md,
    overflow: 'hidden',
    minHeight: 48,
  },
  buttonFill: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'transparent',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: {
    color: colors.textOnBrass,
    fontSize: fontSize.md,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  buttonTextGhost: { color: colors.text, fontWeight: '600' },

  // Карт
  cardWrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.card,
  },
  /** Гол үйлдлийн карт — тод хүрээ, өндөр гүн */
  cardFeature: {
    borderWidth: 1.5,
    ...elevation.raised,
  },
  cardFill: { padding: spacing.md, paddingLeft: spacing.md + 6 },
  /** Зүүн ирмэгийн өнгөт зурвас */
  cardEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  cardCorner: { position: 'absolute', right: 6, top: 6 },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  /** Гуулин зурвас — гарчгийн өмнөх угалзан тэмдэглэгээ */
  sectionMark: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },

  // Прогресс
  progressTrack: {
    height: 8,
    backgroundColor: colors.bgSunken,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },

  // Streak
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bgCardLight,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  streakText: { color: colors.text, fontSize: fontSize.md, fontWeight: '800' },

  // Төлөв
  loadingWrap: { justifyContent: 'center', alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  loadingLabel: { color: colors.textMuted, fontSize: fontSize.sm },

  stateWrap: { alignItems: 'center', padding: spacing.lg, gap: spacing.xs },
  stateEmoji: { fontSize: 44, marginBottom: spacing.xs },
  stateIcon: { marginBottom: spacing.sm, opacity: 0.9 },
  stateTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateMessage: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  stateAction: { marginTop: spacing.md, alignSelf: 'stretch' },
  stateSecondary: { marginTop: spacing.sm, alignSelf: 'stretch' },

  skeleton: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    opacity: 0.55,
  },

  offlineBanner: {
    backgroundColor: colors.warning,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  offlineText: { color: '#2A1F08', fontSize: fontSize.sm, fontWeight: '700' },
});
