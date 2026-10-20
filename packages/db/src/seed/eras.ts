/**
 * Түүхэн эринүүд — Бүлэг 3.2
 * Rank-ийн шатлал он цагийн дараалалтай нийцнэ:
 *   bronze(Хүннү) → silver(Их Монгол) → gold(Богд хаант) → platinum(нэгдсэн)
 */
export const ERA_SEED = [
  {
    key: 'hunnu',
    name: 'Хүннү гүрэн',
    orderIndex: 1,
    startYear: 'МЭӨ III зуун',
    endYear: 'МЭ I зуун',
    description:
      'Нүүдэлчдийн анхны төрт улс. Модун шаньюйн үед Төв Азийн тал нутгийг нэгтгэв.',
  },
  {
    key: 'mongol',
    name: 'Их Монгол Улс',
    orderIndex: 2,
    startYear: '1206 он',
    endYear: 'XIV зуун',
    description:
      'Чингис хааны нэгтгэсэн их гүрэн. Их Засаг хууль, ямаа улаачийн өртөө.',
  },
  {
    key: 'bogd',
    name: 'Богд хаант ба шинэ үе',
    orderIndex: 3,
    // ⚠ Бүлэг 3.2-ын rank хүснэгт энэ эринийг «XVII–XX зуун» гэж заасан.
    // Ану хатан (1696) энд багтах ёстой тул хугацааг 1911-ээр эхлүүлэхгүй.
    startYear: 'XVII зуун',
    endYear: '1924 он',
    description:
      'Галдан бошигтын үеэс 1911 оны тусгаар тогтнол, Олноо өргөгдсөн ' +
      'Монгол Улс хүртэлх үе.',
  },
  // ─── «Өдрийн тав»-ын агуулгад нэмэгдсэн (2026-10) ───
  // ⚠ Үечлэлийг түүхч баталгаажуулна (docs/CONTENT.md). orderIndex нь хуучин
  //   rank-ийн шатлалыг хөндөхгүйн тулд 4-өөс эхэлнэ; он цагийн дараалал биш.
  {
    key: 'turk',
    name: 'Түрэг, Уйгур, Хятан',
    orderIndex: 4,
    startYear: 'VI зуун',
    endYear: 'XII зуун',
    description: 'Хүннүгийн дараах тал нутгийн төрт улсууд: Нирун, Түрэгийн хаант улс, Уйгур, Хятан.',
  },
  {
    key: 'north_yuan',
    name: 'Умард Юань',
    orderIndex: 5,
    startYear: '1368 он',
    endYear: 'XVII зуун',
    description: 'Юань гүрэн мөхсөнөөс Лигдэн хаан хүртэл. Даян хаан, Мандухай сэцэн хатан.',
  },
  {
    key: 'bnmau',
    name: 'БНМАУ',
    orderIndex: 6,
    startYear: '1924 он',
    endYear: '1990 он',
    description: 'Бүгд Найрамдах Монгол Ард Улс — социалист байгуулалтын үе.',
  },
  {
    key: 'modern',
    name: 'Ардчилсан Монгол',
    orderIndex: 7,
    startYear: '1990 он',
    endYear: 'өнөө үе',
    description: '1990 оны ардчилсан хувьсгал, 1992 оны Үндсэн хууль, зах зээлийн нийгэм.',
  },
  {
    key: 'folk',
    name: 'Ёс заншил, зүйр үг',
    orderIndex: 8,
    startYear: null,
    endYear: null,
    description: 'Цаг үеэр хязгаарлагдахгүй: зүйр цэцэн үг, ёс заншил, ардын соёл.',
  },
] as const;

export type EraKey = (typeof ERA_SEED)[number]['key'];
