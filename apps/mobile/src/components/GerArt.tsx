/**
 * Гэрийн эд зүйлсийн 3D дүрс — Blender рендер
 *   tools/blender/ger_items.py   → assets/ger/<key>.png (12 эд + гэрэгэ)
 *   tools/blender/ger_diorama.py → assets/ger/ger-diorama.png
 *
 * ЯАГААД EMOJI БИШ: emoji төхөөрөмж бүрт өөр харагдаж, «Хүннүгийн хүрэл
 * тогоо»-г ⚱️ (Грекийн ваар), «Ятга»-г 🪕 (банжо), түгжээг 🔒 гэж
 * харуулж байсан — соёлын хувьд буруу. Энд эд бүр жинхэнэ хэлбэрээрээ,
 * нэг гэрэлтүүлэг ба нэг алтан материалаар — нэг «гэр бүл».
 *
 * Нэр → түлхүүрийн хөрвүүлэлт нь `src/ger3d/itemKeys.ts`-д НЭГ газар —
 * 2D дүрс ба 3D зангилаа хоёулаа ижил түлхүүр ашиглана. Дүрсгүй шинэ эд
 * нэмбэл emoji руу буцна — апп эвдрэхгүй.
 */
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
import React from 'react';
import { Image, Text, View, type ImageSourcePropType } from 'react-native';
import type { GerItem, GerSlot } from '@nomad/contracts';
import { gerItemKey, type GerItemKey } from '@/ger3d/itemKeys';
import { colors } from '@/theme';

const ART: Readonly<Record<GerItemKey, ImageSourcePropType>> = {
  shirdeg_simple: require('../../assets/ger/shirdeg_simple.png'),
  shirdeg_ugalz: require('../../assets/ger/shirdeg_ugalz.png'),
  wall_felt: require('../../assets/ger/wall_felt.png'),
  wall_royal: require('../../assets/ger/wall_royal.png'),
  chest_wood: require('../../assets/ger/chest_wood.png'),
  bronze_cauldron: require('../../assets/ger/bronze_cauldron.png'),
  morin_khuur: require('../../assets/ger/morin_khuur.png'),
  yatga: require('../../assets/ger/yatga.png'),
  toono_simple: require('../../assets/ger/toono_simple.png'),
  toono_soyombo: require('../../assets/ger/toono_soyombo.png'),
  zul: require('../../assets/ger/zul.png'),
  hearth: require('../../assets/ger/hearth.png'),
};

/** Хоосон slot-ын бүдэг «сүүдэр» — тухайн slot-ын энгийн эд */
const SLOT_DEFAULT: Record<GerSlot, GerItemKey> = {
  floor: 'shirdeg_simple',
  wall: 'wall_felt',
  furniture: 'chest_wood',
  instrument: 'morin_khuur',
  roof: 'toono_simple',
  light: 'zul',
};

function artFor(name: string): ImageSourcePropType | undefined {
  const key = gerItemKey(name);
  return key ? ART[key] : undefined;
}

/** Гэрэгэ (пайз) — Их Монгол Улсын алтан тэмдэг; «битүүмжлэлтэй» төлөв */
export const SEAL_ART: ImageSourcePropType = require('../../assets/ger/seal_locked.png');

export const GER_DIORAMA: ImageSourcePropType = require('../../assets/ger/ger-diorama.png');

/** өндөр / өргөн — 1080×996 рендерийн тунгалаг захыг тайрсны дараа 812×703 */
export const GER_DIORAMA_RATIO = 703 / 812;

/**
 * Гэрийн хэсгүүдийн цэг (0..1, зүүн дээд буланаас) — Blender камераас
 * проекц хийж, тайрсан кадрт дахин тооцоолсон (tools/blender/postprocess.py
 * хэвлэнэ). Рендерийн камер эсвэл харьцааг өөрчилбөл ДАХИН ХУУЛАХ ёстой.
 */
export const GER_ANCHORS = {
  toono: [0.5, 0.3258],
  khana: [0.2079, 0.6625],
  bosgo: [0.3565, 0.84],
} as const;

type ArtItem = Pick<GerItem, 'name' | 'emoji' | 'available'>;

/**
 * Эдийн дүрс. Нээгдээгүй бол эдийн СҮҮДЭР + булан дээр нь алтан гэрэгэ.
 *
 * ⚠ Зөвхөн гэрэгэ харуулбал 1-р түвшинд 12-оос 9 карт яг адилхан болж,
 *   тоглогч юу нээгдэхийг огт мэдэхгүй байв. Сүүдэр нь «юу хүлээж
 *   байгааг» харуулж хүсэл төрүүлнэ; гэрэгэ нь битүүмжлэлийг заана.
 */
export function GerItemArt({ item, size }: { item: ArtItem; size: number }) {
  const art = artFor(item.name);
  if (!item.available) {
    const seal = size * 0.62;
    return (
      <View style={{ width: size, height: size }}>
        {art ? (
          <Image
            source={art}
            style={{ width: size, height: size, tintColor: colors.border }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <Image
          source={SEAL_ART}
          style={{ position: 'absolute', width: seal, height: seal, right: -size * 0.14, bottom: -size * 0.06 }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }
  if (!art) {
    return <Text style={{ fontSize: size * 0.55, lineHeight: size }}>{item.emoji ?? '◆'}</Text>;
  }
  return (
    <Image
      source={art}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

/** Хоосон slot — тухайн төрлийн энгийн эдийг бүдгээр харуулна */
export function GerSlotArt({ slot, size, dim = false }: { slot: GerSlot; size: number; dim?: boolean }) {
  return (
    <Image
      source={ART[SLOT_DEFAULT[slot]]}
      style={{ width: size, height: size, opacity: dim ? 0.32 : 1 }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
