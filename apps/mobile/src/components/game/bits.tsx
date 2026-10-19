/**
 * Жижиг бүрэлдэхүүнүүд — шошго, хүний дүрс, мөр, тоолуур, түр мэдэгдэл
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { tapFeedback } from '@/feedback';
import { Icon, type IconName } from '@/components/Icon';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

// ─── Шошго ───

type Tone = 'muted' | 'gold' | 'teal' | 'coral';

const TONES: Record<Tone, { fg: string; bg: string; border: string }> = {
  muted: { fg: colors.textMuted, bg: 'rgba(155, 178, 205, 0.08)', border: colors.border },
  gold: { fg: colors.primaryLight, bg: 'rgba(221, 176, 88, 0.12)', border: colors.borderGold },
  teal: { fg: colors.sky, bg: 'rgba(47, 210, 197, 0.1)', border: 'rgba(47, 210, 197, 0.4)' },
  coral: { fg: colors.accent, bg: 'rgba(230, 92, 62, 0.1)', border: 'rgba(230, 92, 62, 0.45)' },
};

export function Chip({ label, tone = 'muted', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const t = TONES[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg, borderColor: t.border }]}>
      {icon ? <Icon name={icon} size={14} color={t.fg} strokeWidth={2.1} /> : null}
      <Text style={[styles.chipText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

// ─── Хүний дүрс — нэрийн эхний үсэг (emoji биш) ───

const AVATAR_COLORS = [
  colors.ink.indigo,
  colors.ink.teal,
  colors.ink.coral,
  colors.ink.sage,
  colors.ink.magenta,
  colors.zurag.turquoiseDeep,
];

export function Avatar({ name, seed, size = 38 }: { name: string; seed: number; size?: number }) {
  const letter = [...name.trim()][0]?.toUpperCase() ?? '?';
  const bg = AVATAR_COLORS[Math.abs(seed) % AVATAR_COLORS.length] as string;
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.44 }]}>{letter}</Text>
    </View>
  );
}

// ─── Мөр ───

export function PersonRow({
  name,
  seed,
  subtitle,
  left,
  right,
  highlight,
  onPress,
}: {
  name: string;
  seed: number;
  subtitle?: string;
  /** Байр г.м. — дүрсний өмнө */
  left?: React.ReactNode;
  right?: React.ReactNode;
  /** «Чи» мөрийг тодруулна */
  highlight?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <View style={[styles.row, highlight && styles.rowHighlight]}>
      {left}
      <Avatar name={name} seed={seed} />
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress ? <Icon name="chevron" size={18} color={colors.textDim} /> : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={({ pressed }) => pressed && { opacity: 0.75 }}>
      {body}
    </Pressable>
  );
}

// ─── Жижиг товч ───

export function SmallButton({
  label,
  icon,
  onPress,
  disabled,
  style,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.small, pressed && { opacity: 0.7 }, disabled && { opacity: 0.4 }, style]}>
      {icon ? <Icon name={icon} size={17} color={colors.text} strokeWidth={2} /> : null}
      <Text style={styles.smallText}>{label}</Text>
    </Pressable>
  );
}

// ─── Тоолуур — дараагийн тав хүртэл ───

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function Countdown({ ms, onDone }: { ms: number; onDone?: () => void }) {
  const target = useRef(Date.now() + ms);
  const [left, setLeft] = useState(ms);
  const done = useRef(false);
  // Дуудагч рендер бүрт шинэ функц өгсөн ч интервал дахин эхлэхгүй
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    target.current = Date.now() + ms;
    done.current = false;
    setLeft(ms);
  }, [ms]);

  useEffect(() => {
    const iv = setInterval(() => {
      const rest = Math.max(0, target.current - Date.now());
      setLeft(rest);
      if (rest === 0 && !done.current) {
        done.current = true;
        onDoneRef.current?.();
      }
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const total = Math.floor(left / 1000);
  const text = `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return (
    <Text style={styles.countdown} accessibilityLabel={`Дараагийн тав хүртэл ${text}`}>
      {text}
    </Text>
  );
}

// ─── Түр мэдэгдэл («Линк хуулагдлаа») ───

export function useFlash(timeoutMs = 2600): [string | null, (message: string) => void] {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const flash = (m: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(m);
    timer.current = setTimeout(() => setMessage(null), timeoutMs);
  };
  return [message, flash];
}

export function FlashText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text style={styles.flash} accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: fontSize.xs + 1, fontWeight: '700', letterSpacing: 0.3 },

  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.text, fontFamily: fontFamily.display },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    minHeight: 56,
  },
  rowHighlight: { backgroundColor: 'rgba(221, 176, 88, 0.09)' },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  rowSub: { color: colors.textMuted, fontSize: fontSize.sm - 1, marginTop: 1 },

  small: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    // Тунгалаг бус: толгойн товч үүлэн чимэглэлийн дээр гардаг — нэвт харагдвал текст уншигдахгүй
    backgroundColor: colors.bgElevated,
  },
  smallText: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700' },

  countdown: {
    color: colors.text,
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },

  flash: {
    color: colors.sky,
    fontSize: fontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
