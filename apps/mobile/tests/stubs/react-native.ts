/**
 * `react-native`-ийн тестийн орлуулга.
 *
 * Жинхэнэ модуль нь Flow синтакстай тул Node/vitest орчинд задлагдахгүй.
 * Транспортын тест зөвхөн `Platform.OS`-оос хамаардаг.
 */
export const Platform = {
  OS: 'ios' as 'ios' | 'android' | 'web',
  select: <T,>(spec: { ios?: T; android?: T; web?: T; default?: T }): T | undefined =>
    spec.ios ?? spec.default,
};
