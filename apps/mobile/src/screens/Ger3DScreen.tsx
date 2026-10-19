/**
 * «Миний гэр» 3D — тойрон харах, гэрт орох
 *
 * UX ШИЙДВЭР
 *   • Бүтэн дэлгэц. Картан доторх 3D нь босоо гүйлгэлттэй (ScrollView)
 *     дохио зангаагаар мөргөлдөж, аль нь ч зөв ажиллахгүй болдог.
 *   • Ачаалах зуур Blender-ийн диорама «poster» болж харагдана — хар
 *     дэлгэц хүлээлгэхгүй; 3D бэлэн болмогц солигдоно.
 *   • WebGL ажиллахгүй төхөөрөмж дээр мессеж + poster; апп унахгүй.
 *   • Эд, бүс дээр дарахад уламжлалт байршил, тайлбар, эх сурвалж гарна —
 *     чимэглэл биш, сургалтын агуулга.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import type { GerItem, GerSlot } from '@nomad/contracts';
import { fetchGer } from '@/api/endpoints';
import { Icon } from '@/components/Icon';
import { GER_DIORAMA, GER_DIORAMA_RATIO } from '@/components/GerArt';
import { Ger3DView, type Ger3DHandle } from '@/ger3d/Ger3DView';
import type { CameraMode, PickResult } from '@/ger3d/GerEngine';
import { gerItemKey } from '@/ger3d/itemKeys';
import type { EquippedKeys } from '@/ger3d/sceneRules';
import type { Zone } from '@/ger3d/zones';
import type { RootScreenProps } from '@/navigation/types';
import { selectFeedback } from '@/feedback';
import { colors, fontSize, radius, spacing } from '@/theme';

/** Эд гэрийн аль хэсэгт уламжлалаар байрладаг — мэдээллийн картын дэд гарчиг */
const SLOT_PLACE: Record<GerSlot, string> = {
  floor: 'Шал · гал голомт ба хойморын хооронд',
  wall: 'Хана · зүүн (эмэгтэй) талд',
  furniture: 'Тавилга · хойморт',
  instrument: 'Хөгжим · баруун (эрэгтэй) талд',
  roof: 'Тооно · гэрийн оройд',
  light: 'Гэрэл · хоймор ба гал голомт',
};

const MODE_LABEL: Record<CameraMode, string> = {
  orbit: 'Гаднаас',
  entering: 'Гэрт орж байна…',
  inside: 'Гэрийн дотор',
  exiting: 'Гарч байна…',
};

const HINT: Record<CameraMode, string> = {
  orbit: 'Чирж тойруулна · Хоёр хуруугаар ойртуулна · Хаалган дээр дарж орно',
  entering: 'Босгыг гишгэлгүй, тонгойж орно…',
  inside: 'Чирж эргэн харна · Эд, шошго дээр дарж тайлбарыг уншина',
  exiting: '',
};

interface InfoCard {
  title: string;
  subtitle: string;
  body: string;
  source?: string;
}

export default function Ger3DScreen({ navigation }: RootScreenProps<'Ger3D'>) {
  const insets = useSafeAreaInsets();
  const view = useRef<Ger3DHandle>(null);
  const ger = useQuery({ queryKey: ['ger'], queryFn: fetchGer, staleTime: 30_000 });
  const [mode, setMode] = useState<CameraMode>('orbit');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [info, setInfo] = useState<InfoCard | null>(null);

  const { equipped, byKey } = useMemo(() => {
    const eq: EquippedKeys = {};
    const map = new Map<string, GerItem>();
    for (const item of ger.data?.items ?? []) {
      const key = gerItemKey(item.name);
      if (!key) continue;
      map.set(key, item);
      if (item.equipped) eq[item.slot] = key;
    }
    return { equipped: eq, byKey: map };
  }, [ger.data]);

  const onPick = useCallback(
    (pick: PickResult) => {
      if (!pick) {
        setInfo(null);
        return;
      }
      if (pick.kind === 'door') {
        selectFeedback();
        view.current?.enter();
        return;
      }
      const item = byKey.get(pick.key);
      if (!item) return;
      selectFeedback();
      setInfo({
        title: item.name,
        subtitle: SLOT_PLACE[item.slot],
        body: item.description,
        source: item.sourceRef,
      });
    },
    [byKey],
  );

  const onZone = useCallback((zone: Zone) => {
    selectFeedback();
    setInfo({ title: zone.title, subtitle: zone.subtitle, body: zone.note });
  }, []);

  const onModeChange = useCallback((m: CameraMode) => {
    setMode(m);
    if (m === 'entering' || m === 'exiting') setInfo(null);
  }, []);
  const onReady = useCallback(() => setStatus('ready'), []);
  const onError = useCallback((e: Error) => {
    console.warn('[Ger3D]', e.message);
    setStatus('error');
  }, []);

  const busy = mode === 'entering' || mode === 'exiting';
  const primary = mode === 'inside' || mode === 'exiting' ? 'Гадагш гарах' : 'Гэрт орох';

  return (
    <View style={styles.root}>
      {status !== 'error' && (
        <Ger3DView
          ref={view}
          equipped={equipped}
          onPick={onPick}
          onZone={onZone}
          onModeChange={onModeChange}
          onReady={onReady}
          onError={onError}
        />
      )}

      {status !== 'ready' && (
        <View style={styles.poster} pointerEvents="none">
          <Image
            source={GER_DIORAMA}
            style={styles.posterImage}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          {status === 'loading' ? (
            <View style={styles.posterRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.posterText}>3D гэрийг босгож байна…</Text>
            </View>
          ) : (
            <Text style={styles.posterText}>
              Энэ төхөөрөмж дээр 3D харагдац ажиллахгүй байна.{'\n'}Гэрийн зургийг үзүүллээ.
            </Text>
          )}
        </View>
      )}

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Хаах">
          <Icon name="cross" size={18} color={colors.text} />
        </Pressable>
        <View style={styles.headerText} pointerEvents="none">
          <Text style={styles.title}>Миний гэр</Text>
          <Text style={styles.subtitle}>{status === 'ready' ? MODE_LABEL[mode] : '3D'}</Text>
        </View>
        {status === 'ready' && !busy ? (
          <Pressable
            onPress={() => view.current?.resetView()}
            style={styles.iconButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Харагдацыг анхны байдалд оруулах">
            <Text style={styles.resetText}>↺</Text>
          </Pressable>
        ) : (
          <View style={styles.iconSpacer} />
        )}
      </View>

      {info && (
        <View style={[styles.sheetWrap, { bottom: insets.bottom + 118 }]} pointerEvents="box-none">
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View style={styles.flex}>
                <Text style={styles.sheetTitle}>{info.title}</Text>
                <Text style={styles.sheetSub}>{info.subtitle}</Text>
              </View>
              <Pressable
                onPress={() => setInfo(null)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Тайлбарыг хаах">
                <Icon name="cross" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.sheetBody}>{info.body}</Text>
            {!!info.source && <Text style={styles.sheetSource}>Эх сурвалж: {info.source}</Text>}
          </View>
        </View>
      )}

      {status === 'ready' && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]} pointerEvents="box-none">
          {!!HINT[mode] && <Text style={styles.hint}>{HINT[mode]}</Text>}
          <Pressable
            disabled={busy}
            onPress={() => {
              selectFeedback();
              setInfo(null);
              if (mode === 'inside') view.current?.exit();
              else view.current?.enter();
            }}
            style={({ pressed }) => [styles.primary, busy && styles.primaryDisabled, pressed && styles.primaryPressed]}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            accessibilityLabel={primary}>
            <LinearGradient
              colors={[colors.primaryLight, colors.primary, colors.primaryDark] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.primaryFill}>
              <Icon name="ger" size={18} color={colors.textOnBrass} />
              <Text style={styles.primaryText}>{primary}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },

  poster: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.bg,
  },
  posterImage: { width: '88%', aspectRatio: 1 / GER_DIORAMA_RATIO },
  posterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  posterText: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  headerText: { flex: 1, alignItems: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', letterSpacing: 0.4 },
  subtitle: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '700', letterSpacing: 0.6 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 14, 24, 0.7)',
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  iconSpacer: { width: 44, height: 44 },
  resetText: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: -2 },

  sheetWrap: { position: 'absolute', left: spacing.md, right: spacing.md },
  sheet: {
    backgroundColor: 'rgba(10, 16, 28, 0.94)',
    borderColor: colors.borderGold,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  sheetTitle: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  sheetSub: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600', marginTop: 2 },
  sheetBody: { color: colors.text, fontSize: fontSize.sm, lineHeight: 20 },
  sheetSource: { color: colors.textDim, fontSize: fontSize.xs, fontStyle: 'italic' },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    textAlign: 'center',
    backgroundColor: 'rgba(8, 14, 24, 0.6)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  primary: { alignSelf: 'stretch', borderRadius: radius.md, overflow: 'hidden', minHeight: 52 },
  primaryDisabled: { opacity: 0.5 },
  primaryPressed: { opacity: 0.85 },
  primaryFill: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryText: { color: colors.textOnBrass, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
