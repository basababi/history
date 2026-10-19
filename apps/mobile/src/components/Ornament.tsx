/**
 * Монгол угалзан хээ — SVG (ROADMAP A3, лавлах зургаар шинэчилсэн)
 *
 * ══ ЛАВЛАХ ЗУРГААС ГАРСАН ДҮГНЭЛТ ══
 *
 * 1. ҮҮЛЭН ХЭЭ давамгайлдаг — улзий, хас биш. Лавлах 7 зураг бүрд байна.
 *    Энэ бол Монгол-Дундад Азийн чимэглэлийн ГОЛ хэл.
 *
 * 2. ЭЗЭЛХҮҮН НЬ ДАВХАРГААР гардаг. Үүл бүр 2–4 өнгөний давхаргатай:
 *    гүн дэвсгэр → дунд бие → цайвар өргөлт → алтан контур.
 *    ⚠ Өмнөх хувилбар нь ганц 1.6px шугам байсан — яг энэ л дутуу байв.
 *    Ганц шугам нь «wireframe» шиг харагддаг, чимэглэл шиг биш.
 *
 * 3. Үүлний нэгж = МУШГИА ТОЛГОЙ + СҮҮЛ. Тиймээс дэлбээ бүрийн голд
 *    жижиг мушгиа нүд тавина.
 *
 * 4. ТЭГШ ХЭМТЭЙ ТУСГААРЛАГЧ төв өргөлттэй (2-р лавлах зураг).
 *
 * 5. ГЭРЭЛТЭХ ЦЭНХЭР ХАР ХӨХ ДЭЭР (4-р лавлах зураг) — уламжлалт хээг
 *    тоглоомын UI болгох гүүр. Ижил геометр, гэхдээ туяатай.
 *
 * ══ ИНЖЕНЕРИЙН ШИЙДЭЛ ══
 *
 * Дэлбээг тойрог нуман (arc)-аар барина — `A r r 0 0 1 x y`. Энэ нь:
 *   • bezier-ээс цөөн тэмдэгттэй → зам богино, задлан шинжлэх хурдан
 *   • ямар ч өргөнд давтагдана — тогтмол хэмжээ шаардахгүй
 *   • дүүргэлт ба зураас хоёр ижил замыг хуваалцана
 *
 * ⚠ ГҮЙЦЭТГЭЛ: `Pattern`/`Defs` ашиглахгүй. Давтагдах хээг НЭГ зам болгож
 *   урьдчилан тооцоолно. Хямд Android дээр SVG-ийн үүрлэсэн зангилаа нь
 *   гол зардал — 1 filled path + 1 stroked path + n circle нь хамгийн хямд.
 *
 * ⚠ Хас (свастик) хээг ЗОРИУДААР ашиглаагүй — олон улсын хүрээнд буруу
 *   ойлгогдох эрсдэлтэй. Үүлэн хээ, улзий, эвэр угалз адил үзэсгэлэнтэй.
 */
import React, { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { colors } from '@/theme';

// ═════════════════════════════════════════════════════════════
// Геометрийн суурь — дэлбээт (scallop) зам
// ═════════════════════════════════════════════════════════════

/**
 * Давтагдах дэлбээний радиус. Жигд БИШ байх нь чухал — лавлах зурагт
 * үүл бүр өөр хэмжээтэй. Жигд давталт нь машинаар хийсэн мэт харагдана.
 */
const LOBES = [15, 9, 13, 8, 17, 11, 12, 10];

/**
 * Дэлбээт зам. `baseY` шугамын дагуу нуман дэлбээ цуварна.
 *
 * @param down `true` бол дэлбээ ДООШ бүлтийнэ (дээд хүрээнд),
 *             `false` бол дээш (доод хүрээнд).
 */
function scallop(width: number, baseY: number, down: boolean, phase = 0): string {
  let d = `M0 ${baseY}`;
  let x = 0;
  let i = phase;
  // Хамгаалалт: маш нарийн дэлбээ хязгааргүй давталт үүсгэхээс сэргийлнэ
  let guard = 0;
  while (x < width && guard++ < 200) {
    const r = LOBES[i % LOBES.length]!;
    const nx = Math.min(x + r * 2, width);
    const rr = Math.max(1, (nx - x) / 2);
    d += ` A ${rr} ${rr} 0 0 ${down ? 1 : 0} ${nx} ${baseY}`;
    x = nx;
    i++;
  }
  return d;
}

/** Дэлбээний голын мушгиа нүд — үүлний толгойн шинж */
function lobeEyes(width: number, baseY: number, down: boolean, phase = 0) {
  const eyes: Array<{ cx: number; cy: number; r: number }> = [];
  let x = 0;
  let i = phase;
  let guard = 0;
  while (x < width && guard++ < 200) {
    const r = LOBES[i % LOBES.length]!;
    const nx = Math.min(x + r * 2, width);
    const rr = (nx - x) / 2;
    // Хэт жижиг дэлбээнд нүд тавихгүй — шаварших
    if (rr >= 7) {
      eyes.push({
        cx: x + rr,
        cy: baseY + (down ? rr * 0.45 : -rr * 0.45),
        r: rr * 0.26,
      });
    }
    x = nx;
    i++;
  }
  return eyes;
}

// ═════════════════════════════════════════════════════════════
// Үүлэн хээний туузан хүрээ — ГОЛ БҮРЭЛДЭХҮҮН
// ═════════════════════════════════════════════════════════════

export type CloudTone = {
  /** Ар давхарга — хамгийн гүн */
  back: string;
  /** Үндсэн бие */
  body: string;
  /** Контур ба мушгиа нүд */
  line: string;
};

/** Дэвсгэр өнгөнд тааруулсан үндсэн аяс */
export const cloudTones: Record<'brass' | 'sky' | 'coral' | 'muted', CloudTone> = {
  brass: { back: '#8A5F1E', body: colors.primary, line: colors.zurag.goldLine },
  sky: { back: colors.zurag.turquoiseDeep, body: colors.sky, line: colors.zurag.snow },
  coral: { back: colors.zurag.coralDeep, body: colors.zurag.coral, line: colors.zurag.goldLine },
  muted: { back: '#1B3050', body: colors.border, line: colors.borderStrong },
};

/**
 * Үүлэн хээний тууз — дэлгэцийн толгой, картын хүрээнд.
 *
 * Гурван давхарга (лавлах зургийн эзэлхүүний нууц):
 *   1. Ар дэлбээ — шилжүүлж, бараан. Гүн өгнө.
 *   2. Үндсэн дэлбээ — дүүргэлт.
 *   3. Контур + мушгиа нүд — цайвар зураас.
 */
export function CloudBand({
  width = 360,
  height = 34,
  tone = 'brass',
  down = true,
  opacity = 1,
  style,
}: {
  width?: number;
  height?: number;
  tone?: keyof typeof cloudTones | CloudTone;
  /** Дэлбээ доош бүлтийх эсэх — дээд хүрээнд `true` */
  down?: boolean;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = typeof tone === 'string' ? cloudTones[tone] : tone;
  const VB_H = 40;

  const geo = useMemo(() => {
    // Дэлбээний суурь шугам. Доош бүлтийвэл дээд талд суурилна.
    const base = down ? 12 : VB_H - 12;
    const backBase = down ? base + 6 : base - 6;

    const edge = down ? 0 : VB_H;
    const close = ` L ${width} ${edge} L 0 ${edge} Z`;

    return {
      back: scallop(width, backBase, down, 3) + close,
      body: scallop(width, base, down, 0) + close,
      line: scallop(width, base, down, 0),
      eyes: lobeEyes(width, base, down, 0),
    };
  }, [width, down]);

  return (
    <View style={style} pointerEvents="none">
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${VB_H}`}
        preserveAspectRatio="none"
        opacity={opacity}>
        {/* 1. Ар давхарга — гүн */}
        <Path d={geo.back} fill={t.back} opacity={0.75} />
        {/* 2. Үндсэн бие */}
        <Path d={geo.body} fill={t.body} />
        {/* 3. Контур */}
        <Path d={geo.line} fill="none" stroke={t.line} strokeWidth={1.6} opacity={0.9} />
        {/* 4. Мушгиа нүд */}
        <G fill="none" stroke={t.line} strokeWidth={1.4} opacity={0.75}>
          {geo.eyes.map((e, i) => (
            <Circle key={i} cx={e.cx} cy={e.cy} r={e.r} />
          ))}
        </G>
      </Svg>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════
// Тэгш хэмтэй тусгаарлагч — хэсгийн гарчиг
// ═════════════════════════════════════════════════════════════

/**
 * Хоёр талаас төв рүү чиглэсэн үүлэн сүүл, голд нь өргөлт.
 * Лавлах 2-р зургийн доод эгнээний бүтэц.
 */
export function CloudDivider({
  width = 300,
  color = colors.primary,
  accent = colors.zurag.goldLine,
  opacity = 0.85,
  style,
}: {
  width?: number;
  color?: string;
  accent?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const W = width;
  const mid = W / 2;
  const arm = mid - 26;

  /** Нэг гар — үзүүрээсээ төв рүү мушгиатай сүүл */
  const armPath = (dir: 1 | -1) => {
    const x0 = dir === 1 ? mid + 22 : mid - 22;
    const x1 = x0 + dir * arm;
    return (
      `M${x0} 12 L${x1 - dir * 14} 12 ` +
      `C${x1 - dir * 6} 12, ${x1 - dir * 6} 4, ${x1 - dir * 13} 4 ` +
      `C${x1 - dir * 19} 4, ${x1 - dir * 19} 12, ${x1 - dir * 11} 12`
    );
  };

  return (
    <View style={style} pointerEvents="none">
      <Svg width="100%" height={24} viewBox={`0 0 ${W} 24`} opacity={opacity}>
        <G fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
          <Path d={armPath(1)} />
          <Path d={armPath(-1)} />
        </G>
        {/* Төвийн өргөлт — улзийн цөм */}
        <G fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round">
          <Path d={`M${mid} 4 L${mid + 9} 12 L${mid} 20 L${mid - 9} 12 Z`} />
        </G>
        <Circle cx={mid} cy={12} r={2.4} fill={accent} />
      </Svg>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════
// Алхан хээ — геометр шаталсан хүрээ
// ═════════════════════════════════════════════════════════════

/**
 * Алхан хээ (шаталсан меандр). Лавлах 4-р зургийн зүүн багана.
 *
 * Үүлэн хээ нь органик, алхан хээ нь геометр — хоёулаа хэрэгтэй.
 * Геометр хээ нь прогресс, таб, хүснэгтийн хүрээнд илүү тохирно:
 * органик хээ давтагдвал чимээ шуугиан болно.
 */
export function AlkhanBorder({
  width = 300,
  height = 16,
  color = colors.sky,
  opacity = 0.7,
  style,
}: {
  width?: number;
  height?: number;
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const UNIT = 26;
  const d = useMemo(() => {
    let s = '';
    for (let x = 0; x < width; x += UNIT) {
      s += `M${x} 16 V6 H${x + 9} V12 H${x + 17} V6 H${x + UNIT} `;
    }
    return s.trim();
  }, [width]);

  return (
    <View style={style} pointerEvents="none">
      <Svg width="100%" height={height} viewBox={`0 0 ${width} 20`} preserveAspectRatio="none">
        <Path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          opacity={opacity}
        />
      </Svg>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════
// Улзий — эцэс төгсгөлгүй зангилаа
// ═════════════════════════════════════════════════════════════

export function Ulzii({
  size = 40,
  color = colors.primary,
  strokeWidth = 4,
  /** Хар хөх дэвсгэр дээрх туяа — лавлах 4-р зургийн заль */
  glowing = false,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
  glowing?: boolean;
}) {
  const paths = (
    <>
      <Path d="M40 30 H80 V50 H60 V70 H80 V90 H40 V70 H60 V50 H40 Z" />
      <Path d="M30 40 V80 M90 40 V80" />
      <Path d="M30 40 H50 M70 40 H90 M30 80 H50 M70 80 H90" />
    </>
  );

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {/* Туяа — доор нь зузаан, тунгалаг хуулбар */}
      {glowing && (
        <G
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth * 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.18}>
          {paths}
        </G>
      )}
      <G
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round">
        {paths}
      </G>
    </Svg>
  );
}

// ═════════════════════════════════════════════════════════════
// Эвэр угалз — нарийн хүрээ (хуучин API хэвээр)
// ═════════════════════════════════════════════════════════════

/**
 * ⚠ АЛДААНЫ ЗАСВАР: өмнөх хувилбар нь SVG `<Pattern id="horn">`
 * ашигладаг байсан. SVG id нь БАРИМТЫН ХЭМЖЭЭНД давтагдашгүй байх ёстой
 * тул нэг дэлгэц дээр хоёр `HornBorder` зэрэг гарвал id мөргөлдөж,
 * хоёр дахь нь буруу рендерлэгддэг байв. Одоо давтагдах замыг шууд
 * тооцоолж байгаа тул id огт хэрэггүй.
 */
export function HornBorder({
  width = 240,
  height = 22,
  color = colors.primary,
  opacity = 0.55,
  style,
}: {
  width?: number;
  height?: number;
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const d = useMemo(() => {
    const UNIT = 40;
    let s = '';
    for (let x = 0; x < width; x += UNIT) {
      s +=
        `M${x} 11 C${x + 6} 11, ${x + 6} 3, ${x + 12} 3 ` +
        `C${x + 18} 3, ${x + 18} 19, ${x + 24} 19 ` +
        `C${x + 30} 19, ${x + 30} 11, ${x + UNIT} 11 `;
    }
    return s.trim();
  }, [width]);

  return (
    <View style={style} pointerEvents="none">
      <Svg width="100%" height={height} viewBox={`0 0 ${width} 22`} preserveAspectRatio="none">
        <Path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          opacity={opacity}
        />
      </Svg>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════
// Тусгаарлагч — нийцтэй байдлын нэр
// ═════════════════════════════════════════════════════════════

export function OrnamentDivider({
  color = colors.borderStrong,
  style,
}: {
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return <CloudDivider color={color} accent={colors.primary} opacity={0.6} style={style} />;
}

// ═════════════════════════════════════════════════════════════
// Угалзан прогресс
// ═════════════════════════════════════════════════════════════

/**
 * Прогресс бар — дүүрсэн хэсэг нь ГЕОМЕТР хээтэй.
 *
 * ⚠ Өмнөх хувилбар нь ажиллахгүй `clipPath="url(#fillClip)"`-д найдаж
 * байсан: `<Pattern>` нь clipPath БИШ тул зүсэлт огт хийгддэггүй,
 * хээ нь дүүргэлтээс хальж гардаг байв. Одоо зөвхөн дүүрсэн өргөнд
 * тааруулж зам үүсгэнэ — зүсэлт шаардлагагүй.
 */
export function OrnamentProgress({
  progress,
  height = 14,
  color = colors.primary,
  trackColor = colors.border,
  style,
}: {
  /** 0..1 */
  progress: number;
  height?: number;
  color?: string;
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const pct = Math.max(0, Math.min(1, progress));

  /**
   * ⚠ ЗОХИОМЖИЙН ШИЙДВЭР: зам/дүүргэлтийг SVG-ээр БИШ, энгийн `View`-ээр
   * барина.
   *
   * Учир нь: прогресс бар өргөнөө эцгээсээ авдаг тул SVG-д
   * `preserveAspectRatio="none"` шаардлагатай болно. Тэр үед `rx` радиус
   * хэвтээ тэнхлэгээр СУНАН зууван булан үүсгэдэг — өргөн бүрд өөр
   * харагдана. `View` + `borderRadius` нь ямар ч өргөнд яг тогтмол.
   *
   * SVG зөвхөн ДОТООД хээнд үлдэнэ; `overflow: 'hidden'` дүүргэлтийн
   * хүрээнд таслах тул зүсэлтийн заль ч шаардлагагүй.
   */
  const R = height / 2;

  return (
    <View
      style={[
        { height, borderRadius: R, backgroundColor: trackColor, overflow: 'hidden' },
        style,
      ]}>
      {pct > 0 && (
        <View
          style={{
            width: `${pct * 100}%`,
            height: '100%',
            borderRadius: R,
            backgroundColor: color,
            overflow: 'hidden',
            justifyContent: 'center',
          }}>
          {/* Дүүрсэн хэсэг дэх геометр хээ — өнгө биш, бүтэц */}
          <Svg width="100%" height={height} viewBox="0 0 120 16" preserveAspectRatio="none">
            <Path
              d="M4 12 V5 H11 V9 H18 V5 H26 M30 12 V5 H37 V9 H44 V5 H52 M56 12 V5 H63 V9 H70 V5 H78 M82 12 V5 H89 V9 H96 V5 H104"
              fill="none"
              stroke="rgba(10,23,41,0.30)"
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      )}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════
// Булангийн угалз
// ═════════════════════════════════════════════════════════════

export function OrnamentCorner({
  size = 28,
  color = colors.primary,
  opacity = 0.4,
  rotate = 0,
}: {
  size?: number;
  color?: string;
  opacity?: number;
  /** 0 | 90 | 180 | 270 */
  rotate?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" opacity={opacity}>
      <G transform={`rotate(${rotate} 20 20)`}>
        {/* Гадна нум */}
        <Path
          d="M2 2 H20 C20 10, 12 10, 12 18 C12 26, 20 26, 20 34"
          fill="none"
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        {/* Дотор цуурай — давхарга нэмнэ */}
        <Path
          d="M6 7 H15 C15 12, 8 13, 8 18"
          fill="none"
          stroke={color}
          strokeWidth={1.2}
          strokeLinecap="round"
          opacity={0.6}
        />
      </G>
    </Svg>
  );
}
