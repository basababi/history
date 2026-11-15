# Байршуулах — Vercel (апп) + Railway (өгөгдөл)

> Хэнд: төслийг байршуулж, ажиллуулах хөгжүүлэгч.
> Нэг удаагийн тохиргоо ~1 цаг. Дараагийн deploy бүр `git push`.

## Хэн юуг хариуцах вэ

| | Vercel | Railway |
|---|---|---|
| Юу | Вэб апп + API (Next.js), OG карт, `/c`, `/g` линк | **PostgreSQL**, Redis (заавал биш) |
| Яагаад | CDN, `git push`-ээр deploy, preview, instant rollback | Байнга ажилладаг сервер — ӨС-д тохиромжтой |
| Бүс | `sin1` (Сингапур, `apps/api/vercel.json`) | **Southeast Asia (Singapore)** |

**Вэб ба API-г хоёр платформд хуваахгүй.** Хуваавал хоёр домэйн болж, Safari
өөр серверээс ирсэн cookie-г 7 хоногоор хязгаарлана. Ингэвэл нэвтрэлт дахин
эвдэрнэ. Мөн CORS, хоёр deploy, Messenger-ийн линкийн хуудас тусдаа болно.
Railway-д апп-ын код биш, зөвхөн **өгөгдөл** байна.

> 2-р шатанд «шууд өрөө» (WebSocket) хийхэд Railway-д тусдаа жижиг realtime
> сервис нэмнэ (`live.ertniiov.mn`). Vercel-ийн функц WebSocket барьдаггүй.
> Тэр сервис нэвтрэлтийг cookie-оор биш, үндсэн API-ийн өгсөн богино токеноор шалгана.

## Зарчим

- **Нэг repo, нэг Vercel төсөл, нэг домэйн.** Вэб апп ба API хамт байна.
  Cookie гуравдагч этгээдийнх болохгүй, CORS хэрэггүй.
- **Нийтэд нээхээс өмнө** production deploy нь staging-ийн үүрэг гүйцэтгэнэ:
  `*.vercel.app` хаяг + `NOINDEX=1`. Хэрэглэгч ирэхээс өмнө тусдаа staging
  орчин барих нь зардал нэмээд өгөөж багатай.
- **Migration үргэлж нэмэлт (additive)**: багана, хүснэгт нэмнэ, нэг deploy-д
  устгахгүй. Тэгвэл шинэ код болон хуучин код хоёулаа ажиллах тул rollback аюулгүй.

## 1. Railway (PostgreSQL)

1. <https://railway.com> → **New Project** → **Deploy PostgreSQL**.
2. Postgres сервис → **Settings → Region → Southeast Asia (Singapore)**.
   Vercel-ийн `sin1`-тэй нэг бүсэд байх тул асуулга бүр ~2 мс. Өөр бүс сонговол ~70+ мс болно.
3. Postgres сервис → **Variables** таб → **`DATABASE_PUBLIC_URL`**-ийг хуулна
   (`postgresql://postgres:…@…proxy.rlwy.net:12345/railway`).

> 🔴 **`DATABASE_URL` биш, `DATABASE_PUBLIC_URL`.** Railway-ийн `DATABASE_URL`
> нь `postgres.railway.internal` бөгөөд зөвхөн Railway доторх сервисүүдэд
> ажиллана. Vercel болон таны компьютер түүнд хүрэхгүй.

4. (Заавал биш) **+ New → Database → Redis** → `REDIS_PUBLIC_URL`. Хурдны хязгаарыг
   бүх serverless instance-д нэг дор хэрэгжүүлнэ.
5. Postgres сервис → **Backups**: өдөр тутмын backup-ийг асаана (багцаас хамаарна).
   Үгүй бол долоо хоногт нэг `pg_dump` хийнэ.

> Үнэ: Railway туршилтын кредитийн дараа Hobby багц ~$5/сар. Үнэгүй хувилбар хэрэгтэй бол
> Neon (Tokyo). Тэгвэл `vercel.json`-ийн бүсийг `hnd1` болгоод доорх алхмууд ижил.

## 2. ӨС бэлтгэх (локал хөгжүүлэлтийн компьютероос, нэг удаа)

Production database-д PowerShell-д URL хуулж оруулах шаардлагагүй. Repo-ийн үндсэн хавтсанд Railway CLI-ээр нэг удаа холбоно:

```bash
railway login
railway link --project <PROJECT_ID> --environment <ENVIRONMENT_ID> --service <POSTGRES_SERVICE_ID>
npm run db:deploy:prod
npm run content:import:prod -- --dry-run
npm run content:import:prod
npm run content:runway:prod
```

Эдгээр production команд Railway CLI-ээс `DATABASE_PUBLIC_URL`-г авч, SSL-ээр холбогдоно. URL/нууц үгийг терминалд эсвэл чатад paste хийхгүй. `npm run db:deploy:prod` нь зөвхөн шинэ migration-уудыг ажиллуулна; import-ийн `--dry-run`-ийг шалгасны дараа бодит import хийнэ.

## 3. Vercel

1. <https://vercel.com/new> → GitHub → **basababi/history**. Хувийн repo тул
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
| `DATABASE_URL` | Railway **`DATABASE_PUBLIC_URL`** | |
| `SESSION_SECRET` | `openssl rand -base64 48` | **≥32 тэмдэгт.** Орчин бүрт **өөр** утга. Богино бол сервер хүсэлт хүлээж авахгүй. |
| `NOINDEX` | `1` | нийтэд нээх хүртэл |
| `PUBLIC_WEB_URL` | (хоосон) | домэйн холбосны дараа `https://…` |
| `DAILY_LAUNCH_DAY` | `YYYY-MM-DD` | «#1» болох өдөр |
| `REDIS_URL` | Railway `REDIS_PUBLIC_URL` (заавал биш) | Байхгүй бол хурдны хязгаар serverless instance бүрт тусдаа, сул хамгаалалт болно. |

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
- **ӨС:** Railway → Postgres → **Backups** → Restore (эсвэл `pg_dump`-ийн файлаас).
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
