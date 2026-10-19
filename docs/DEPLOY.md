# Байршуулах — Vercel + Neon

> Хэнд: төслийг байршуулж, ажиллуулах хөгжүүлэгч.
> Нэг удаагийн тохиргоо ~1 цаг. Дараагийн deploy бүр `git push`.

## Зарчим

- **Нэг repo, нэг Vercel төсөл, нэг домэйн.** Вэб апп ба API хамт байна.
  Cookie гуравдагч этгээдийнх болохгүй, CORS хэрэггүй.
- **Нийтэд нээхээс өмнө** production deploy нь staging-ийн үүрэг гүйцэтгэнэ:
  `*.vercel.app` хаяг + `NOINDEX=1`. Хэрэглэгч ирэхээс өмнө тусдаа staging
  орчин барих нь зардал нэмээд өгөөж багатай.
- **Migration үргэлж нэмэлт (additive)**: багана, хүснэгт нэмнэ, нэг deploy-д
  устгахгүй. Тэгвэл шинэ код болон хуучин код хоёулаа ажиллах тул rollback аюулгүй.

## 1. Neon (Postgres)

1. <https://console.neon.tech> → **New project**
   - Region: **AWS Asia Pacific (Tokyo)**. Vercel-ийн `hnd1`-тэй ижил газар байх тул саатал бага.
   - Postgres 16+
2. Dashboard → **Connection string**-ээс хоёрыг хуулна:
   - **Pooled** (`…-pooler…`) → `DATABASE_URL`. Аппын хүсэлтэд.
   - **Direct** → `DATABASE_URL_UNPOOLED`. Migration-д зориулсан, учир нь pooler дээр DDL найдваргүй.

> Vercel → Storage → Neon интеграцаар холбовол хоёр хувьсагчийг автоматаар
> тавина. Мөн PR бүрт тусдаа ӨС салбар үүсгэнэ (preview branching).

## 2. ӨС бэлтгэх (компьютерээсээ, нэг удаа)

```bash
export DATABASE_URL_UNPOOLED='postgres://…direct…?sslmode=require'
export DATABASE_URL="$DATABASE_URL_UNPOOLED"

npm run db:deploy                          # бүх migration (дахин ажиллуулахад аюулгүй)
npm run content:import -- --dry-run        # юу орохыг харна
npm run content:import                     # асуулт + эринүүд
npm run content:runway                     # шинэ асуултын нөөц
```

PowerShell дээр: `$env:DATABASE_URL_UNPOOLED='…'`.

## 3. Vercel

1. <https://vercel.com/new> → GitHub → **basababi/nomad-backend**. Хувийн repo тул
   Vercel-ийн GitHub апп-д тухайн repo-д хандах эрх өгнө.
2. Тохиргоо:

| Талбар | Утга |
|---|---|
| Framework | Next.js |
| Root Directory | `apps/api` |
| Build Command | `cd ../.. && npm run build` |
| Install Command | (анхдагч) |
| Node.js | 22.x (`engines`-ээс автоматаар) |

3. **Environment Variables** (Production):

| Нэр | Утга | Тайлбар |
|---|---|---|
| `DATABASE_URL` | Neon pooled | |
| `DATABASE_URL_UNPOOLED` | Neon direct | migration |
| `SESSION_SECRET` | `openssl rand -base64 48` | **≥32 тэмдэгт.** Орчин бүрт **өөр** утга. Богино бол сервер хүсэлт хүлээж авахгүй. |
| `NOINDEX` | `1` | нийтэд нээх хүртэл |
| `PUBLIC_WEB_URL` | (хоосон) | домэйн холбосны дараа `https://…` |
| `DAILY_LAUNCH_DAY` | `2026-11-01` | «#1» болох өдөр |
| `REDIS_URL` | Upstash (заавал биш) | Байхгүй бол хурдны хязгаар serverless instance бүрт тусдаа, сул хамгаалалт болно. |

4. **🔴 Settings → Deployment Protection → Vercel Authentication: Disabled**
   (эсвэл «Only Preview Deployments»). Хамгаалалттай бол Facebook-ийн crawler
   401 авч, **Messenger карт харагдахгүй**. Найз чинь ч линкийг нээж чадахгүй.
5. **Deploy.** Дараа нь `main` руу push хийх бүр production, PR бүр preview болно.

## 4. Deploy-ийн дараах шалгалт (5 минут)

```bash
curl https://<төсөл>.vercel.app/api/health
# {"ok":true,"db":"ok","publishedQuestions":21,"today":"…"}
```

1. Хөтчөөр нээгээд нэг асуултад хариулна.
2. <https://developers.facebook.com/tools/debug/> дээр `https://<төсөл>.vercel.app/c/<КОД>` → **Scrape Again**. Зураг, гарчиг гарах ёстой.
3. Бодит төхөөрөмж дээрх шалгалт: **[QA.md](QA.md)**.

## 5. Өөрчлөлт гаргах дараалал

```
1. PR → CI ногоон (typecheck, lint, 559+ тест, audit, build, content:check)
2. Схем өөрчлөгдсөн бол: npm run db:deploy  (production ӨС, merge-ээс ӨМНӨ)
3. Merge → Vercel автоматаар deploy
4. /api/health + нэг удаа тоглох
```

Migration-ыг кодоос **өмнө** ажиллуулна. Нэмэлт migration хуучин кодыг эвдэхгүй.

**Багана/хүснэгт устгах бол** (expand → contract):
1-р deploy-д кодыг тэр баганаас хамааралгүй болгоно. 2-р deploy-д устгах migration хийнэ.

## 6. Rollback

- **Код:** Vercel → Deployments → өмнөх deploy → **Instant Rollback** (секунд).
- **ӨС:** Neon → Branches → **Restore** (point-in-time, үнэгүй багцад 24 цаг).
  Migration нэмэлт тул ихэнх тохиолдолд кодыг буцаахад л хангалттай.

## 7. Нийтэд нээх үед

1. Домэйн: Vercel → Settings → Domains → `ertniiov.mn`.
2. `PUBLIC_WEB_URL=https://ertniiov.mn`, `NOINDEX`-ийг устгана → Redeploy.
3. `SESSION_SECRET`-ийг шинэчилнэ. Туршилтын хэрэглэгчид гарна, хэвийн зүйл.
4. Facebook Sharing Debugger-ээр шинэ домэйныг дахин scrape хийнэ.
5. `content:runway` ≥ 30 өдөр байгаа эсэхийг шалгана.

## Мэдэгдэж буй зүйлс

- `apps/api/vercel.json`-ийн 2 cron (`league/rollover`, `stats/rebuild`) нь хуучин
  функцийнх. `CRON_SECRET` байхгүй бол хоосон ажиллана. Хуучин код цэвэрлэгдэхэд хасагдана.
- Hobby (үнэгүй) багц: функц 10 сек, cron өдөрт 1. «Өдрийн тав»-д хангалттай.
