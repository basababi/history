/**
 * GLB ачаалагч — Expo ассет → ArrayBuffer → GLTFLoader.parse
 *
 * ЯАГААД `GLTFLoader.load(url)` БИШ: three.js-ийн FileLoader нь `fetch`-ээр
 * уншдаг бөгөөд React Native дээр `file://` ба bundle-ийн ассетийг
 * найдвартай уншдаггүй. Иймд expo-asset файлыг кэшэд буулгаж,
 * expo-file-system байтыг уншиж, бид өөрсдөө `parse` дуудна.
 *
 * GLB нь ТЕКСТУРГҮЙ (tools/blender/ger_realtime.py) — RN-д Image/Blob
 * задлах API байхгүй тул энэ нь санаатай шийдвэр.
 */
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { installTextDecoder } from './utf8';

/**
 * three r162-ийн GLTFParser нь `navigator.userAgent.indexOf('Firefox')`-ийг
 * хамгаалалтгүй дууддаг. React Native-д `navigator` байдаг ч `userAgent`
 * байхгүй тул «Cannot read property 'indexOf' of undefined» гэж унана.
 * «ReactNative» утга нь Safari/Firefox-ийн салбарт орохгүй — зөв зам.
 */
function ensureUserAgent(): void {
  const nav = (globalThis as { navigator?: { userAgent?: unknown } }).navigator;
  if (!nav || typeof nav.userAgent === 'string') return;
  try {
    Object.defineProperty(nav, 'userAgent', { value: 'ReactNative', configurable: true });
  } catch {
    nav.userAgent = 'ReactNative';
  }
}

export async function loadGlb(moduleId: number): Promise<GLTF> {
  installTextDecoder();
  ensureUserAgent();
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const buffer = await new File(uri).arrayBuffer();
  return new Promise<GLTF>((resolve, reject) => {
    new GLTFLoader().parse(buffer, '', resolve, (err: unknown) =>
      reject(err instanceof Error ? err : new Error(String(err))),
    );
  });
}
