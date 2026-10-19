/**
 * `expo-constants`-ийн тестийн орлуулга.
 *
 * Жинхэнэ модуль нь `react-native`-ийг татдаг бөгөөд тэр нь Flow синтакстай
 * тул Node/vitest орчинд задлагдахгүй. Транспортын тест Constants-ээс
 * хамаардаггүй тул хоосон `extra` хангалттай — энэ үед `client.ts` нь
 * `localhost` нөөц утга руу шилжинэ.
 */
export default {
  expoConfig: { extra: {} as Record<string, unknown> },
  isDevice: true,
};
