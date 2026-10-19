/**
 * Expo-ийн тохиргоо — repo-ийн ҮНДСЭН `.env`-ийг ачаална.
 *
 * Expo нь monorepo-ийн root дахь `.env`-ийг өөрөө ачаалахгүй тул энд уншиж өгнө.
 * Локал хөгжүүлэлтийн API хүсэлт Metro проксигоор дамжина.
 * Production API хаягийг `.env`-ээр тохируулж болно.
 *
 * Статик тохиргоо `app.json` дотор хэвээр.
 */
const path = require('node:path');
const dotenv = require('dotenv');

const ROOT = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(ROOT, '.env.local') });
dotenv.config({ path: path.join(ROOT, '.env') });

const base = require('./app.json');

module.exports = ({ config }) => ({
  ...config,
  ...base.expo,
  extra: {
    ...(base.expo.extra ?? {}),
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001',
  },
});
