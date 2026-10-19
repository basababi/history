/**
 * Гэрийн эдийн тогтвортой түлхүүр — seed-ийн нэр ↔ 2D дүрс ↔ 3D зангилаа
 *
 * ЯАГААД ТҮЛХҮҮР: Нэр (кирилл) нь хэрэглэгчид харагдах текст, засагдаж
 * болно. Харин 2D дүрс (`assets/ger/<key>.png`) ба 3D зангилаа
 * (`item_<key>`) ASCII түлхүүрээр холбогдоно. Blender скрипт
 * (tools/blender/ger_realtime.py, ger_items.py) яг эдгээр түлхүүрийг
 * ашигладаг — нэгийг нь өөрчилбөл бүгдийг өөрчлөх ёстой.
 */
export const GER_ITEM_KEYS = {
  'Энгийн ширдэг': 'shirdeg_simple',
  'Угалзан ширдэг': 'shirdeg_ugalz',
  'Эсгий хөшиг': 'wall_felt',
  'Хатан хааны хивс': 'wall_royal',
  'Модон авдар': 'chest_wood',
  'Хүннүгийн хүрэл тогоо': 'bronze_cauldron',
  'Морин хуур': 'morin_khuur',
  'Ятга': 'yatga',
  'Энгийн тооно': 'toono_simple',
  'Соёмбот тооно': 'toono_soyombo',
  'Зул': 'zul',
  'Гал голомт': 'hearth',
} as const satisfies Record<string, string>;

export type GerItemKey = (typeof GER_ITEM_KEYS)[keyof typeof GER_ITEM_KEYS];

export const ALL_ITEM_KEYS: readonly GerItemKey[] = Object.values(GER_ITEM_KEYS);

/** Seed-ийн нэрээс түлхүүр; танигдаагүй (шинэ) эдэд `null` — апп эвдрэхгүй */
export function gerItemKey(name: string): GerItemKey | null {
  return (GER_ITEM_KEYS as Record<string, GerItemKey>)[name] ?? null;
}
