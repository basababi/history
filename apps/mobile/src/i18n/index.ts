/**
 * Олон хэлний дэмжлэг — Phase 3 (Бүлэг 7.4): англи (жуулчин, диаспора)
 *
 * ⚠ ТӨЛӨВ: СУУРЬ БЭЛЭН, ХАРААХАН ХОЛБОГДООГҮЙ.
 *
 * Хэрэглэгчийн хэлний сонголт (`useGameStore.locale`) хадгалагдаж байгаа
 * боловч дэлгэцүүд `t()`-г ХЭРЭГЛЭЭГҮЙ — бүх текст монголоор шууд бичигдсэн.
 *
 * Дуусгахад:
 *   1. Доорх толь бичгийг бүх дэлгэцийн мөрөөр гүйцээх (одоо ~20 түлхүүр,
 *      апп-д хэдэн зуун мөр байна)
 *   2. `useTranslation()` hook нэмж, дэлгэц бүрийн текстийг солих
 *   3. Англи контент (асуулт, баатрын түүх) — Бүлэг 7.4
 *
 * Хагас холбох нь одоогийн байдлаас ДОРДУУЛНА: зарим текст орчуулагдаж,
 * зарим нь үлдэх тул хэрэглэгчид эрээвэр хураавар харагдана.
 */
export type Locale = 'mn' | 'en';

export const translations = {
  mn: {
    home: 'Нүүр',
    heroes: 'Баатрууд',
    museum: 'Музей',
    league: 'Лиг',
    profile: 'Профайл',
    mentor: 'Зөвлөх',
    battle: 'Тулаан',
    voice: 'Дуу хоолой',
    admin: 'Админ',
    dailyQuest: 'Өдрийн сорил',
    startQuiz: 'Сорилоо эхэлье',
    streak: 'Streak',
    xp: 'Оноо',
    rankUp: 'Шинэ цол',
    heroUnlocked: 'Шинэ баатар нээгдлээ',
    askMentor: 'Асуултаа бичээрэй...',
    send: 'Илгээх',
    readAloud: 'Дуугаар уншина уу',
    storyPass: 'Hero Story Pass',
    upgrade: 'Эрх авах',
    freeForever: 'Суралцах цөм үйл ажиллагаа үргэлж үнэгүй',
  },
  en: {
    home: 'Home',
    heroes: 'Heroes',
    museum: 'Museum',
    league: 'League',
    profile: 'Profile',
    mentor: 'Mentor',
    battle: 'Battle',
    voice: 'Voice',
    admin: 'Admin',
    dailyQuest: 'Daily Quest',
    startQuiz: 'Start Challenge',
    streak: 'Streak',
    xp: 'XP',
    rankUp: 'New Rank',
    heroUnlocked: 'New hero unlocked',
    askMentor: 'Ask your question...',
    send: 'Send',
    readAloud: 'Read aloud',
    storyPass: 'Hero Story Pass',
    upgrade: 'Subscribe',
    freeForever: 'Core learning is always free',
  },
} as const;

export type TranslationKey = keyof typeof translations.mn;

export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale][key];
}