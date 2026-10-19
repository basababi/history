/**
 * Ger3DView — GLView + дохио зангаа + 3D-д «наалдсан» шошго
 *
 * ДОХИО ЗАНГАА (react-native-gesture-handler-гүй — RN-ийн PanResponder):
 *   нэг хуруу чирэх  → гаднаас тойрох / дотроос эргэн харах
 *   хоёр хуруу       → ойртуулах (гадна) / харааны өнцөг (дотор)
 *   товших           → шошго: тайлбар; эд: мэдээлэл; хаалга: гэрт орох
 *
 * ⚠ `nativeEvent.touches` БИШ `gestureState`: Android дээр хуруу өргөсний
 *   дараа ч `touches`-д хуучин хүрэлт үлдэж, нэг хуруугаар чирэхийг «хоёр
 *   хуруу» гэж андуурч харааны өнцгийг огцом томруулж байв. PanResponder-ийн
 *   `numberActiveTouches` ба нийлбэр `dx/dy` найдвартай.
 *
 * ⚠ Шошго ТОВШИГДОХГҮЙ (pointerEvents="none"): кадр бүр хөдөлдөг touchable
 *   нь хүрэлтийг найдваргүй хүлээн авч, доорх 3D гадаргуу руу «нэвтэрч»
 *   байв. Иймд бүх товшилтыг НЭГ гадаргуу хүлээн авч, шошгыг проекцлосон
 *   байрлалаар нь өөрөө шалгана — хит-тест нэг газар.
 *
 * ШОШГОНЫ БАЙРЛАЛ: 3D цэгийг кадр бүр проекцлоод Reanimated-ийн shared
 * value-д бичнэ — UI thread дээр шинэчлэгдэх тул React дахин рендерлэхгүй
 * (60 удаа/сек setState хийвэл JS thread гацна).
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  LogBox,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useIsFocused } from '@react-navigation/native';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { GerEngine, type CameraMode, type PickResult, type Projected } from './GerEngine';
import { loadGlb } from './loadGlb';
import { sceneStateFor, type EquippedKeys } from './sceneRules';
import { ZONES, type Zone } from './zones';
import { colors } from '@/theme';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const GER_GLB: number = require('../../assets/ger/ger-realtime.glb');

// three r162 WebGL1 дээр «хуучирсан» гэж анхааруулдаг — санаатай шийдэл
// (GerEngine.ts-ийн толгойг үз). Хөгжүүлэлтийн toast «Гэрт орох»-ыг далдалж байв.
LogBox.ignoreLogs(['THREE.WebGLRenderer: WebGL 1 support was deprecated']);

const TAP_SLOP = 10;
const TAP_MS = 350;
const HIDDEN = -9999;
/** Шошгоны товших муж — цэгээс (цэг + хайрцаг, хуруунд хангалттай том) */
const LABEL_HIT = { left: 16, right: 150, top: 18, bottom: 46 } as const;

export interface Ger3DHandle {
  enter(): void;
  exit(): void;
  resetView(): void;
}

interface Props {
  equipped: EquippedKeys;
  onPick: (pick: PickResult) => void;
  onZone: (zone: Zone) => void;
  onModeChange: (mode: CameraMode) => void;
  onReady: () => void;
  onError: (error: Error) => void;
}

interface LabelHit {
  zone: Zone;
  x: number;
  y: number;
}

function ZoneLabel({ zone, index, data }: { zone: Zone; index: number; data: SharedValue<number[]> }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: data.value[index * 2] }, { translateY: data.value[index * 2 + 1] }],
  }));
  return (
    <Animated.View
      style={[styles.label, style]}
      pointerEvents="none"
      accessible
      accessibilityLabel={`${zone.title}, ${zone.subtitle}`}>
      <View style={styles.labelRow}>
        <View style={styles.dot} />
        <View style={styles.labelBox}>
          <Text style={styles.labelTitle}>{zone.title}</Text>
          <Text style={styles.labelSub}>{zone.subtitle}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export const Ger3DView = forwardRef<Ger3DHandle, Props>(function Ger3DView(props, ref) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const engineRef = useRef<GerEngine | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const hitsRef = useRef<LabelHit[]>([]);
  const focused = useIsFocused();
  const labels = useSharedValue<number[]>(new Array(ZONES.length * 2).fill(HIDDEN));

  useImperativeHandle(ref, () => ({
    enter: () => engineRef.current?.enter(),
    exit: () => engineRef.current?.exit(),
    resetView: () => engineRef.current?.resetView(),
  }));

  // Байрлуулсан эд өөрчлөгдвөл үзэгдлийг шууд шинэчилнэ (дахин ачаалахгүй)
  useEffect(() => {
    engineRef.current?.applyState(sceneStateFor(props.equipped));
  }, [props.equipped]);

  // Дэлгэц солигдох эсвэл апп ард гарахад GPU-г бүрэн чөлөөлнө (батарей)
  useEffect(() => {
    engineRef.current?.setPaused(!focused);
    const sub = AppState.addEventListener('change', (s) => {
      engineRef.current?.setPaused(s !== 'active' || !focused);
    });
    return () => sub.remove();
  }, [focused]);

  useEffect(
    () => () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    },
    [],
  );

  const updateLabels = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const mode = engine.getMode();
    const cam = engine.cameraPosition();
    const out: Projected = { x: 0, y: 0, visible: false };
    const next = new Array<number>(ZONES.length * 2);
    const hits: LabelHit[] = [];
    ZONES.forEach((zone, i) => {
      let show = mode === 'inside' ? zone.inside : mode === 'orbit' && zone.outside;
      // Гаднаас: босго зөвхөн хаалганы талаас, тооно зөвхөн дээвэр дээгүүр харагдана
      if (show && mode === 'orbit') {
        if (zone.id === 'bosgo') show = cam.z > 1.5;
        if (zone.id === 'toono') show = cam.y > 3.0;
      }
      engine.project(zone.anchor, out);
      const vis = show && out.visible;
      next[i * 2] = vis ? out.x - 6 : HIDDEN;
      next[i * 2 + 1] = vis ? out.y - 6 : HIDDEN;
      if (vis) hits.push({ zone, x: out.x, y: out.y });
    });
    labels.value = next;
    hitsRef.current = hits;
  }, [labels]);

  const onContextCreate = useCallback(
    async (gl: ExpoWebGLRenderingContext) => {
      if (!size) return;
      try {
        const engine = new GerEngine(gl, size.w, size.h);
        engineRef.current = engine;
        engine.onModeChange = (m) => {
          if (m !== 'inside' && m !== 'orbit') hitsRef.current = [];
          propsRef.current.onModeChange(m);
        };
        engine.onFrame = updateLabels;
        engine.applyState(sceneStateFor(propsRef.current.equipped));
        engine.start();
        const gltf = await loadGlb(GER_GLB);
        if (engineRef.current !== engine) return; // ачаалах зуур дэлгэцээс гарсан
        engine.setModel(gltf);
        propsRef.current.onReady();
      } catch (e) {
        propsRef.current.onError(e instanceof Error ? e : new Error(String(e)));
      }
    },
    [size, updateLabels],
  );

  const responder = useMemo(() => {
    let prevDx = 0;
    let prevDy = 0;
    let pinchDist = 0;
    let pinched = false;
    let wasMulti = false;
    let startT = 0;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        prevDx = 0;
        prevDy = 0;
        pinchDist = 0;
        pinched = false;
        wasMulti = false;
        startT = Date.now();
      },
      onPanResponderMove: (e, g) => {
        const engine = engineRef.current;
        if (!engine) return;
        if (g.numberActiveTouches >= 2) {
          const t = e.nativeEvent.touches;
          const d = t.length >= 2 ? Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY) : 0;
          if (d > 0 && pinchDist > 0) engine.pinch(d / pinchDist);
          pinchDist = d;
          pinched = true;
          wasMulti = true;
          prevDx = g.dx;
          prevDy = g.dy;
          return;
        }
        if (wasMulti) {
          // Хуруу өргөхөд төв цэг үсэрнэ — энэ нэг алхмыг чирэлт гэж тооцохгүй
          wasMulti = false;
          pinchDist = 0;
          prevDx = g.dx;
          prevDy = g.dy;
          return;
        }
        engine.drag(g.dx - prevDx, g.dy - prevDy);
        prevDx = g.dx;
        prevDy = g.dy;
      },
      onPanResponderRelease: (e, g) => {
        if (pinched || Math.hypot(g.dx, g.dy) > TAP_SLOP || Date.now() - startT > TAP_MS) return;
        const x = e.nativeEvent.locationX;
        const y = e.nativeEvent.locationY;
        const hit = hitsRef.current.find(
          (h) =>
            x >= h.x - LABEL_HIT.left &&
            x <= h.x + LABEL_HIT.right &&
            y >= h.y - LABEL_HIT.top &&
            y <= h.y + LABEL_HIT.bottom,
        );
        if (hit) {
          propsRef.current.onZone(hit.zone);
          return;
        }
        const engine = engineRef.current;
        if (engine) propsRef.current.onPick(engine.pick(x, y));
      },
    });
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size && width > 0 && height > 0) setSize({ w: width, h: height });
  };

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
      <View
        style={StyleSheet.absoluteFill}
        {...responder.panHandlers}
        accessible
        accessibilityLabel="Монгол гэрийн 3D харагдац. Чирж эргүүлнэ, хоёр хуруугаар ойртуулна.">
        {size && <GLView style={StyleSheet.absoluteFill} msaaSamples={4} onContextCreate={onContextCreate} />}
      </View>
      {ZONES.map((zone, i) => (
        <ZoneLabel key={zone.id} zone={zone} index={i} data={labels} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  label: { position: 'absolute', left: 0, top: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: 'rgba(8, 14, 24, 0.9)',
  },
  labelBox: {
    backgroundColor: 'rgba(8, 14, 24, 0.82)',
    borderColor: colors.borderGold,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  labelTitle: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  labelSub: { color: colors.text, fontSize: 10, fontWeight: '600' },
});
