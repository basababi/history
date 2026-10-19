/**
 * AI түүхэн зөвлөх (Бүлэг 3.3, 6.4, ADR-007)
 *
 * Хариулт бүрд эх сурвалж харагдана; контекстгүй бол «мэдэхгүй» гэнэ.
 *
 * Алдааны засвар №11: өдрийн лимит СЕРВЕРТ (Redis) — дэлгэц солиод
 * тойрч гарах боломжгүй. Серверийн `remainingMessages` эх сурвалж болно.
 * Алдааны засвар №13: persona хатуу тусгаарлагдсан (серверийн WHERE).
 */
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { askMentor } from '@/api/endpoints';
import { Card, EmptyState, Skeleton } from '@/components/ui';
import { useCatalog } from '@/hooks/queries';
import { colors, fontSize, radius, spacing } from '@/theme';

interface ChatMessage {
  id: string;
  role: 'user' | 'mentor';
  text: string;
  sources?: string[];
  outOfScope?: boolean;
}

export default function MentorScreen() {
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const scrollRef = useRef<ScrollView>(null);

  const [personaId, setPersonaId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  const unlockedHeroes = (catalog.data?.heroes ?? []).filter((h) => h.unlocked);
  const activePersonaId = personaId ?? unlockedHeroes[0]?.id ?? null;
  const persona = unlockedHeroes.find((h) => h.id === activePersonaId);

  async function send() {
    const query = input.trim();
    if (!query || sending || !activePersonaId || limitReached) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: query,
    };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setSending(true);

    try {
      const reply = await askMentor({ personaId: activePersonaId, query });
      setRemaining(reply.remainingMessages);
      setMessages((m) => [
        ...m,
        {
          id: `m-${Date.now()}`,
          role: 'mentor',
          text: reply.text,
          sources: reply.sources,
          outOfScope: reply.outOfScope,
        },
      ]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DAILY_LIMIT_REACHED') {
        setLimitReached(true);
        setRemaining(0);
      }
      setMessages((m) => [
        ...m,
        {
          id: `e-${Date.now()}`,
          role: 'mentor',
          text:
            err instanceof ApiError
              ? err.message
              : 'Хариулт авч чадсангүй. Дахин оролдоно уу.',
          outOfScope: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  if (catalog.isLoading) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ padding: spacing.md }}>
          <Skeleton height={60} />
          <Skeleton height={200} />
        </View>
      </View>
    );
  }

  if (unlockedHeroes.length === 0) {
    return (
      <View style={[styles.flex, styles.center, { paddingTop: insets.top }]}>
        <EmptyState
          emoji="🔒"
          title="Зөвлөх хараахан нээгдээгүй"
          message="Эхний сорилоо өгч баатраа нээгээрэй. Дараа нь түүхэн дүртэй ярилцаж болно."
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
        {/* Persona сонголт */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.personaRow}
          contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md }}>
          {unlockedHeroes.map((h) => (
            <TouchableOpacity
              key={h.id}
              onPress={() => {
                setPersonaId(h.id);
                setMessages([]);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${h.name}-тай ярилцах`}
              accessibilityState={{ selected: activePersonaId === h.id }}
              style={[
                styles.personaChip,
                activePersonaId === h.id && styles.personaChipActive,
              ]}>
              <Text
                style={[
                  styles.personaName,
                  activePersonaId === h.id && { color: colors.primary },
                ]}>
                {h.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView ref={scrollRef} style={styles.chat} contentContainerStyle={styles.chatContent}>
          {messages.length === 0 && persona && (
            <Card>
              <Text style={styles.introText}>
                {persona.name}-тай ярилцаарай. Тэрээр зөвхөн баталгаажсан эх
                сурвалжид тулгуурлан хариулна — мэдэхгүй зүйлээ «мэдэхгүй» гэж
                хэлнэ.
              </Text>
            </Card>
          )}

          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.bubbleRow,
                msg.role === 'user' && { justifyContent: 'flex-end' },
              ]}>
              <View
                style={[
                  styles.bubble,
                  msg.role === 'user' ? styles.userBubble : styles.mentorBubble,
                  msg.outOfScope && styles.outOfScopeBubble,
                ]}>
                <Text style={styles.bubbleText}>{msg.text}</Text>
                {msg.sources && msg.sources.length > 0 && (
                  <Text style={styles.sourceText}>
                    📚 {msg.sources.join(' · ')}
                  </Text>
                )}
              </View>
            </View>
          ))}

          {sending && (
            <View style={styles.bubbleRow}>
              <View style={[styles.bubble, styles.mentorBubble]}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={limitReached ? 'Өдрийн лимит дууслаа' : 'Асуултаа бичээрэй…'}
            placeholderTextColor={colors.textMuted}
            editable={!limitReached && !sending}
            onSubmitEditing={() => void send()}
            maxLength={500}
            accessibilityLabel="Асуултын талбар"
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (limitReached || sending || !input.trim()) && { opacity: 0.4 },
            ]}
            onPress={() => void send()}
            disabled={limitReached || sending || !input.trim()}
            accessibilityRole="button"
            accessibilityLabel="Илгээх">
            <Text style={{ fontSize: 18 }}>➤</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.limitNote}>
          {remaining === null
            ? 'Өдөрт 10 мессежийн лимиттэй'
            : `Өдрийн лимит: ${remaining}/10 мессеж үлдсэн`}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center' },
  container: { flex: 1 },
  personaRow: { flexGrow: 0, paddingVertical: spacing.sm },
  personaChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  personaChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.bgCardLight,
  },
  personaName: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
  chat: { flex: 1 },
  chatContent: { padding: spacing.md, gap: spacing.sm },
  introText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '85%', borderRadius: radius.md, padding: spacing.md },
  userBubble: { backgroundColor: colors.primaryDark },
  mentorBubble: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  outOfScopeBubble: { borderColor: colors.accent, borderStyle: 'dashed' },
  bubbleText: { color: colors.text, fontSize: fontSize.sm, lineHeight: 20 },
  sourceText: {
    color: colors.textMuted,
    fontSize: fontSize.sm - 2,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    fontSize: fontSize.md,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitNote: {
    color: colors.textMuted,
    fontSize: fontSize.sm - 2,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
