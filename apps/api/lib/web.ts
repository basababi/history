/**
 * Вэб хуудасны туслагч — хуваалцсан линкийн урьдчилсан харагдац (OG)
 *
 * Messenger, Facebook, Telegram линкийг нээхээс ӨМНӨ хуудасны `<meta>`-г
 * уншиж карт зурдаг. Апп нь SPA тул нэг `index.html`-тэй — линк бүрд ӨӨР
 * карт гаргахын тулд сервер тухайн линкийн мета-г `index.html`-д шигтгэнэ.
 *
 *   /c/ABCD2345 → «Бат 4/5 авсан — чи давж чадах уу?» + дүнгийн зураг
 *   /g/ABC234   → «ШУТИС 3-р курс бүлэгт нэгдээрэй»
 *
 * Хэрэглэгчийн хувьд ялгаагүй: SPA ачаалагдаж, React Navigation тухайн
 * дэлгэц рүү шууд очно.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Сайтын нийтийн гарал — OG зургийн АБСОЛЮТ хаягт шаардлагатай */
export function publicOrigin(req: Request): string {
  const configured = process.env.PUBLIC_WEB_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // буруу тохиргоо — хүсэлтээс тооцоолно
    }
  }
  const url = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? url.host;
  const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  return `${proto}://${host}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let cachedShell: string | null | undefined;

/**
 * Expo вэбийн экспортолсон `index.html` (build-ийн үед `public/`-д бичигдэнэ).
 * Хөгжүүлэлтэд байхгүй — тэр үед `null`.
 */
function loadShell(): string | null {
  if (cachedShell !== undefined && process.env.NODE_ENV === 'production') return cachedShell;
  const file = path.join(process.cwd(), 'public', 'index.html');
  cachedShell = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  return cachedShell;
}

export interface PageMeta {
  title: string;
  description: string;
  /** Абсолют хаяг */
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  /** Абсолют хаяг */
  url: string;
}

function metaTags(meta: PageMeta): string {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const img = escapeHtml(meta.imageUrl);
  const url = escapeHtml(meta.url);
  return [
    `<meta name="description" content="${d}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Эртний Өв">`,
    `<meta property="og:locale" content="mn_MN">`,
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:width" content="${meta.imageWidth}">`,
    `<meta property="og:image:height" content="${meta.imageHeight}">`,
    `<meta property="og:image:alt" content="${t}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
    `<meta name="twitter:image" content="${img}">`,
    `<link rel="canonical" href="${url}">`,
  ].join('\n    ');
}

/**
 * Линкийн хуудас: SPA-ийн `index.html` + тухайн линкийн мета.
 * Хөгжүүлэлтэд (экспорт байхгүй) мета-тай жижиг хуудас үүсгээд Expo dev
 * сервер рүү шилжүүлнэ.
 */
export function renderLinkPage(meta: PageMeta, pathname: string): Response {
  const shell = loadShell();
  const tags = metaTags(meta);
  const headers = {
    'content-type': 'text/html; charset=utf-8',
    // Мета нь хуваалцсаны дараа өөрчлөгдөхгүй (дууссан дүн) — CDN-д богино хадгална
    'cache-control': 'public, max-age=60, s-maxage=600',
  };

  if (shell) {
    const withTitle = shell.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
    // ⚠ Загварын анхдагч OG/twitter/description мета-г ЗААВАЛ арилгана:
    //   Facebook ЭХНИЙ og:title-ийг авдаг тул давхардвал карт ерөнхий гарна.
    const cleaned = withTitle.replace(
      /<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*"|name="description")[^>]*>\s*/gi,
      ''
    );
    return new Response(cleaned.replace('</head>', `    ${tags}\n  </head>`), { headers });
  }

  const devWeb = (process.env.WEB_DEV_URL ?? 'http://localhost:8081').replace(/\/$/, '');
  const target = escapeHtml(`${devWeb}${pathname}`);
  const html = `<!doctype html>
<html lang="mn">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(meta.title)}</title>
    ${tags}
    <meta http-equiv="refresh" content="0; url=${target}">
  </head>
  <body style="background:#080E18;color:#F8F5EE;font-family:system-ui,sans-serif">
    <p>Хөгжүүлэлтийн горим — <a style="color:#DDB058" href="${target}">аппыг нээх</a></p>
  </body>
</html>`;
  return new Response(html, { headers });
}

/** Олдоогүй линк — SPA өөрөө «олдсонгүй» дэлгэцийг харуулна */
export function renderFallbackPage(req: Request, pathname: string): Response {
  const origin = publicOrigin(req);
  return renderLinkPage(
    {
      title: 'Эртний Өв · Өдрийн тав',
      description: 'Өдөр бүр 5 асуулт — Монголын түүх, домог, зүйр үг. Найзаа сорь.',
      imageUrl: `${origin}/api/og/default`,
      imageWidth: 1200,
      imageHeight: 630,
      url: `${origin}${pathname}`,
    },
    pathname
  );
}
