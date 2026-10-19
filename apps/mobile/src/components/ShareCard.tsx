/**
 * Хуваалцах карт үүсгэгч (ROADMAP C4)
 *
 * Техникийн баримт бичиг сошиал хуваалцалтыг «ӨСӨЛТИЙН СУВАГ №1» гэж
 * заасан атал энэ хүртэл огт байгаагүй. Энэ бүрэлдэхүүн нь дүнгийн
 * дэлгэцэд — ХАМГИЙН СЭТГЭЛ ХӨДӨЛГӨМ МӨЧИД — гарч ирнэ.
 *
 * ⚠ ХЭМЖЭЭ: 9:16 (Instagram/TikTok Story). Дэлгэц дээр жижигрүүлж
 *   харуулах ч зураг нь бүтэн нягтралаар авагдана (`ViewShot` pixelRatio).
 *
 * ⚠ НУУЦЛАЛ: картад ЗӨВХӨН хэрэглэгчийн сонгосон дэлгэцийн нэр, оноо,
 *   цол гарна. И-мэйл, ID, байршил, бодит нэр ХЭЗЭЭ Ч орохгүй
 *   (Бүлэг 6.5). Хүүхэд өөрийгөө таниулах мэдээлэл нийтлэхээс сэргийлнэ.
 *
 * ⚠ Хуваалцах боломжгүй төхөөрөмж дээр товч нь чимээгүй алга болно —
 *   алдааны мэдэгдэл гаргахгүй (хуваалцах нь заавал биш үйлдэл).
 */
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { LinearGradient } from 'expo-linear-gradient';
import { PrimaryButton } from '@/components/ui';
import { HornBorder, OrnamentDivider, Ulzii } from '@/components/Ornament';
import { tapFeedback, warnFeedback } from '@/feedback';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

/** Story харьцаа — дэлгэцэд багтаах жижигрүүлсэн хэмжээ */
const CARD_W = 270;
const CARD_H = 480;

export interface ShareCardData {
  displayName: string;
  avatarEmoji: string;
  /** Гол тоо — сорилын оноо эсвэл нийт XP */
  headline: string;
  /** Гол тооны тайлбар — «10-аас 9 зөв» */
  subline: string;
  rankTitle: string;
  /** Нэмэлт мөр — эрин, баатар, эсвэл олсон төгсгөл */
  detail?: string;
}

export function ShareCard({ data }: { data: ShareCardData }) {
  const shotRef = useRef<React.ElementRef<typeof ViewShot>>(null);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  async function share() {
    if (busy) return;
    tapFeedback();
    setBusy(true);
    try {
      const Sharing = await import('expo-sharing');
      if (!(await Sharing.isAvailableAsync())) {
        setUnavailable(true);
        return;
      }

      const uri = await captureRef(shotRef, {
        format: 'png',
        quality: 1,
        // Бүтэн нягтралаар — дэлгэцийн жижиг хувилбараас биш
        result: 'tmpfile',
      });

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Эртний Өв',
      });
    } catch {
      // Хуваалцах нь заавал биш — чимээгүй бууж өгнө
      warnFeedback();
      setUnavailable(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }}>
        <LinearGradient
          colors={[colors.bg, '#132B45', colors.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}>
          <View style={styles.head}>
            <Ulzii size={38} color={colors.primary} strokeWidth={3} />
            <Text style={styles.brand}>ЭРТНИЙ ӨВ</Text>
          </View>

          <HornBorder width={CARD_W - 64} height={14} opacity={0.6} />

          <View style={styles.body}>
            <Text style={styles.avatar}>{data.avatarEmoji}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {data.displayName}
            </Text>
            <Text style={styles.rank}>{data.rankTitle}</Text>

            <OrnamentDivider />

            <Text style={styles.headline}>{data.headline}</Text>
            <Text style={styles.subline}>{data.subline}</Text>

            {data.detail && <Text style={styles.detail}>{data.detail}</Text>}
          </View>

          <HornBorder width={CARD_W - 64} height={14} opacity={0.6} />
          <Text style={styles.foot}>Монголын түүхийг тоглож сур</Text>
        </LinearGradient>
      </ViewShot>

      {!unavailable && (
        <PrimaryButton
          title={busy ? 'Бэлдэж байна…' : 'Хуваалцах'}
          variant="ghost"
          disabled={busy}
          onPress={() => void share()}
        />
      )}

      {unavailable && (
        <Text style={styles.note}>
          Энэ төхөөрөмж дээр хуваалцах боломжгүй байна. Дэлгэцийн зураг авч
          болно.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.md },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  head: { alignItems: 'center', gap: spacing.xs },
  brand: {
    fontFamily: fontFamily.display,
    color: colors.primary,
    fontSize: fontSize.md,
    letterSpacing: 3,
  },

  body: { alignItems: 'center', gap: spacing.xs, flex: 1, justifyContent: 'center' },
  avatar: { fontSize: 56 },
  name: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
    maxWidth: CARD_W - 60,
  },
  rank: { color: colors.sky, fontSize: fontSize.sm },

  headline: {
    fontFamily: fontFamily.display,
    color: colors.primary,
    fontSize: 44,
    lineHeight: 52,
    fontVariant: ['tabular-nums'],
  },
  subline: { color: colors.text, fontSize: fontSize.md, textAlign: 'center' },
  detail: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  foot: { color: colors.textDim, fontSize: fontSize.xs, letterSpacing: 0.5 },
  note: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 19,
  },
});
