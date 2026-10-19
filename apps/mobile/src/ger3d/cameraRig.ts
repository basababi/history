/**
 * Камерын цэвэр математик — three.js-гүй тул node дээр тестлэгдэнэ.
 *
 * Координат (three.js): Y дээш, хаалга +Z (өмнө) зүгт, хоймор −Z (хойд).
 *
 *   Orbit — гаднаас тойрох: theta = Y тэнхлэгийн эргэн тойрон (0 = хаалганы
 *           тал), phi = тэнгэрийн хаяанаас дээших өнцөг, radius = зай.
 *   Look  — дотроос эргэн харах: yaw 0 = хоймор руу, pitch дээш эерэг.
 *
 * ⚠ Бүх зөөлрүүлэлт `dt`-д суурилсан (кадр хамааралгүй). 30 ба 60 FPS-д
 *   ижил хурдтай хөдөлнө — утсууд хүчин чадлаараа ялгаатай.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Orbit {
  theta: number;
  phi: number;
  radius: number;
}

export interface Look {
  yaw: number;
  pitch: number;
  fov: number;
}

export interface OrbitLimits {
  phiMin: number;
  phiMax: number;
  radiusMin: number;
  radiusMax: number;
}

/**
 * Анхдагч хязгаар. Хөдөлгүүр радиусын хязгаарыг дэлгэцийн харьцаанаас дахин
 * тооцоолж дамжуулна — босоо утсан дээр хэвтээ харах өнцөг ~30° л тул
 * тогтмол зайд гэр багтахгүй.
 */
export const ORBIT_LIMITS: OrbitLimits = { phiMin: 0.1, phiMax: 1.2, radiusMin: 6.5, radiusMax: 16 };
export const LOOK_LIMITS = { pitchMin: -0.75, pitchMax: 1.3, fovMin: 40, fovMax: 75 } as const;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function clampOrbit(o: Orbit, limits: OrbitLimits = ORBIT_LIMITS): Orbit {
  return {
    theta: o.theta,
    phi: clamp(o.phi, limits.phiMin, limits.phiMax),
    radius: clamp(o.radius, limits.radiusMin, limits.radiusMax),
  };
}

/**
 * Тавцан (r ≈ 4.6 м) хэвтээ чиглэлд, гэр + утаа босоо чиглэлд бүтэн багтах
 * зай. `aspect` = өргөн / өндөр; босоо утсанд ≈ 0.56.
 */
export function fitRadius(fovDeg: number, aspect: number, halfWidth = 5.2, halfHeight = 3.6): number {
  const vHalf = (fovDeg * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * aspect);
  return Math.max(halfWidth / Math.tan(hHalf), halfHeight / Math.tan(vHalf));
}

export function clampLook(l: Look): Look {
  return {
    yaw: l.yaw,
    pitch: clamp(l.pitch, LOOK_LIMITS.pitchMin, LOOK_LIMITS.pitchMax),
    fov: clamp(l.fov, LOOK_LIMITS.fovMin, LOOK_LIMITS.fovMax),
  };
}

export function orbitPosition(o: Orbit, target: Vec3): Vec3 {
  const c = Math.cos(o.phi);
  return {
    x: target.x + o.radius * c * Math.sin(o.theta),
    y: target.y + o.radius * Math.sin(o.phi),
    z: target.z + o.radius * c * Math.cos(o.theta),
  };
}

/** Байрлалаас orbit параметр — дотроос гарахад камер үсрэхгүй үргэлжлэхэд */
export function orbitFromPosition(p: Vec3, target: Vec3): Orbit {
  const dx = p.x - target.x;
  const dy = p.y - target.y;
  const dz = p.z - target.z;
  const radius = Math.hypot(dx, dy, dz);
  return { theta: Math.atan2(dx, dz), phi: Math.asin(dy / radius), radius };
}

export function lookTarget(eye: Vec3, l: Pick<Look, 'yaw' | 'pitch'>): Vec3 {
  const c = Math.cos(l.pitch);
  return {
    x: eye.x - Math.sin(l.yaw) * c,
    y: eye.y + Math.sin(l.pitch),
    z: eye.z - Math.cos(l.yaw) * c,
  };
}

/** `lookTarget`-ийн урвуу — «энэ цэг рүү харах» yaw/pitch */
export function lookAt(eye: Vec3, target: Vec3): { yaw: number; pitch: number } {
  const dx = target.x - eye.x;
  const dy = target.y - eye.y;
  const dz = target.z - eye.z;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

/** Кадр хамааралгүй экспоненциал зөөлрүүлэлт: λ их байх тусам хурдан хүрнэ */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

/** Хамгийн богино өнцгийн зөрүү [−π, π] — 350°-аас 10° руу 340° эргэхгүй */
export function shortestAngle(from: number, to: number): number {
  const TAU = Math.PI * 2;
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  return current + shortestAngle(current, target) * (1 - Math.exp(-lambda * dt));
}

export function easeInOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

export function pathLength(points: readonly Vec3[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return total;
}

/**
 * Хугарсан шугам дээрх t ∈ [0, 1] (уртаар жигд) → сегментийн дугаар ба
 * сегмент доторх u. Байрлал ба «харах цэг»-ийг ИЖИЛ параметрээр
 * интерполяцлахад хэрэгтэй — тэгвэл камер эргэлдэхгүй, зам дагуу харна.
 */
export function pathParam(points: readonly Vec3[], t: number): { index: number; u: number } {
  if (points.length < 2) return { index: 0, u: 0 };
  let d = clamp(t, 0, 1) * pathLength(points);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const l = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (d <= l || i === points.length - 2) {
      return { index: i, u: l === 0 ? 1 : clamp(d / l, 0, 1) };
    }
    d -= l;
  }
  return { index: points.length - 2, u: 1 };
}

/** Хугарсан шугамын дагуу уртаар жигд хуваарилсан цэг, t ∈ [0, 1] */
export function samplePath(points: readonly Vec3[], t: number): Vec3 {
  if (points.length === 1) return points[0];
  const { index, u } = pathParam(points, t);
  return lerpVec(points[index], points[index + 1], u);
}
