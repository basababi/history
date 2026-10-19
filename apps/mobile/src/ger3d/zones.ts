/**
 * Гэрийн уламжлалт хэсгүүд — 3D дотор хөвөх шошго ба товч тайлбар
 *
 * Хаалга өмнө зүгт тул хоймор хойд, баруун тал (эрэгтэй) гэрт ороход ЗҮҮН
 * гарт, зүүн тал (эмэгтэй) БАРУУН гарт тохиолдоно. Монгол «баруун/зүүн»
 * нь хойморт суугаад хаалга руу харсан байрлалаас нэрлэгддэг.
 */
export type ZoneId = 'khoimor' | 'baruun' | 'zuun' | 'golomt' | 'toono' | 'bosgo';

export interface Zone {
  id: ZoneId;
  /** GLB дахь цэг: `anchor_<id>` */
  anchor: string;
  title: string;
  subtitle: string;
  note: string;
  /** гэрт орсон үед харуулах эсэх */
  inside: boolean;
  /** гаднаас тойрох үед харуулах эсэх */
  outside: boolean;
}

export const ZONES: readonly Zone[] = [
  {
    id: 'khoimor',
    anchor: 'anchor_khoimor',
    title: 'ХОЙМОР',
    subtitle: 'хүндэт тал',
    note: 'Хаалганы яг эсрэг, гэрийн хойд тал. Ахмад настан, хүндэт зочны суудал; авдар, шүтээн, гэр бүлийн эрхэм зүйлсийг энд залдаг.',
    inside: true,
    outside: false,
  },
  {
    id: 'baruun',
    anchor: 'anchor_baruun',
    title: 'БАРУУН ТАЛ',
    subtitle: 'эрэгтэй тал',
    note: 'Эрэгтэй хүний тал. Эмээл хазаар, хөхүүр, хөгжим зэвсгийг энд байрлуулдаг; эрэгтэй зочин энэ талд суудаг.',
    inside: true,
    outside: false,
  },
  {
    id: 'zuun',
    anchor: 'anchor_zuun',
    title: 'ЗҮҮН ТАЛ',
    subtitle: 'эмэгтэй тал',
    note: 'Эмэгтэй хүний тал. Аяга шанага, тогоо, шүүгээ зэрэг гэрийн эдлэл энд байрладаг.',
    inside: true,
    outside: false,
  },
  {
    id: 'golomt',
    anchor: 'anchor_golomt',
    title: 'ГАЛ ГОЛОМТ',
    subtitle: 'гэрийн төв',
    note: 'Гэрийн ариун төв, угсаа залгамжлалын бэлгэдэл. Гал руу хог хаядаггүй, галд хутга дүрдэггүй, дээгүүр нь алхдаггүй.',
    inside: true,
    outside: false,
  },
  {
    id: 'toono',
    anchor: 'anchor_toono',
    title: 'ТООНО',
    subtitle: 'гэрийн нар',
    note: 'Тоононоос тусах нарны гэрэл унь, ханын дагуу шилжих тул малчид цаг үеийг үүгээр тооцдог байв. Утаа ч эндээс гарна.',
    inside: true,
    outside: true,
  },
  {
    id: 'bosgo',
    anchor: 'anchor_bosgo',
    title: 'БОСГО',
    subtitle: 'цээртэй',
    note: 'Босгон дээр гишгэж, суухыг цээрлэдэг — гэрийн эзний хүзүүг гишгэхтэй адил гэж үздэг.',
    inside: false,
    outside: true,
  },
];
