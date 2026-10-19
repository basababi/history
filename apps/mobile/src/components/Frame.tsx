/**
 * Жаазан зохиомж — лавлах зургуудын БҮТЦИЙН систем
 *
 * ══ ӨМНӨХ ОЙЛГОЛТЫН АЛДАА ══
 *
 * Эхний хувилбарт үүлэн хээг «чимэглэлийн зурвас» гэж үзсэн — дээд талд
 * нэг нимгэн тууз. Лавлах зургууд өөр зүйл заасан:
 *
 *   • Зохиомжийг барьдаг зүйл нь ЖААЗ — дэлгэцээс дотогш ухарсан
 *     алтан хос шугам, буландаа ЭВЭР УГАЛЗ.
 *   • Үүл бол нимгэн трим БИШ, харин ТОМ ЭЗЭЛХҮҮНТЭЙ МАСС. Тэр нь
 *     жаазны ирмэгээс халин орж, гүн үүсгэнэ.
 *   • Чимэглэл БУЛАНД төвлөрч, гол талбайг чөлөөтэй үлдээнэ.
 *   • Дэвсгэрт бараг мэдэгдэхгүй бүтэц (дамаск / хайрс) байна —
 *     хавтгай өнгө хэзээ ч байдаггүй.
 *
 * ══ ИНЖЕНЕРИЙН ХЯЗГААР ══
 *
 * Энэ бүх давхарга нь дэлгэц БҮРД рендерлэгдэнэ. Тиймээс:
 *   • давхарга бүр НЭГ `<Path>` — олон зангилаа биш
 *   • `pointerEvents="none"` — хүрэлтийг хэзээ ч барихгүй
 *   • хэмжээ солигдоход л дахин тооцоолно (`useMemo`)
 */
import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { colors } from '@/theme';

// ═════════════════════════════════════════════════════════════
// 1. Дэвсгэрийн бүтэц — эвэр угалзын сийрэг тархалт
// ═════════════════════════════════════════════════════════════

/**
 * Бараг мэдэгдэхгүй давтагдах хээ. Лавлах зургуудын «баялаг» мэдрэмж
 * ихэвчлэн ЭНДЭЭС гардаг — хавтгай өнгө хямд харагддаг.
 *
 * ⚠ Тунгалаг байдал 0.05-аас хэтрэхгүй. Хээ анзаарагдвал текст уншихад
 *   саад болно; зорилго нь «баялаг» мэдрэмж, харагдах хээ биш.
 */
export function PatternGround({
  width,
  height,
  color = colors.borderStrong,
  opacity = 0.05,
  style,
}: {
  width: number;
  height: number;
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const d = useMemo(() => {
    /**
     * ⚠ ГҮЙЦЭТГЭЛ: R=26 үед 1080x2400 дэлгэцэд ~1060 нум буюу ~48KB
     * замын мөр үүсдэг — тав таб дэлгэц бүрд. R=48 үед 363 нум (~16KB)
     * буюу гурав дахин хямд. 0.05 тунгалагт нарийн хээ ямар ч байсан
     * анзаарагдахгүй тул томруулснаар алдах зүйл алга.
     */
    /**
     * ⚠ ХЯТАД ХЭЭГ СОЛИВ: өмнө нь seigaiha (хайрсан давалгаа) байсан —
     * япон/хятад хээ. Одоо жижиг ЭВЭР УГАЛЗ сийрэг тархана.
     *
     * ГҮЙЦЭТГЭЛ: 72px алхамтай тул 412x915 дэлгэцэд ~90 угалз буюу
     * seigaiha-гийн 363 нумаас дөрөв дахин хямд.
     */
    const STEP = 72;
    let s = '';
    let row = 0;
    for (let y = -STEP; y <= height + STEP; y += STEP, row++) {
      const offset = row % 2 === 0 ? 0 : STEP / 2;
      for (let x = -STEP; x <= width + STEP; x += STEP) {
        const cx = x + offset;
        // Эвэр угалзын нэгж — нум татаад үзүүртээ мушгиа
        s +=
          `M${cx} ${y + 13} ` +
          `C${cx} ${y + 4}, ${cx + 6} ${y}, ${cx + 12} ${y + 1} ` +
          `C${cx + 17} ${y + 2}, ${cx + 18} ${y + 8}, ${cx + 13} ${y + 9} ` +
          `C${cx + 10} ${y + 9.5}, ${cx + 9} ${y + 7}, ${cx + 11} ${y + 6} `;
      }
    }
    return s.trim();
  }, [width, height]);

  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width={width} height={height}>
        <Path d={d} fill="none" stroke={color} strokeWidth={1} opacity={opacity} />
      </Svg>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════
// 2. Алтан жааз — шаталсан булантай
// ═════════════════════════════════════════════════════════════

/**
 * ЭВЭР УГАЛЗЫН булан.
 *
 * ⚠ БҮТЭЦ ЗАСВАР: өмнө нь энд ШАТАЛСАН ХААЛТ (回 хээ) байсан. Тэр нь
 * ХЯТАДЫН меандр — монгол чимэглэлд хэрэглэгддэггүй. Хайрсан дэвсгэр
 * (seigaiha) нь ч мөн адил япон/хятад. Хоёулаа нийлээд аппыг монгол
 * биш, хятад мэт харагдуулж байв.
 *
 * Эвэр угалз (хуцын эврийн мушгиа) бол монгол угалзны ХАМГИЙН
 * танигдам нэгж. Нуман татаж эргэн, үзүүртээ мушгиа хийнэ.
 *
 * (x,y) — булангийн цэг. sx/sy нь дотогшлох чиглэл.
 */
function hornCorner(x: number, y: number, S: number, sx: 1 | -1, sy: 1 | -1): string {
  const px = (k: number) => x + sx * S * k;
  const py = (k: number) => y + sy * S * k;

  // Гадна нум — булангийн эргэлт
  const sweep =
    `M${x} ${py(1)} ` +
    `C${x} ${py(0.42)}, ${px(0.42)} ${y}, ${px(1)} ${y}`;

  // Дотор мушгиа — эврийн ороолт
  const curl =
    `M${px(0.28)} ${py(0.3)} ` +
    `C${px(0.64)} ${py(0.2)}, ${px(0.7)} ${py(0.58)}, ${px(0.4)} ${py(0.62)} ` +
    `C${px(0.22)} ${py(0.64)}, ${px(0.2)} ${py(0.44)}, ${px(0.34)} ${py(0.42)}`;

  return `${sweep} ${curl}`;
}

export function OrnateFrame({
  width,
  height,
  /** Ирмэгээс дотогш ухрах зай */
  inset = 12,
  color = colors.primary,
  /** Хос шугамын хоорондын зай — 0 бол ганц шугам */
  double = 5,
  opacity = 0.55,
  style,
}: {
  width: number;
  height: number;
  inset?: number;
  color?: string;
  double?: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const geo = useMemo(() => {
    const o = inset;
    const i = inset + double;
    const rect = (p: number) =>
      `M${p} ${p} H${width - p} V${height - p} H${p} Z`;

    const S = 30;
    const brackets = [
      hornCorner(o, o, S, 1, 1),
      hornCorner(width - o, o, S, -1, 1),
      hornCorner(o, height - o, S, 1, -1),
      hornCorner(width - o, height - o, S, -1, -1),
    ].join(' ');

    return { outer: rect(o), inner: double > 0 ? rect(i) : '', brackets };
  }, [width, height, inset, double]);

  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width={width} height={height} opacity={opacity}>
        <Path d={geo.outer} fill="none" stroke={color} strokeWidth={1.4} />
        {geo.inner !== '' && (
          <Path d={geo.inner} fill="none" stroke={color} strokeWidth={0.8} opacity={0.6} />
        )}
        {/* Булангийн шаталсан хаалт — гурав дахин зузаан */}
        <Path
          d={geo.brackets}
          fill="none"
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════
// 3. Үүлэн масс — эзэлхүүнтэй, давхаргатай
// ═════════════════════════════════════════════════════════════

export type BankTone = {
  back: string;
  mid: string;
  front: string;
  line: string;
};

/**
 * ══ ХОЁР УДААГИЙН ЭРГЭЛТ ══
 *
 * 1-Р ОРОЛДЛОГО: ханасан гуулин (#6B4813 → #E0A03C). Хар хөх дэвсгэр
 *    дээр бараан хүрэн тавихад ШАВАР болж байв.
 * 2-Р ОРОЛДЛОГО: өнгө дээрээ өнгө (tone-on-tone) — дэвсгэрээс арайхан
 *    цайвар хөх. Цэвэрхэн боловч УЙТГАРТАЙ, бүдэг.
 *
 * ОДОО: лавлах 1, 2-р зургийн жинхэнэ заль нь —
 *   • давхарга бүр ӨӨР ӨНГӨТЭЙ (индиго, шүр, хаш, цайвар зэрэг оршино)
 *   • давхарга бүрийг ЦАГААН КОНТУР хүрээлнэ
 *
 * Цагаан контур нь чухал: түүнгүйгээр ханасан өнгөнүүд бие биедээ
 * шингэж шаварддаг. Контуртай бол өнгө бүр тусдаа цойлж харагдана.
 * Энэ бол монгол зурагт ч, лавлах зурагт ч ижил хэрэглэгддэг арга.
 */
export const bankTones: Record<'brass' | 'sky' | 'coral' | 'jade', BankTone> = {
  brass: { back: colors.ink.indigoDeep, mid: colors.ink.indigo, front: colors.ink.coral, line: colors.ink.halo },
  sky: { back: colors.ink.indigo, mid: colors.ink.teal, front: colors.sky, line: colors.ink.halo },
  coral: { back: colors.ink.indigoDeep, mid: colors.ink.coral, front: colors.primary, line: colors.ink.halo },
  jade: { back: colors.ink.indigoDeep, mid: colors.ink.sage, front: colors.ink.cream, line: colors.ink.halo },
};

/** Нэг давхаргын дэлбээт ирмэг. Радиус жигд БИШ — машин шиг харагдахгүйн тулд */
function bankLayer(
  width: number,
  baseY: number,
  bottomY: number,
  radii: number[],
  seed: number
): { path: string; line: string; eyes: Array<{ cx: number; cy: number; r: number }> } {
  let d = `M0 ${baseY}`;
  const eyes: Array<{ cx: number; cy: number; r: number }> = [];
  let x = 0;
  let i = seed;
  let guard = 0;

  while (x < width && guard++ < 160) {
    const r = radii[i % radii.length]!;
    const nx = Math.min(x + r * 2, width);
    const rr = Math.max(2, (nx - x) / 2);
    // Дээш бүлтийсэн дэлбээ
    d += ` A ${rr} ${rr} 0 0 1 ${nx} ${baseY}`;
    /**
     * ⚠ Мушгиа нүдийг ХАССАН: жигд давтагдахдаа үүл биш ХАЙРС шиг
     * уншигддаг байв. Уламжлалт үүлэн хээнд мушгиа нь цөөн, санамсаргүй
     * байрлалтай — жигд тор биш.
     */
    void rr;
    x = nx;
    i++;
  }

  return {
    path: `${d} L${width} ${bottomY} L0 ${bottomY} Z`,
    line: d,
    eyes,
  };
}

/**
 * Үүлэн эрэг — дэлгэцийн доод (эсвэл дээд) ирмэгийг дүүргэх үүлэн масс.
 *
 * Лавлах 4-р зургийн бүтэц: гурван давхарга дэлбээ, ар нь бараан,
 * урд нь тод. Энэ давхаргалалт нь эзэлхүүн өгдөг — ганц дэлбээт зурвас
 * хавтгай, «wireframe» шиг харагддаг.
 */
export function CloudBank({
  width,
  height = 120,
  tone = 'brass',
  /** Аль ирмэгт наалдах — `bottom` бол үүл доороос дээш ургана */
  edge = 'bottom',
  opacity = 1,
  style,
}: {
  width: number;
  height?: number;
  tone?: keyof typeof bankTones | BankTone;
  edge?: 'top' | 'bottom';
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = typeof tone === 'string' ? bankTones[tone] : tone;

  const layers = useMemo(() => {
    const H = height;
    return [
      // Хоёр давхарга — гурав нь энэ өндөрт бөглүү болдог.
      // Радиусын зөрүү ИХ байх нь чухал: ойролцоо бол механик давталт шиг.
      { ...bankLayer(width, H * 0.34, H, [38, 19, 30, 23, 44, 17], 0), color: t.back, outline: true },
      { ...bankLayer(width, H * 0.66, H, [26, 41, 20, 33, 24, 15], 3), color: t.front, outline: true },
    ];
  }, [width, height, t]);

  return (
    <View style={style} pointerEvents="none">
      <Svg
        width={width}
        height={height}
        opacity={opacity}
        // Дээд ирмэгт байрлуулбал толин тусгал
        style={edge === 'top' ? { transform: [{ scaleY: -1 }] } : undefined}>
        {layers.map((l, idx) => (
          <G key={idx}>
            <Path d={l.path} fill={l.color} />
            {l.outline && (
              <>
                <Path d={l.line} fill="none" stroke={t.line} strokeWidth={2.2} opacity={1} />
                <G fill="none" stroke={t.line} strokeWidth={1.6} opacity={0.8}>
                  {l.eyes.map((e, j) => (
                    <Circle key={j} cx={e.cx} cy={e.cy} r={e.r} />
                  ))}
                </G>
              </>
            )}
          </G>
        ))}
      </Svg>
    </View>
  );
}
