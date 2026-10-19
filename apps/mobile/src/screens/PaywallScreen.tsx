/**
 * Hero Story Pass — монетизаци (Бүлэг 8.2)
 *
 * «Суралцах цөм үйл ажиллагаа ҮРГЭЛЖ ҮНЭГҮЙ. Pass нь тоглоомын давуу
 *  тал ОЛГОХГҮЙ (pay-to-win биш).»
 *
 * Алдааны засвар №19: өмнө нь хаашаа ч хүрдэггүй deep link нээж, төлбөрийн
 * статусыг хаана ч хадгалдаггүй байсан. Одоо серверийн checkout endpoint
 * дуудаж, тохируулаагүй үед ил тод хэлнэ — хуурамч урсгал байхгүй.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { ApiError, apiRequest } from '@/api/client';
import { Card } from '@/components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

const PERKS = [
  { emoji: '📖', text: 'Нэмэлт баатрын түүхэн quest-үүд' },
  { emoji: '💎', text: 'Ховор олдворын тусгай цуглуулга' },
  { emoji: '🎨', text: 'Баатрын скин, хувцаслалт' },
];

const PLANS = [
  { id: 'monthly' as const, label: 'Сар бүр · 10,000₮' },
  { id: 'yearly' as const, label: 'Жил бүр · 96,000₮ (20% хямдрал)' },
];

const CheckoutSchema = z.object({ url: z.string() });

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<'monthly' | 'yearly'>('monthly');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function checkout(provider: 'qpay' | 'socialpay') {
    setBusy(true);
    setNotice(null);
    try {
      await apiRequest('/api/billing/checkout', CheckoutSchema, {
        method: 'POST',
        body: { plan: selected, provider },
      });
    } catch (err) {
      setNotice(
        err instanceof ApiError
          ? err.message
          : 'Төлбөрийн урсгал эхлүүлж чадсангүй.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.lg },
      ]}>
      <Text style={styles.crown}>👑</Text>
      <Text style={styles.title}>Hero Story Pass</Text>
      <Text style={styles.subtitle}>
        Тоглоомын давуу тал ОЛГОХГҮЙ — зөвхөн нэмэлт контент.
      </Text>

      <View style={{ gap: spacing.sm, alignSelf: 'stretch' }}>
        {PERKS.map((p) => (
          <Card key={p.text} style={styles.perkRow}>
            <Text style={{ fontSize: 24 }}>{p.emoji}</Text>
            <Text style={styles.perkText}>{p.text}</Text>
          </Card>
        ))}
      </View>

      <View style={styles.plans}>
        {PLANS.map((plan) => (
          <TouchableOpacity
            key={plan.id}
            onPress={() => setSelected(plan.id)}
            accessibilityRole="button"
            accessibilityLabel={plan.label}
            accessibilityState={{ selected: selected === plan.id }}
            style={[styles.plan, selected === plan.id && styles.planActive]}>
            <Text
              style={[
                styles.planLabel,
                selected === plan.id && { color: colors.primary },
              ]}>
              {plan.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {notice && (
        <Card style={styles.noticeCard}>
          <Text style={styles.noticeText}>ℹ️ {notice}</Text>
        </Card>
      )}

      <View style={styles.payRow}>
        <TouchableOpacity
          style={[styles.payBtn, busy && { opacity: 0.5 }]}
          disabled={busy}
          onPress={() => void checkout('qpay')}
          accessibilityRole="button"
          accessibilityLabel="QPay-ээр төлөх">
          <Text style={styles.payBtnText}>QPay</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.payBtn, busy && { opacity: 0.5 }]}
          disabled={busy}
          onPress={() => void checkout('socialpay')}
          accessibilityRole="button"
          accessibilityLabel="SocialPay-ээр төлөх">
          <Text style={styles.payBtnText}>SocialPay</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.freeNote}>
        ✅ Сорил, streak, лиг, суурь баатрууд бүрэн ҮНЭГҮЙ хэвээрээ.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  crown: { fontSize: 64 },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '900', fontFamily: fontFamily.display, },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 19,
  },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  perkText: { color: colors.text, fontSize: fontSize.sm, flex: 1 },
  plans: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.md },
  plan: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  planActive: { borderColor: colors.primary, backgroundColor: colors.bgCardLight },
  planLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  noticeCard: { alignSelf: 'stretch', borderColor: colors.primaryDark },
  noticeText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 19 },
  payRow: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' },
  payBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  payBtnText: { color: colors.bg, fontWeight: '800', fontSize: fontSize.md },
  freeNote: {
    color: colors.success,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 19,
  },
});
