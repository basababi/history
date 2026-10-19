/* Repo-ийн ҮНДСЭН .env-ийг ачаална — Next.js өөрөө эцэг хавтас руу хардаггүй */
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

/**
 * ══ НЭГ ДОМЭЙН: ВЭБ АПП + API ══
 *
 * `npm run build` нь Expo вэб аппыг `public/`-д экспортолно (`build:web`).
 * Тэгвэл энэ Next апп нь:
 *   /api/*        — API
 *   /c/:code      — сорилтын линк (OG мета-тай index.html)
 *   /g/:code      — бүлгийн урилга
 *   бусад бүгд    — SPA (`index.html`), React Navigation зам руу очно
 *
 * Нэг домэйн тул CORS шаардлагагүй, токен гуравдагч сайт руу явахгүй.
 * Экспорт байхгүй үед (хөгжүүлэлт) зөвхөн API хэвээр ажиллана.
 */
const hasWebApp = fs.existsSync(path.join(__dirname, 'public', 'index.html'));

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@nomad/core', '@nomad/contracts', '@nomad/db'],
  // Next 16: `experimental.serverComponentsExternalPackages` → дээд түвшинд
  serverExternalPackages: ['postgres', 'ioredis'],

  // OG зургийн фонт, линкийн хуудасны index.html нь serverless функцэд багтана
  outputFileTracingIncludes: {
    '/api/og/**': ['./assets/fonts/**'],
    '/c/[code]': ['./public/index.html'],
    '/g/[code]': ['./public/index.html'],
  },

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Expo-ийн хэштэй bundle — агуулга өөрчлөгдвөл нэр өөрчлөгдөнө
      {
        source: '/_expo/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },

  async rewrites() {
    if (!hasWebApp) return [];
    return {
      // `/` нь Next-ийн хуудаснаас ӨМНӨ SPA руу
      beforeFiles: [{ source: '/', destination: '/index.html' }],
      afterFiles: [],
      // Ямар ч маршрут, файлтай таараагүй зам — SPA өөрөө шийднэ
      fallback: [{ source: '/:path((?!api/|_next/|_expo/|assets/).*)', destination: '/index.html' }],
    };
  },
};

module.exports = nextConfig;
