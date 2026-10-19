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
] as const;

export type EraKey = (typeof ERA_SEED)[number]['key'];
