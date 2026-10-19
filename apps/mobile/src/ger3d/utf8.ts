/**
 * UTF-8 декодлогч — Hermes-т `TextDecoder` байхгүй үед
 *
 * three.js-ийн GLTFLoader нь GLB-ийн JSON хэсгийг `new TextDecoder()`-оор
 * уншдаг. React Native-ийн Hermes хувилбараас хамаарч энэ глобал байхгүй
 * байж болно — тэгвэл загвар ачаалахгүй, алдаа нь ч ойлгомжгүй гардаг.
 * Байхгүй үед л суулгана (байгаа бол хэзээ ч дарж бичихгүй).
 */
export function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  const chunk: number[] = [];
  const n = bytes.length;
  let i = 0;
  while (i < n) {
    const b0 = bytes[i++];
    let cp: number;
    if (b0 < 0x80) {
      cp = b0;
    } else if (b0 >= 0xc0 && b0 < 0xe0 && i < n) {
      cp = ((b0 & 0x1f) << 6) | (bytes[i++] & 0x3f);
    } else if (b0 >= 0xe0 && b0 < 0xf0 && i + 1 < n) {
      cp = ((b0 & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    } else if (b0 >= 0xf0 && b0 < 0xf8 && i + 2 < n) {
      cp =
        ((b0 & 0x07) << 18) |
        ((bytes[i++] & 0x3f) << 12) |
        ((bytes[i++] & 0x3f) << 6) |
        (bytes[i++] & 0x3f);
    } else {
      cp = 0xfffd;
    }
    if (cp > 0xffff) {
      const v = cp - 0x10000;
      chunk.push(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff));
    } else {
      chunk.push(cp);
    }
    // String.fromCharCode-ийн аргументын тоо хязгаартай — хэсэглэж нийлүүлнэ
    if (chunk.length >= 4096) {
      out += String.fromCharCode(...chunk);
      chunk.length = 0;
    }
  }
  if (chunk.length > 0) out += String.fromCharCode(...chunk);
  return out;
}

export function installTextDecoder(): void {
  const g = globalThis as { TextDecoder?: unknown };
  if (typeof g.TextDecoder !== 'undefined') return;

  class Utf8TextDecoder {
    readonly encoding = 'utf-8';

    decode(input?: ArrayBuffer | ArrayBufferView): string {
      if (!input) return '';
      const bytes =
        input instanceof ArrayBuffer
          ? new Uint8Array(input)
          : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
      return utf8Decode(bytes);
    }
  }

  g.TextDecoder = Utf8TextDecoder;
}
