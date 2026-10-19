/**
 * Expo SDK 57-ийн `babel-preset-expo` нь `tsconfig.json`-ы `paths`-ыг
 * өөрөө уншдаг тул `babel-plugin-module-resolver` шаардлагагүй.
 *
 * ⚠ `react-native-worklets/plugin` нь ЗААВАЛ жагсаалтын СҮҮЛД байх ёстой —
 * reanimated 4-ийн worklet хувиргалт бусад залруулгын дараа ажиллана.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
