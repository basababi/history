/**
 * 3D гэр — цэвэр логик ба ГЭРЭЭНИЙ тест
 *
 * Гэрээ гурван хэлний дундуур явдаг: seed (TS) ↔ апп (TS) ↔ Blender (Python).
 * Нэг талд нэр/түлхүүр өөрчилбөл 3D-д эд чимээгүй алга болно — энэ тест
 * тэр алдааг CI дээр барина.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ALL_ITEM_KEYS, GER_ITEM_KEYS, gerItemKey } from '@/ger3d/itemKeys';
import { itemNode, sceneStateFor } from '@/ger3d/sceneRules';
import {
  LOOK_LIMITS,
  ORBIT_LIMITS,
  clampLook,
  clampOrbit,
  damp,
  dampAngle,
  easeInOutCubic,
  fitRadius,
  lookAt,
  lookTarget,
  orbitFromPosition,
  orbitPosition,
  pathParam,
  samplePath,
  shortestAngle,
} from '@/ger3d/cameraRig';
import { ZONES } from '@/ger3d/zones';
import { utf8Decode } from '@/ger3d/utf8';

const ROOT = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('itemKeys — гэрээ', () => {
  it('seed-ийн 12 эд бүгд түлхүүртэй', () => {
    const names = [...read('packages/db/src/seed/gerItems.ts').matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
    expect(names).toHaveLength(12);
    for (const n of names) expect(gerItemKey(n), n).not.toBeNull();
  });

  it('түлхүүр давхардахгүй', () => {
    expect(new Set(ALL_ITEM_KEYS).size).toBe(Object.keys(GER_ITEM_KEYS).length);
  });

  it('танигдаагүй нэр → null (шинэ эд апп-ыг эвдэхгүй)', () => {
    expect(gerItemKey('Шинэ эд')).toBeNull();
  });

  it('түлхүүр бүр 2D дүрстэй', () => {
    for (const k of ALL_ITEM_KEYS) {
      expect(fs.existsSync(path.join(ROOT, 'apps/mobile/assets/ger', `${k}.png`)), k).toBe(true);
    }
  });

  it('Blender скрипт 3D зангилаа бүрийг ижил түлхүүрээр гаргана', () => {
    const py = read('tools/blender/ger_realtime.py');
    for (const k of ALL_ITEM_KEYS) {
      const node = itemNode(k);
      if (!node) continue;
      expect(py.includes(`('${k}',`) || py.includes(`'${node}'`), k).toBe(true);
    }
  });
});

describe('sceneRules', () => {
  it('юу ч байрлуулаагүй — зуух, ширээ харагдана, эд бүгд нуугдана', () => {
    const s = sceneStateFor({});
    expect(s.visible.stove).toBe(true);
    expect(s.visible.default_table).toBe(true);
    expect(Object.entries(s.visible).filter(([k, v]) => k.startsWith('item_') && v)).toEqual([]);
    expect(s.fire).toBe('stove');
    expect(s.lamp).toBe(false);
  });

  it('гал голомт зуухыг орлоно — гэрт нэг л гал', () => {
    const s = sceneStateFor({ light: 'hearth' });
    expect(s.visible.stove).toBe(false);
    expect(s.visible.item_hearth).toBe(true);
    expect(s.fire).toBe('hearth');
  });

  it('модон авдар хойморын ширээг орлоно, хүрэл тогоо орлохгүй', () => {
    expect(sceneStateFor({ furniture: 'chest_wood' }).visible.default_table).toBe(false);
    expect(sceneStateFor({ furniture: 'bronze_cauldron' }).visible.default_table).toBe(true);
  });

  it('энгийн тооно суурь гэрт байгаа тул тусдаа зангилаагүй', () => {
    expect(itemNode('toono_simple')).toBeNull();
    expect(Object.keys(sceneStateFor({ roof: 'toono_simple' }).visible)).not.toContain('item_toono_simple');
    expect(sceneStateFor({ roof: 'toono_soyombo' }).visible.item_toono_soyombo).toBe(true);
  });

  it('зул асна', () => {
    const s = sceneStateFor({ light: 'zul' });
    expect(s.lamp).toBe(true);
    expect(s.visible.item_zul).toBe(true);
    expect(s.visible.stove).toBe(true);
  });
});

describe('cameraRig', () => {
  const T = { x: 0, y: 1.35, z: 0 };

  it('theta=0 нь хаалганы тал (+Z)', () => {
    const p = orbitPosition({ theta: 0, phi: 0, radius: 5 }, T);
    expect(p.x).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(5);
  });

  it('orbit ↔ байрлал буцаагдана', () => {
    const o = { theta: 0.7, phi: 0.4, radius: 10 };
    const back = orbitFromPosition(orbitPosition(o, T), T);
    expect(back.theta).toBeCloseTo(o.theta);
    expect(back.phi).toBeCloseTo(o.phi);
    expect(back.radius).toBeCloseTo(o.radius);
  });

  it('yaw=0 хоймор (−Z) руу, lookAt нь lookTarget-ийн урвуу', () => {
    expect(lookTarget({ x: 0, y: 0, z: 0 }, { yaw: 0, pitch: 0 }).z).toBeCloseTo(-1);
    const eye = { x: 0, y: 1.68, z: 2.05 };
    const l = { yaw: 0.6, pitch: -0.2 };
    const back = lookAt(eye, lookTarget(eye, l));
    expect(back.yaw).toBeCloseTo(l.yaw);
    expect(back.pitch).toBeCloseTo(l.pitch);
  });

  it('хязгаар — газар доогуур, гэрийн дотор нэвтрэхгүй', () => {
    expect(clampOrbit({ theta: 0, phi: 5, radius: 1 })).toEqual({
      theta: 0,
      phi: ORBIT_LIMITS.phiMax,
      radius: ORBIT_LIMITS.radiusMin,
    });
    expect(clampLook({ yaw: 0, pitch: -3, fov: 200 })).toEqual({
      yaw: 0,
      pitch: LOOK_LIMITS.pitchMin,
      fov: LOOK_LIMITS.fovMax,
    });
  });

  it('зай дэлгэцийн харьцаанд тааруулагдана — босоо утсанд тавцан бүтэн багтана', () => {
    const portrait = fitRadius(50, 1080 / 1920);
    const landscape = fitRadius(50, 1920 / 1080);
    expect(portrait).toBeGreaterThan(landscape);
    const hHalf = Math.atan(Math.tan((50 * Math.PI) / 360) * (1080 / 1920));
    expect(5.2 / portrait).toBeCloseTo(Math.tan(hHalf));
  });

  it('damp кадр хамааралгүй (30 ба 60 FPS ижил)', () => {
    const one = damp(0, 10, 5, 0.1);
    const two = damp(damp(0, 10, 5, 0.05), 10, 5, 0.05);
    expect(two).toBeCloseTo(one, 10);
  });

  it('өнцөг хамгийн богино замаар', () => {
    expect(shortestAngle(Math.PI * 2 - 0.1, 0.1)).toBeCloseTo(0.2);
    expect(shortestAngle(0.1, -0.1)).toBeCloseTo(-0.2);
    expect(Math.abs(shortestAngle(dampAngle(3.0, -3.0, 50, 1), -3.0))).toBeLessThan(1e-6);
  });

  it('easeInOutCubic', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(-1)).toBe(0);
  });

  it('зам уртаар жигд хуваарилагдана', () => {
    const pts = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 0, z: 3 },
    ];
    expect(samplePath(pts, 0)).toEqual(pts[0]);
    expect(samplePath(pts, 1)).toEqual(pts[2]);
    const mid = samplePath(pts, 0.5);
    expect(mid.x).toBeCloseTo(1);
    expect(mid.z).toBeCloseTo(1);
    expect(pathParam(pts, 0.5)).toMatchObject({ index: 1 });
  });
});

describe('zones', () => {
  it('давхардалгүй, зангилааны нэр гэрээтэй', () => {
    expect(new Set(ZONES.map((z) => z.id)).size).toBe(ZONES.length);
    for (const z of ZONES) expect(z.anchor).toBe(`anchor_${z.id}`);
  });

  it('гэрийн дөрвөн уламжлалт хэсэг дотор харагдана', () => {
    const inside = ZONES.filter((z) => z.inside).map((z) => z.id);
    expect(inside).toEqual(expect.arrayContaining(['khoimor', 'baruun', 'zuun', 'golomt']));
    for (const z of ZONES) expect(z.inside || z.outside).toBe(true);
  });

  it('Blender скрипт шошгоны цэг бүрийг гаргана', () => {
    const py = read('tools/blender/ger_realtime.py');
    for (const z of ZONES) expect(py, z.anchor).toContain(`'${z.anchor}'`);
  });
});

describe('utf8Decode', () => {
  it.each(['GLB {"asset":1}', 'Эртний Өв — гэр', 'ᠮᠣᠩᠭᠣᠯ', '🐎 морь'])('%s', (s) => {
    expect(utf8Decode(new TextEncoder().encode(s))).toBe(s);
  });
});
