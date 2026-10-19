/**
 * Байрлуулсан эд → 3D үзэгдлийн төлөв (цэвэр функц, тестлэгдэнэ)
 *
 * Дүрмүүд нь гэрийн уламжлалт зохион байгуулалтыг дагана:
 *   • «Гал голомт» (тулга) байрлуулбал төмөр зуух нуугдана — гэрийн төвд
 *     нэг л гал голомт байна.
 *   • «Модон авдар» хойморын ширээг орлоно — авдар өөрөө шүтээний тавцан.
 *   • «Энгийн тооно» суурь гэрт аль хэдийн байгаа тул тусдаа зангилаагүй;
 *     «Соёмбот тооно» түүн дээр алтан цагираг, медаль нэмнэ.
 */
import type { GerSlot } from '@nomad/contracts';
import { ALL_ITEM_KEYS, type GerItemKey } from './itemKeys';

export type EquippedKeys = Partial<Record<GerSlot, GerItemKey>>;

/** Суурь гэрт байгаа эд — GLB-д `item_*` зангилаагүй */
const BUILT_IN: ReadonlySet<GerItemKey> = new Set<GerItemKey>(['toono_simple']);

export interface SceneState {
  /** зангилааны нэр → харагдах эсэх */
  visible: Record<string, boolean>;
  /** гэрийн гол гал — зуух эсвэл тулга */
  fire: 'stove' | 'hearth';
  /** зул асаалттай эсэх */
  lamp: boolean;
}

export function itemNode(key: GerItemKey): string | null {
  return BUILT_IN.has(key) ? null : `item_${key}`;
}

export function sceneStateFor(equipped: EquippedKeys): SceneState {
  const visible: Record<string, boolean> = {};
  for (const key of ALL_ITEM_KEYS) {
    const node = itemNode(key);
    if (node) visible[node] = false;
  }

  const keys = Object.values(equipped).filter((k): k is GerItemKey => k !== undefined);
  for (const key of keys) {
    const node = itemNode(key);
    if (node) visible[node] = true;
  }

  const hearth = keys.includes('hearth');
  visible.stove = !hearth;
  visible.default_table = !keys.includes('chest_wood');

  return { visible, fire: hearth ? 'hearth' : 'stove', lamp: keys.includes('zul') };
}
