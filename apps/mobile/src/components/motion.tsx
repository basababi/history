/**
 * Хөдөлгөөний нэгжүүд — reanimated (ROADMAP A2)
 *
 * Бүх анимаци эндээс гарна — дэлгэц бүр өөрийн хэмнэл зохиохгүй.
 * `prefers-reduced-motion` идэвхтэй бол хугацаа 0 болно.
 */
import React, { useEffect } from 'react';
import { AccessibilityInfo, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { duration } from '@/theme';

// ─── Хөдөлгөөн багасгах тохиргоо ───

let reduceMotion = false;

AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    reduceMotion = v;
  })
  .catch(() => undefined);

AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
  reduceMotion = v;
});

/** Хугацааг тохиргооны дагуу тааруулна */
function ms(value: number): number {
  return reduceMotion ? 0 : value;
}

export function isReduceMotion(): boolean {
  return reduceMotion;
}

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

// ─────────────────────────────────────────────────────────────
// Гарч ирэх — доороос дээш, бүдгээс тод
// ─────────────────────────────────────────────────────────────

export function FadeInUp({
  children,
  delay = 0,
  distance = 14,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      ms(delay),
      withTiming(1, { duration: ms(duration.normal), easing: EASE })
    );
    return () => cancelAnimation(progress);
  }, [progress, delay]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

// ─────────────────────────────────────────────────────────────
// Цохилт — зөв хариулт, шагнал
// ─────────────────────────────────────────────────────────────

export function usePulse() {
  const scale = useSharedValue(1);

  const pulse = () => {
    scale.value = withSequence(
      withTiming(1.06, { duration: ms(duration.instant), easing: EASE }),
      withSpring(1, { damping: 11, stiffness: 190 })
    );
  };

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return { pulse, style };
}

// ─────────────────────────────────────────────────────────────
// Сэгсрэлт — буруу хариулт
// ─────────────────────────────────────────────────────────────

export function useShake() {
  const x = useSharedValue(0);

  const shake = () => {
    const d = ms(50);
    x.value = withSequence(
      withTiming(-8, { duration: d }),
      withTiming(8, { duration: d }),
      withTiming(-5, { duration: d }),
      withTiming(5, { duration: d }),
      withTiming(0, { duration: d })
    );
  };

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return { shake, style };
}

// ─────────────────────────────────────────────────────────────
// Дарагдах — товч
// ─────────────────────────────────────────────────────────────

export function usePressScale(depth = 0.97) {
  const scale = useSharedValue(1);

  const onPressIn = () => {
    scale.value = withTiming(depth, { duration: ms(duration.instant) });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 13, stiffness: 260 });
  };

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return { onPressIn, onPressOut, style };
}

// ─────────────────────────────────────────────────────────────
// Амьд дөл — streak
// ─────────────────────────────────────────────────────────────

export function useFlicker(active: boolean) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(t);
      t.value = 0;
      return;
    }
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 620, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 620, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(t);
  }, [active, t]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + t.value * 0.09 }],
    opacity: 0.86 + t.value * 0.14,
  }));

  return style;
}

// ─────────────────────────────────────────────────────────────
// Гялалзалт — домогт баатрын карт
// ─────────────────────────────────────────────────────────────

export function useFoilSweep(active: boolean, width: number) {
  const x = useSharedValue(-width);

  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(x);
      return;
    }
    x.value = withRepeat(
      withSequence(
        withTiming(width, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        withTiming(-width, { duration: 0 }),
        withTiming(-width, { duration: 2400 })
      ),
      -1,
      false
    );
    return () => cancelAnimation(x);
  }, [active, width, x]);

  return useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
}

// ─────────────────────────────────────────────────────────────
// Тэлэх — цол ахих, баатар нээгдэх
// ─────────────────────────────────────────────────────────────

export function useBurst() {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  const burst = () => {
    scale.value = 0.5;
    opacity.value = 0;
    scale.value = withSpring(1, { damping: 9, stiffness: 130 });
    opacity.value = withTiming(1, { duration: ms(duration.slow), easing: EASE });
  };

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return { burst, style };
}

export { Animated };
