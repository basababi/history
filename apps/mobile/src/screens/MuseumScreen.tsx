/**
 * Миний гэр — олдвор ба гэрийн засал (ROADMAP B1)
 *
 * ЯАГААД ӨӨРЧИЛСӨН: Өмнө нь энэ дэлгэц зөвхөн уншдаг олдворын жагсаалт
 * байсан. Lee, Yi, Kim (2020) нарын туршилтад шагнал нь ӨӨРӨӨ
 * ЗАСВАРЛАДАГ ҮЗЭСГЭЛЭН байсан бөгөөд тэд:
 *
 *   «Зорилгодоо хүрсний дараа шагнал үр нөлөөгөө алддаг. Тиймээс
 *    сонирхлыг хадгалж, олон талт байдал өгөхийн тулд ӨӨРЧЛӨХ
 *    бүрэлдэхүүнийг ашигласан.»
 *
 * Монгол хувилбар нь бэлэн: ГЭР бол үзэсгэлэнгийн танхим.
 * Хэрэглэгч өөрийн гэрээ засаж, найздаа үзүүлнэ.
 *
 * ДҮРСЛЭЛ: Гэрийн диорама ба эд бүрийн дүрсийг Blender-ээр рендерлэсэн
 * (tools/blender/). Тунгалаг PNG тул шөнийн тэнгэр дэвсгэрээр харагдана —
 * хуучин JPEG-ийн «цагаан дөрвөлжин» асуудал ингэж арилсан.
 */
import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GerItem, GerSlot } from '@nomad/contracts';
import { fetchGer, updateGerItem } from '@/api/endpoints';
import {
  Card,
  EmptyState,
  ErrorState,
  SectionTitle,
  Skeleton,
} from '@/components/ui';
import { FadeInUp } from '@/components/motion';
import { OrnamentDivider } from '@/components/Ornament';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ScreenCanvas } from '@/components/ScreenCanvas';
import { Icon } from '@/components/Icon';
import {
  GER_ANCHORS,
  GER_DIORAMA,
  GER_DIORAMA_RATIO,
  GerItemArt,
  GerSlotArt,
  SEAL_ART,
} from '@/components/GerArt';

/** Толгойн ард дэлгэрэх үүлэн массын өндөр — агуулгын зайтай уялдана */
const CANVAS_BANK = 120;
import { useCatalog } from '@/hooks/queries';
import { selectFeedback } from '@/feedback';
import {
  colors,
  eraColor,
  fontSize,
  radius,
  spacing,
} from '@/theme';

const SLOT_LABEL: Record<GerSlot, string> = {
  floor: 'Шал',
  wall: 'Хана',
  furniture: 'Тавилга',
  instrument: 'Хөгжим',
  roof: 'Тооно',
  light: 'Гэрэл',
};

const SLOT_ORDER: GerSlot[] = ['roof', 'wall', 'floor', 'furniture', 'instrument', 'light'];

const RARITY_COLOR: Record<string, string> = {
  common: colors.rarityCommon,
  rare: colors.rarityRare,
  epic: colors.rarityEpic,
};

type Tab = 'ger' | 'artifacts';

export default function MuseumScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('ger');

  const ger = useQuery({ queryKey: ['ger'], queryFn: fetchGer, staleTime: 30_000 });
  const catalog = useCatalog();

  const equip = useMutation({
    mutationFn: updateGerItem,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ger'] });
    },
  });

  /** Байрлуулсан эд зүйлс — slot-оор */
  const equipped = useMemo(() => {
    const map = new Map<GerSlot, GerItem>();
    for (const item of ger.data?.items ?? []) {
      if (item.equipped) map.set(item.slot, item);
    }
    return map;
  }, [ger.data]);

  if (ger.isLoading || catalog.isLoading) {
    return (
      <ScreenCanvas spine="ger" bankHeight={CANVAS_BANK}>
        <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
          <View style={{ padding: spacing.md }}>
            <Skeleton height={44} />
            <Skeleton height={180} />
            <Skeleton height={120} />
          </View>
        </View>
      </ScreenCanvas>
    );
  }

  if (ger.isError) {
    return (
      <ScreenCanvas spine="ger" bankHeight={CANVAS_BANK}>
        <View style={[styles.flex, styles.center, { paddingTop: insets.top }]}>
          <ErrorState
            title="Гэрээ ачаалж чадсангүй"
            message="Сүлжээгээ шалгаад дахин оролдоно уу."
            actionLabel="Дахин оролдох"
            onAction={() => void ger.refetch()}
          />
        </View>
      </ScreenCanvas>
    );
  }

  const items = ger.data?.items ?? [];
  const artifacts = catalog.data?.artifacts ?? [];
  const ownedArtifacts = artifacts.filter((a) => a.owned);

  return (
    <ScreenCanvas spine="ger" bankHeight={CANVAS_BANK}>
    <ScrollView
      style={styles.canvasScroll}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + CANVAS_BANK + spacing.sm },
      ]}>
      <ScreenHeader
        title="Миний гэр"
        subtitle={`Түвшин ${ger.data?.level ?? 1} · Сорил давах тусам шинэ эд нээгдэнэ`}
        tone="coral"
      />

      {/* ─── Гэрийн урьдчилсан харагдац ─── */}
      <GerPreview equipped={equipped} level={ger.data?.level ?? 1} />

      {/* ─── Таб ─── */}
      <View style={styles.tabs}>
        <TabButton label="Гэрийн засал" active={tab === 'ger'} onPress={() => setTab('ger')} />
        <TabButton
          label={`Олдвор (${ownedArtifacts.length}/${artifacts.length})`}
          active={tab === 'artifacts'}
          onPress={() => setTab('artifacts')}
        />
      </View>

      {tab === 'ger' ? (
        SLOT_ORDER.map((slot) => {
          const slotItems = items.filter((i) => i.slot === slot);
          if (slotItems.length === 0) return null;
          return (
            <View key={slot} style={styles.slotBlock}>
              <SectionTitle>{SLOT_LABEL[slot]}</SectionTitle>
              <View style={styles.itemRow}>
                {slotItems.map((item) => (
                  <GerItemChip
                    key={item.id}
                    item={item}
                    busy={equip.isPending}
                    onPress={() => {
                      if (!item.available) return;
                      selectFeedback();
                      equip.mutate({ itemId: item.id, equipped: !item.equipped });
                    }}
                  />
                ))}
              </View>
            </View>
          );
        })
      ) : ownedArtifacts.length === 0 ? (
        <EmptyState
          title="Олдвор хараахан алга"
          message="Сорилд 70%-иас дээш оноо авбал олдвор олдоно."
        />
      ) : (
        <View style={styles.itemRow}>
          {artifacts.map((a) => (
            <View
              key={a.id}
              style={[styles.artifact, !a.owned && styles.artifactLocked]}
              accessibilityLabel={a.owned ? a.name : 'Нээгдээгүй олдвор'}>
              {a.owned ? (
                <Text style={styles.artifactEmoji}>{a.emoji ?? '🏺'}</Text>
              ) : (
                <Image
                  source={SEAL_ART}
                  style={styles.artifactSeal}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              )}
              <Text
                style={[styles.artifactName, !a.owned && styles.textLocked]}
                numberOfLines={2}>
                {a.owned ? a.name : 'Битүүмжлэлтэй'}
              </Text>
              {a.owned && (
                <Text style={[styles.artifactRarity, { color: RARITY_COLOR[a.rarity] }]}>
                  {a.rarity === 'epic' ? 'Хамгийн ховор' : a.rarity === 'rare' ? 'Ховор' : 'Энгийн'}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
    </ScreenCanvas>
  );
}

// ─── Шөнийн тэнгэр ─────────────────────────────────────────────────

/**
 * Долоон бурхан (Их баавгайн од) — Монголчуудын эртнээс шүтэж ирсэн
 * одны ордон. Шөнийн тэнгэрийг «ерөнхий од»-оор биш, соёлын танигдах
 * тэмдгээр илэрхийлнэ. Утаа баруун дээш хийсдэг тул зүүн дээд буланд.
 */
const DIPPER: readonly (readonly [number, number])[] = [
  [0.05, 0.08], [0.11, 0.055], [0.165, 0.075], [0.215, 0.115],
  [0.295, 0.105], [0.3, 0.19], [0.225, 0.2],
];
const DIPPER_LINKS: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3],
];
/** x, y, радиус, тунгалаг байдал — тогтмол, санамсаргүй бус (дүрс анивчихгүй) */
const STARS: readonly (readonly [number, number, number, number])[] = [
  [0.42, 0.06, 1.1, 0.7], [0.56, 0.03, 0.8, 0.5], [0.74, 0.07, 1.3, 0.8],
  [0.88, 0.12, 0.9, 0.6], [0.93, 0.3, 1.2, 0.55], [0.82, 0.24, 0.7, 0.4],
  [0.66, 0.18, 0.8, 0.45], [0.38, 0.2, 0.7, 0.4], [0.08, 0.3, 1.0, 0.5],
  [0.03, 0.5, 0.8, 0.35], [0.96, 0.5, 0.9, 0.4], [0.9, 0.66, 0.7, 0.3],
  [0.12, 0.62, 0.6, 0.3], [0.47, 0.13, 0.6, 0.35],
];

function NightSky({ w, h }: { w: number; h: number }) {
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="gerHalo" cx="50%" cy="60%" r="58%">
          <Stop offset="0" stopColor={colors.primary} stopOpacity={0.16} />
          <Stop offset="0.5" stopColor={colors.ink.indigo} stopOpacity={0.16} />
          <Stop offset="1" stopColor={colors.bg} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={w * 0.5} cy={h * 0.6} r={Math.max(w, h) * 0.58} fill="url(#gerHalo)" />
      {DIPPER_LINKS.map(([a, b]) => (
        <Line
          key={`l${a}-${b}`}
          x1={DIPPER[a][0] * w}
          y1={DIPPER[a][1] * h}
          x2={DIPPER[b][0] * w}
          y2={DIPPER[b][1] * h}
          stroke={colors.primaryLight}
          strokeOpacity={0.2}
          strokeWidth={0.8}
        />
      ))}
      {DIPPER.map(([x, y], i) => (
        <Circle key={`d${i}`} cx={x * w} cy={y * h} r={1.7} fill={colors.primaryLight} />
      ))}
      {STARS.map(([x, y, r, o], i) => (
        <Circle key={`s${i}`} cx={x * w} cy={y * h} r={r} fill="#FFFFFF" opacity={o} />
      ))}
    </Svg>
  );
}

// ─── Гэрийн хэсгүүдийн шошго ──────────────────────────────────────

type Spot = {
  key: string;
  title: string;
  value: string;
  /** Гэрийн хэсэг дээрх цэг — Blender-ээс тооцоолсон (GER_ANCHORS) */
  anchor: readonly [number, number];
  /** Шугамын нөгөө үзүүр, шошго энд наалдана */
  end: readonly [number, number];
  place: 'left' | 'right' | 'below';
};

const TAG_W = 108;
const TAG_H = 30;

/**
 * Шошго нь гэрийн ЯГ тухайн хэсгийг заана: цэг + алтан шугам + хайрцаг.
 * Цэгүүдийг Blender камераас проекц хийж гаргасан тул зураг ямар ч
 * өргөнтэй байсан тооно тоононы дээр, босго босгон дээр байна.
 */
function Hotspots({ w, h, spots }: { w: number; h: number; spots: Spot[] }) {
  return (
    <>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
        {spots.map((s) => {
          const ax = s.anchor[0] * w;
          const ay = s.anchor[1] * h;
          return (
            <React.Fragment key={s.key}>
              <Line
                x1={ax}
                y1={ay}
                x2={s.end[0] * w}
                y2={s.end[1] * h}
                stroke={colors.primary}
                strokeWidth={1}
                strokeOpacity={0.85}
              />
              <Circle cx={ax} cy={ay} r={7.5} fill={colors.primary} fillOpacity={0.2} />
              <Circle
                cx={ax}
                cy={ay}
                r={3.4}
                fill={colors.primaryLight}
                stroke={colors.bgSunken}
                strokeWidth={1}
              />
            </React.Fragment>
          );
        })}
      </Svg>
      {spots.map((s) => {
        const ex = s.end[0] * w;
        const ey = s.end[1] * h;
        const rawLeft =
          s.place === 'left' ? ex - TAG_W : s.place === 'right' ? ex : ex - TAG_W / 2;
        const left = Math.min(Math.max(rawLeft, 2), w - TAG_W - 2);
        const top = s.place === 'below' ? ey : ey - TAG_H / 2;
        return (
          <View
            key={s.key}
            style={[styles.tag, { left, top, width: TAG_W }]}
            accessible
            accessibilityLabel={`${s.title}: ${s.value}`}>
            <Text style={styles.tagTitle}>{s.title}</Text>
            <Text style={styles.tagValue} numberOfLines={1}>
              {s.value}
            </Text>
          </View>
        );
      })}
    </>
  );
}

/** 3D Монгол гэрийн харагдац — байрлуулсан эд зүйлстэй */
function GerPreview({ equipped, level }: { equipped: Map<GerSlot, GerItem>; level: number }) {
  const navigation = useNavigation();
  const [w, setW] = useState(0);
  const h = w * GER_DIORAMA_RATIO;

  const roof = equipped.get('roof');
  const wall = equipped.get('wall');
  const floor = equipped.get('floor');
  const furniture = equipped.get('furniture');
  const instrument = equipped.get('instrument');
  const light = equipped.get('light');

  const spots: Spot[] = [
    {
      key: 'toono',
      title: 'ТООНО',
      value: roof ? roof.name : 'Энгийн тооно',
      anchor: GER_ANCHORS.toono,
      end: [0.3, 0.25],
      place: 'left',
    },
    {
      key: 'khana',
      title: 'ХАНА',
      value: wall ? wall.name : 'Эсгий туурга',
      anchor: GER_ANCHORS.khana,
      end: [0.12, 0.84],
      place: 'below',
    },
    {
      key: 'bosgo',
      title: 'ШАЛ / БОСГО',
      value: floor ? floor.name : 'Модон босго',
      anchor: GER_ANCHORS.bosgo,
      end: [0.62, 0.9],
      place: 'right',
    },
  ];

  return (
    <FadeInUp>
      <Card glow accent={colors.primary} style={styles.preview}>
        <View style={styles.gerTitleRow}>
          <Text style={styles.gerHeroBadge}>{`ТҮВШИН ${level} · ӨРГӨӨ`}</Text>
          <Text style={styles.gerItemCount}>{equipped.size}/6 эд байрлуулсан</Text>
        </View>

        <View style={styles.gerStage} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
          {w > 0 && (
            <>
              <NightSky w={w} h={h} />
              <Image
                source={GER_DIORAMA}
                style={{ width: w, height: h }}
                resizeMode="contain"
                accessibilityLabel="Монгол гэрийн 3D дүрс"
                accessibilityIgnoresInvertColors
              />
              <Hotspots w={w} h={h} spots={spots} />
            </>
          )}
        </View>

        {/* Бодит цагийн 3D — тойрон харах, гэрт орох, эдийг уламжлалт байранд нь үзэх */}
        <Pressable
          onPress={() => {
            selectFeedback();
            navigation.navigate('Ger3D');
          }}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
          accessibilityLabel="Гэрийг 3D-ээр тойрон харах, дотор нь орох">
          <Icon name="ger" size={18} color={colors.textOnBrass} />
          <Text style={styles.ctaText}>3D-ээр тойрон харах · Гэрт орох</Text>
        </Pressable>

        <View style={styles.equippedBar}>
          <EquippedBadge label="Тавилга" slot="furniture" item={furniture} />
          <EquippedBadge label="Хөгжим" slot="instrument" item={instrument} />
          <EquippedBadge label="Гэрэл" slot="light" item={light} />
        </View>

        <OrnamentDivider style={{ marginTop: spacing.sm }} />

        <Text style={styles.previewHint}>
          {equipped.size === 0
            ? 'Гэрээ тохижуулж эхлээрэй — доорх эдээс сонгоно уу'
            : 'Сорил давж түвшин ахих тусам эртний шинэ эд зүйлс нээгдэнэ'}
        </Text>
      </Card>
    </FadeInUp>
  );
}

function EquippedBadge({
  label,
  slot,
  item,
}: {
  label: string;
  slot: GerSlot;
  item?: GerItem;
}) {
  return (
    <View style={[styles.eqBadge, item && styles.eqBadgeActive]}>
      {item ? <GerItemArt item={item} size={34} /> : <GerSlotArt slot={slot} size={34} dim />}
      <View style={{ flex: 1 }}>
        <Text style={styles.eqLabel}>{label}</Text>
        <Text style={[styles.eqName, item && { color: colors.primary }]} numberOfLines={1}>
          {item ? item.name : 'Хоосон'}
        </Text>
      </View>
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function GerItemChip({
  item,
  busy,
  onPress,
}: {
  item: GerItem;
  busy: boolean;
  onPress: () => void;
}) {
  const era = eraColor(item.eraId);
  const rarity = RARITY_COLOR[item.rarity] ?? colors.rarityCommon;

  return (
    <Pressable
      onPress={onPress}
      disabled={!item.available || busy}
      accessibilityRole="button"
      accessibilityLabel={
        item.available
          ? `${item.name}${item.equipped ? ', байрлуулсан' : ''}`
          : `${item.name} түгжээтэй, ${item.unlockLevel}-р түвшин`
      }
      accessibilityState={{ selected: item.equipped, disabled: !item.available }}
      style={[
        styles.chip,
        { borderColor: item.equipped ? colors.primary : colors.border },
        item.equipped && styles.chipEquipped,
        !item.available && styles.chipLocked,
      ]}>
      {/* Түгжээтэй үед эдийн сүүдэр + алтан гэрэгэ — бүдэгрүүлэхгүй, битүүмжлэл тод байх ёстой */}
      <GerItemArt item={item} size={64} />
      <Text style={[styles.chipName, !item.available && styles.textLocked]} numberOfLines={2}>
        {item.name}
      </Text>
      {!item.available && (
        <Text style={styles.chipLevel}>{`${item.unlockLevel}-р түвшинд нээгдэнэ`}</Text>
      )}
      {item.available && (
        <View style={[styles.chipRarity, { backgroundColor: rarity }]}>
          <Text style={styles.chipRarityText}>
            {item.rarity === 'epic' ? 'Эпик' : item.rarity === 'rare' ? 'Ховор' : 'Энгийн'}
          </Text>
        </View>
      )}
      {item.eraId && era.label !== '' && (
        <Text style={[styles.chipEra, { color: era.main }]} numberOfLines={1}>
          {era.label}
        </Text>
      )}
      {item.equipped && <Text style={styles.chipMark}>✓</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /**
   * ⚠ ДЭВСГЭРГҮЙ: `ScreenCanvas` дэвсгэр, үүл, жаазыг өөрөө зурдаг.
   * Энд `backgroundColor` тавибал тунгалаггүй давхарга үүсч чимэглэлийг
   * бүрэн далдална — ачаалалт ба алдааны төлөвт яг тэр болж байв.
   */
  flex: { flex: 1 },
  center: { justifyContent: 'center' },
  canvasScroll: { flex: 1, backgroundColor: 'transparent' },
  container: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },

  // Гэрийн 3D харагдац
  preview: { paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
  gerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  gerHeroBadge: {
    color: colors.primary,
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  gerItemCount: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  /**
   * Өндрийг зургийн харьцаагаар урьдчилан тогтооно — `onLayout`-оос өмнө
   * 0 өндөртэй байж, дараа нь үсрэх (layout jump) асуудлаас сэргийлнэ.
   */
  gerStage: {
    width: '100%',
    aspectRatio: 1 / GER_DIORAMA_RATIO,
    marginVertical: spacing.xs,
  },
  tag: {
    position: 'absolute',
    backgroundColor: 'rgba(8, 14, 24, 0.86)',
    borderWidth: 1,
    borderColor: colors.borderGold,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  tagTitle: {
    color: colors.primary,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tagValue: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '600',
  },
  equippedBar: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  eqBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bgSunken,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  eqBadgeActive: {
    borderColor: colors.borderGold,
    backgroundColor: colors.bgCardLight,
  },
  eqLabel: { color: colors.textDim, fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },
  eqName: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  previewHint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 46,
    marginTop: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: colors.textOnBrass, fontSize: fontSize.sm, fontWeight: '800', letterSpacing: 0.3 },

  // Таб
  tabs: { flexDirection: 'row', gap: spacing.sm },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
  },
  tabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.bgCardLight,
  },
  tabText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '700' },
  tabTextActive: { color: colors.primary },

  // Эд зүйл
  slotBlock: { gap: spacing.xs },
  itemRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    width: '47%',
    flexGrow: 1,
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 4,
    minHeight: 132,
  },
  chipEquipped: {
    borderColor: colors.primary,
    backgroundColor: colors.bgCardLight,
  },
  /** Бүхэлд нь бүдэгрүүлэхгүй — гэрэгэ тод, зөвхөн дэвсгэр ба бичиг намжина */
  chipLocked: { backgroundColor: colors.bgSunken },
  textLocked: { color: colors.textMuted },
  chipName: {
    color: colors.text,
    fontSize: fontSize.xs,
    fontWeight: '700',
    textAlign: 'center',
  },
  chipLevel: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  chipRarity: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  chipRarityText: {
    color: colors.textOnBrass,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  chipEra: { fontSize: 9 },
  chipMark: { position: 'absolute', top: 6, right: 8, color: colors.primary, fontWeight: '900' },

  // Олдвор
  artifact: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.bgCard,
    borderWidth: 1.2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 114,
  },
  artifactLocked: { backgroundColor: colors.bgSunken },
  artifactEmoji: { fontSize: 34 },
  artifactSeal: { width: 44, height: 44 },
  artifactName: {
    color: colors.text,
    fontSize: fontSize.xs,
    fontWeight: '700',
    textAlign: 'center',
  },
  artifactRarity: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
});
