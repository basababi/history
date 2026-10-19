# Эртний Өв / Nomad Legacy

Монголын өв соёл, түүхийг геймификациар сэргээх платформ.
Turborepo monorepo: **Next.js API + Expo мобайл апп + хуваалцсан TypeScript цөм**.

Эх баримт: `Эртний_Өв_Nomad_Legacy_Техникийн_баримт_бичиг.docx` (v1.0, ШУТИС).

> **Гол зарчим (Бүлэг 6.1):** оноолт, unlock, streak, чансаа БҮГД сервер дээр.
> `correctIndex` асуулт үйлчлэх үед клиент рүү **хэзээ ч** явахгүй.

> 🆕 **2026-10 — вэб-д суурилсан «Өдрийн тав» (18–25 нас).** Шинэ бүтээгдэхүүн, ажиллуулах,
> байршуулах, контент нэмэх заавар: **[docs/WEB.md](docs/WEB.md)**. Доорх хэсгүүдийн зарим нь
> (баатар, музей, лиг, AI зөвлөх…) хуучин хувилбарынх — цэвэрлэгээ хүлээгдэж байна.

📍 **Дараагийн ажлууд:** [ROADMAP.md](ROADMAP.md) — судалгааны шинжилгээ,
UI/UX аудитаас гарсан фазын төлөвлөгөө.

---

## Агуулга

1. [Ажиллуулах](#ажиллуулах)
2. [Бүтцийн ерөнхий зураг](#бүтцийн-ерөнхий-зураг)
3. [Файл бүрийн тайлбар](#файл-бүрийн-тайлбар)
4. [Өгөгдлийн урсгал](#өгөгдлийн-урсгал)
5. [Шалгалт ба чанар](#шалгалт-ба-чанар)
6. [Дуусаагүй зүйлс](#дуусаагүй-зүйлс)
7. [Засагдсан алдаанууд](#засагдсан-алдаанууд)

---

## Ажиллуулах

**Шаардлага:** Node 20+ · npm 10+

```bash
npm install
copy .env.example .env
```

### Гурван терминал

| # | Команд | Юу асаах вэ |
|---|---|---|
| 1 | `npm run db:dev` | Локал Postgres (PGlite) — migration + seed автоматаар |
| 2 | `npm run dev:api` | API — http://localhost:3001 |
| 3 | `npm run dev:web` | Апп хөтөч дээр — http://localhost:8081 |

Эмулятор/утсан дээр харах бол 3 дахь терминалд `npm run dev:mobile`, дараа нь
`a` (Android), `i` (iOS) дарна, эсвэл QR кодыг Expo Go аппаар уншуулна.

> `localhost:3001` нь **API-ийн замын жагсаалт** ба ӨС-ийн холболтын төлөв.
> Аппын дэлгэц тэнд БИШ — `dev:web` / `dev:mobile` дээр гарна.

### Бодит утсан дээр

Expo Go-г LAN горимоор ашиглахад апп Metro-гийн LAN хаягийг авч API хүсэлтийг
Metro (`8081`)-гаар API (`3001`) руу дамжуулдаг. Компьютер ба утас нэг Wi-Fi
сүлжээнд холбогдсон, Metro болон API ажиллаж байх ёстой. Утаснаас API порт
`3001` руу шууд холбогдох шаардлагагүй.

Production API тохируулах бол `.env` дотор хаягийг гараар зааж болно:

```
EXPO_PUBLIC_API_URL=https://api.example.com
```

Android **эмулятор** дээр хөгжүүлэлтийн API мөн Metro проксигоор дамжина.

### Асуудал гарвал

| Шинж тэмдэг | Засвар |
|---|---|
| `EADDRINUSE` · «Port is being used» | `npm run dev:stop` |
| PGlite `RuntimeError: Aborted()` | Автоматаар сэргэнэ; болохгүй бол `npm run db:reset` |
| «Сервертэй холбогдож чадсангүй» | `dev:api` ажиллаж байгаа эсэхийг шалга |
| «Сервер JSON биш HTML буцаалаа» | Metro консол дахь `[api] хаяг:` мөрийг шалга |
| Порт систем нөөцөлсөн (`EACCES`) | ӨС өөрөө дараагийн сул портыг олж `.env`-ээ шинэчилнэ |

> PGlite нэг зэрэг **нэг холболт** үйлчилдэг — `db:dev` ажиллаж байхад
> `db:seed`, `db:studio` ажиллуулж болохгүй.

### Бүх скрипт

```bash
npm run dev:api      npm run dev:web      npm run dev:mobile   npm run dev:stop
npm run db:dev       npm run db:seed      npm run db:migrate   npm run db:reset
npm run db:studio    npm run verify       npm run build        npm run test
```

---

## Бүтцийн ерөнхий зураг

```
nomad-legacy/
│
├── apps/                       Ажиллах хоёр програм
│   ├── api/                    Next.js 16 — Route Handlers + Admin хуудас
│   └── mobile/                 Expo SDK 57 — React Native апп
│
├── packages/                   Хуваалцсан сангууд
│   ├── core/                   Домэйн логик — ЦЭВЭР функц, I/O байхгүй
│   ├── contracts/              zod schema — API-ийн гэрээ
│   └── db/                     Drizzle схем · migration · seed · локал ӨС
│
├── scripts/                    Хөгжүүлэлтийн туслах скрипт
├── .github/workflows/          CI
│
├── .env                        Нууц утга (git-д ОРОХГҮЙ)
├── .env.example                Загвар — үүнийг хуулж .env үүсгэнэ
├── turbo.json                  Turborepo даалгаврын граф
├── tsconfig.base.json          Бүх багцын нийтлэг TS тохиргоо
└── package.json                Workspace + бүх скрипт
```

### Хамаарлын чиглэл

```
              ┌──────────────┐
              │ @nomad/core  │  ← цэвэр функц, юунаас ч хамаарахгүй
              └──────┬───────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼────┐  ┌────▼─────┐  ┌───▼──────────┐
   │contracts│  │ @nomad/db │  │              │
   └────┬────┘  └────┬─────┘  │              │
        │            │        │              │
   ┌────▼────────────▼────┐   │              │
   │      apps/api        │   │ apps/mobile  │
   └──────────────────────┘   └──────────────┘
              ▲                       │
              └───────── HTTP ────────┘
```

`core` нь хэнээс ч хамаардаггүй тул тест хийхэд ӨС, сүлжээ шаардахгүй.
`mobile` нь `db`-ээс **шууд хамаардаггүй** — зөвхөн HTTP-ээр API руу ханддаг.

---

## Файл бүрийн тайлбар

### Үндэс дэх файлууд

| Файл | Мөр | Зориулалт |
|---|---:|---|
| `package.json` | 39 | Workspace тодорхойлолт, бүх `npm run` скрипт, `packageManager` (turbo шаарддаг) |
| `turbo.json` | 29 | Turborepo-гийн даалгаврын граф — `build`, `typecheck`, `test`, `dev` хоорондын хамаарал ба кэш |
| `tsconfig.base.json` | 20 | Бүх багц өвлөнө: `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals` г.м. |
| `.eslintrc.json` | 38 | `no-explicit-any: error`, `exhaustive-deps: error`, `rules-of-hooks: error` |
| `.env.example` | — | Орчны хувьсагчийн загвар, тайлбартай |
| `.env` | — | Бодит утга. **Git-д орохгүй.** `db:dev` нь портоо өөрчлөхөд энэ файлыг шинэчилдэг |
| `.gitignore` | — | `node_modules`, `.next`, `.expo`, `.pgdata`, `.env` |

### `scripts/`

| Файл | Мөр | Зориулалт |
|---|---:|---|
| `dev-stop.mjs` | 86 | 3001 · 8081 · 54321 портыг **сонсож буй** процессыг л зогсооно. Бүх node процессыг устгахгүй тул өөр төслийн ажил тасрахгүй |

### `.github/workflows/`

| Файл | Мөр | Зориулалт |
|---|---:|---|
| `ci.yml` | 52 | `npm ci` → migration шинэ эсэх → typecheck → lint → тест → audit gate → API build → mobile bundle |

---

### `packages/core/` — домэйн логик

**Хамгийн чухал багц.** Тоглоомын бүх дүрэм энд байна. Цэвэр функц —
ӨС, сүлжээ, React-аас хамаарахгүй тул 136 тест миллисекундэд ажиллана.
API болон mobile хоёулаа үүнийг ашигладаг (ADR-005: код давхардал 40–60% буурна).

| Файл | Мөр | Юу хийдэг | Гол экспорт |
|---|---:|---|---|
| `index.ts` | 19 | Нийтийн гарц — бүх модулийг дахин экспортолно | — |
| `xp.ts` | 116 | **Онооны дүрэм** (Бүлэг 3.6). 7 бонус бүгд: +10/+15/+25, ×1.5 хурдан, +50 өдрийн, +200 streak-7, +500 лиг top-3, +300 урилга. Лимитийг `BonusLedger`-ээр хянана | `XP_RULES`, `computeAnswerXp`, `awardDailyChallenge` |
| `rank.ts` | 108 | **Цолны шатлал** (Бүлэг 3.2). Bronze→Silver→Gold→Platinum, XP босго, он цагийн дарааллын шалгуур | `RANK_META`, `tierFromXp`, `validateHeroChronology` |
| `streak.ts` | 116 | **Streak тооцоо** (Бүлэг 5.4). UB өдрөөр, shield perk (сард 1, зөвхөн 1 өдрийн завсар), streak-гүй горим | `updateStreak`, `isoWeekKey` |
| `date.ts` | 39 | **Asia/Ulaanbaatar (UTC+8)** огнооны хөрвүүлэлт. Бүх timestamp UTC-ээр хадгалагдана, «өдөр» нь UB бүсээр | `todayInUlaanbaatar`, `ubDate`, `ubMonth` |
| `unlock.ts` | 119 | **Баатар/олдвор нээх** — идемпотент. XP үсрэхэд дундах tier алгасахгүй. Олдвор ≥70% нарийвчлалд | `computeUnlocks`, `pickSessionArtifactReward` |
| `perk.ts` | 61 | **Баатрын чадвар** (Бүлэг 3.2). Эриний бонус ×1.5, 50/50 (зөв хариулт хэзээ ч арилахгүй) | `applyEraBonus`, `applyFiftyFifty` |
| `league.ts` | 91 | **Лигийн дүрэм** (Бүлэг 3.6). 30 хүний бүлэг, дээд 5 ↑ доод 5 ↓, тэнцсэн оноог детерминистик эрэмбэлэх | `assignBuckets`, `movementForRank` |
| `battle.ts` | 86 | **PvP тойргийн логик**. Ботын нарийвчлал XP-ээс хамаарна, тойргийн ялагчийг тодорхойлно | `applyRound`, `resolveRound` |
| `voice.ts` | 119 | **Дуу хоолойн оноолт** (ADR-006). `confidence×0.5 + pacing×0.3 + duration×0.2` → 0–100. Pass/fail БИШ | `scoreReading`, `VOICE_WEIGHTS` |
| `anticheat.ts` | 75 | **Хууран мэхлэлтийн эсрэг** (Бүлэг 6.1). Аномали (<800мс ба >95%), офлайн 24ц хязгаар, серверийн цагаар хугацаа | `detectAnomaly`, `acceptOfflineAttempt` |
| `retention.ts` | 95 | **Хойшлуулсан шалгалт** (Бүлэг 8.5). R2/R4/R8/R12, экспоненциал λ тохируулга (Wu & Wang 2026) | `fitDecayLambda`, `RETENTION_TARGETS` |
| `mediation.ts` | 260 | **Зуучлалын оноолт** (ROADMAP C1) — дипломын шинэлэг тал. Агуулга 60 + өөрийн үг 25 + урт 15. **Хуулбарт оноо 0.** LLM ШААРДАХГҮЙ — детерминист тул хий үзэгдэл гарахгүй | `scoreMediation`, `deriveKeyTerms`, `mediationXp` |
| `script.ts` | 109 | **Босоо монгол бичиг** (C3). Кирилл ↔ монгол бичгийн харгалзаа, өдрийн нэг үсэг | `SCRIPT_LETTERS`, `letterOfDay` |
| `contribution.ts` | 124 | **Ахмад үеийн дуу хоолой** (B3). Хувь нэмрийн төлөв, XP дүрэм — **цуглуулахад олгоно, баталгаажуулахад олгохгүй** (Бүлэг 6.3) | `contributionXp`, `canSubmit` |
| `playerPath.ts` | 112 | **Тоглогчийн төрөл** (B5). Өрсөлдөгч · цуглуулагч · судлаач · өгүүлэгч — нүүр дэлгэцийн үйлдлийг эрэмбэлнэ | `orderActions`, `parsePlayerPath` |
| `classroom.ts` | 139 | **Ангийн лиг ба хамтын зорилт** (B4). Багшийн код, хамтын ахиц | `classProgress`, `normalizeJoinCode` |
| `story.ts` | 171 | **Салаалсан өгүүлэмж** (C2). Шийдвэрийн мод, **аль нь ч буруу биш** — түүхэн баримт үр дагавраар заагдана | `nextNode`, `endingFor` |
| `text.ts` | 54 | **Кирилл normalize** (Бүлэг 5.4). ө/о, ү/у, ё/е + Levenshtein ≤1 хүлцэл | `normalizeMongolian`, `isTextAnswerCorrect` |
| `tests/` | — | 18 файл · **230 тест** — модуль бүрд нэг тест файл |

---

### `packages/contracts/` — API-ийн гэрээ

| Файл | Мөр | Зориулалт |
|---|---:|---|
| `src/index.ts` | 629 | **Бүх endpoint-ийн zod schema.** Клиент болон сервер ижил гэрээ ашиглана. Серверийн хариу гэрээ зөрчвөл дэлгэц дээр биш, ЭНД илэрнэ. `ServedQuestion`-д `correctIndex` талбар **байхгүй** — гэрээний түвшинд хамгаалсан |

Агуулсан схемүүд: `DevLogin`, `Profile`, `Catalog`, `CreateSession`, `SubmitAnswer`,
`FinishSession`, `League`, `MentorAsk`, `VoiceScore`, `OfflinePack`, `OfflineSync`,
`ContentReport`, `RetentionProbe`, `ApiError`.

---

### `packages/db/` — өгөгдлийн сан

| Файл | Мөр | Зориулалт |
|---|---:|---|
| `src/schema.ts` | 647 | **28 хүснэгтийн Drizzle тодорхойлолт.** Индекс, UNIQUE хязгаарлалт, partial index бүгд энд |
| `src/index.ts` | 8 | Нийтийн гарц — схем + `seedAll`. Гүн зам руу импорт хийхгүй |
| `src/env.ts` | 37 | Repo-ийн үндсэн `.env`-ийг ачаална. `packages/db` нь Next.js-ийн гадна ажилладаг тул өөрөө уншина |
| `src/devServer.ts` | 258 | **Локал Postgres.** PGlite-ийг TCP socket дээр үйлчилнэ. Migration+seed автомат, эвдэрсэн хавтас сэргээх, порт автоматаар олох, `.env` тааруулах |
| `src/reset.ts` | 26 | `.pgdata` болон эвдэрсэн хуулбарыг устгана |
| `drizzle.config.ts` | 13 | drizzle-kit тохиргоо |
| `drizzle/*.sql` | — | **7 migration.** Git-д commit хийгдэнэ — схемийн хувьслын цорын ганц эх сурвалж |
| `drizzle/meta/` | — | drizzle-kit-ийн snapshot ба журнал |

#### `src/seed/` — контент

| Файл | Мөр | Агуулга |
|---|---:|---|
| `eras.ts` | 39 | **3 эрин** — Хүннү · Их Монгол · Богд хаант ба шинэ үе (XVII–XX з.) |
| `heroes.ts` | 119 | **7 баатар** — tier бүрт, perk 4 төрөл бүгд төлөөлөлтэй, `chronologicalOrder`-той |
| `artifacts.ts` | 101 | **10 олдвор** — эрин бүрээр, common/rare/epic |
| `questions.ts` | 323 | **21 асуулт** (Хүннү 6 · Их Монгол 9 · Богд 6). Бүгд `sourceRef`-тэй, 3 нь «алтан жишиг» |
| `knowledge.ts` | 180 | **18 RAG chunk** — баатар бүрийн 1-р биеийн мэдлэг, эх сурвалжтай |
| `gerItems.ts` | 172 | **12 гэрийн эд** (B1) — ширдэг · хөшиг · авдар · морин хуур · тооно. Slot бүрд нэг, `unlockLevel` 1–7, бүгд `sourceRef`-тэй |
| `stories.ts` | 152 | **Салаалсан өгүүлэмжийн зангилаа** (C2) — «Та бол 1206 оны Их хуралдай дээрх элч» |
| `run.ts` | 188 | Seed-ийн логик — драйвераас хамааралгүй, идемпотент. CLI болон тест хоёулаа дуудна |
| `index.ts` | 44 | CLI бүрхүүл — `npm run db:seed` |

#### `tests/`

| Файл | Мөр | Юу шалгадаг |
|---|---:|---|
| `helpers/testDb.ts` | 65 | PGlite дээр migration ажиллуулж, цэвэр ӨС буцаана |
| `schema.integration.test.ts` | — | **бодит Postgres** — 28 хүснэгт, давхар хариултыг ӨС татгалзах, partial index, FK, NOT NULL |
| `seed.integration.test.ts` | 135 | **12 тест · бодит Postgres** — идемпотент байдал (3 удаа), RAG холбоос, эриний зөрчил |
| `seed.test.ts` | 131 | **17 тест** — он цагийн дараалал, `sourceRef` заавал, сонголт давхардаагүй |

---

### `apps/api/` — Next.js сервер

#### Тохиргоо

| Файл | Мөр | Зориулалт |
|---|---:|---|
| `next.config.js` | 14 | Root `.env` ачаалах, workspace багцыг transpile хийх, `postgres`/`ioredis`-ийг гадаад болгох |
| `vercel.json` | 15 | **Токио бүс (`hnd1`)** — ADR-004. Долоо хоногийн лигийн cron |
| `proxy.ts` | 80 | **CORS.** Dev-д localhost/LAN, production-д `ALLOWED_ORIGINS` цагаан жагсаалт. `*` хэрэглэхгүй |
| `tsconfig.json` · `vitest.config.ts` | 46 | TS ба тестийн тохиргоо |

#### `lib/` — дундын давхарга

| Файл | Мөр | Зориулалт |
|---|---:|---|
| `db.ts` | 57 | **Залхуу** Drizzle холболт. Модуль ачаалагдах үед холбогдвол `next build` унана |
| `auth.ts` | 95 | HS256 JWT sign/verify. Dev-д `x-dev-user` толгой (production-д ажиллахгүй) |
| `session.ts` | 97 | **Quiz session token** — HMAC-SHA256. Асуулт бүрийн `servedAt` дотор нь; хугацааг зөвхөн серверийн цагаар |
| `api.ts` | 83 | zod валидаци, нэгдсэн алдааны формат, `requireAuth`, `route()` боолт |
| `pgError.ts` | 81 | **SQLSTATE-аар** PG алдаа таних. Мессежээр шалгах нь драйвер шинэчлэгдэхэд эвдэрдэг |
| `rag.ts` | 139 | **RAG retrieval** (ADR-007). Persona ХАТУУ тусгаарлалт, «мэдэхгүй» хариулт, хатуу system prompt |
| `redis.ts` | 133 | Upstash ZSET/кэш/rate limit. Унасан үед graceful degradation |

#### `app/api/` — 23 route

| Зам | Мөр | Юу хийдэг |
|---|---:|---|
| `auth/dev-login` | 69 | ⚠ **Хөгжүүлэлтийн нэвтрэлт.** Production-д 404. Auth.js хүртэлх түр шийдэл |
| `profile` | 98 | `GET` профайл · `PATCH` нэр/аватар/баатар/streak-гүй горим |
| `catalog` | 71 | Баатар · олдвор · эрин (нээгдсэн эсэх тэмдэглэгээтэй) |
| `quiz/session` | 149 | **Алхам 1** — асуулт + HMAC token. `correctIndex` ЯВАХГҮЙ |
| `quiz/answer` | 142 | **Алхам 2+3** — сервер оноолж `attempts`-д бичнэ. Давхар хариулт → 409 |
| `quiz/finish` | 302 | **Дүн** — XP, бонус, streak, rank, unlock, олдвор, эринээр ахиц, метакогнитив |
| `quiz/fifty-fifty` | 103 | Perk 2. Зөв хариултыг мэдэх шаардлагатай тул заавал серверээс |
| `league/me` | 137 | Redis ZSET чансаа. Унасан үед Postgres snapshot |
| `league/rollover` | 175 | Долоо хоногийн cron — дээд 5 ↑, доод 5 ↓, top-3 бонус |
| `mentor/ask` | 185 | RAG чат — persona тусгаарлалт, өдрийн лимит, кэш, эх сурвалж |
| `voice/score` | 136 | `GET` түргэн хэллэг · `POST` forced alignment оноолт. Аудио шууд устгагдана |
| `battle/round` | 95 | PvP тойрог — серверийн эрх мэдэлтэй |
| `offline/pack` | 59 | Маргаашийн quiz багц |
| `offline/sync` | 149 | Офлайн дараалал — серверийн цагаар дахин баталгаажуулна (≤24ц) |
| `content/report` | 49 | «Буруу асуулт» мэдээлэх. **XP ОГТ олгохгүй** (Бүлэг 6.3) |
| `retention/probe` | 154 | R2/R4/R8/R12 хойшлуулсан шалгалт |
| `billing/checkout` | 83 | Hero Story Pass — QPay/SocialPay |
| `ger` | 142 | **Миний гэр** (B1). `GET` каталог + эзэмшил · `PATCH` эд байрлуулах. Түвшинг СЕРВЕР шалгана; нэг slot-д нэг эд |
| `mediation` | 131 | **Зуучлал** (C1). Түүхий текст авч сервер оноолно. ⚠ Бичсэн текст өөр хэрэглэгчид **хэзээ ч харагдахгүй** — тиймээс Бүлэг 6.5-ын модерацийн эрсдэл үүсэхгүй |
| `contributions` | 171 | **Ахмад үеийн дуу хоолой** (B3). Хувь нэмэр илгээх, төлөв харах. Түүхчийн хяналтгүйгээр асуулт болохгүй |
| `classroom` | 211 | **Ангийн лиг** (B4). Кодоор нэгдэх, хамтын ахиц. Чөлөөт бичвэр байхгүй |
| `story` | 167 | **Интерактив өгүүлэмж** (C2). Зангилаа дамжуулах, төгсгөл тодорхойлох |
| `stats/rebuild` | 82 | **G2 cron** — `attempts`-аас `question_stats` дахин байгуулна, хэт амархан/хэцүү асуултыг илрүүлнэ |

#### `app/` — вэб хуудас

| Файл | Мөр | Зориулалт |
|---|---:|---|
| `page.tsx` | 158 | **Хөгжүүлэлтийн үндсэн хуудас** — ӨС-ийн холболтын төлөв + бүх замын жагсаалт |
| `layout.tsx` | 12 | HTML бүрхүүл |

#### `tests/`

| Файл | Мөр | Юу шалгадаг |
|---|---:|---|
| `helpers/harness.ts` | 67 | Route handler-ийг PGlite дээр жинхэнэ `Request`-ээр дуудна |
| `quizFlow.integration.test.ts` | 466 | **22 тест · бодит Postgres** — session→answer→finish бүтнээр, `correctIndex` алдагдаагүйг мөр мөрөөр |
| `session.test.ts` | 117 | **11 тест** — token гарын үсэг, хугацаа, засварлалт |
| `pgError.test.ts` | 94 | **13 тест** — Drizzle-ийн боосон алдаанаас SQLSTATE гаргах |

---

### `apps/mobile/` — Expo апп

#### Тохиргоо

| Файл | Мөр | Зориулалт |
|---|---:|---|
| `index.js` | 8 | Entry. Monorepo-д `expo/AppEntry.js` рүү шууд заах ажиллахгүй |
| `App.tsx` | — | Давхарга: `ErrorBoundary` → `QueryClient` → `SafeArea` → `Gate` (нэвтрэлт + фонт) → навигаци. 5 таб + 9 stack дэлгэц |
| `app.json` | 43 | Статик Expo тохиргоо — багц нэр, зөвшөөрөл, splash, locales |
| `app.config.js` | 27 | Root `.env`-ийг ачаалж `extra.apiUrl` болгоно. Expo нь эцэг хавтас руу хардаггүй |
| `babel.config.js` | 11 | Зөвхөн `babel-preset-expo` — SDK 57 tsconfig paths-ыг өөрөө уншина |
| `locales/mn.json` · `en.json` | 6 | Микрофоны зөвшөөрлийн текст (систем харуулна) |

#### `src/api/` — HTTP давхарга

| Файл | Мөр | Зориулалт |
|---|---:|---|
| `client.ts` | 183 | **Цорын ганц гарц.** Бизнес логик БАЙХГҮЙ. Хаяг тодорхойлолт (Android эмулятор → `10.0.2.2`), timeout, zod валидаци, `ApiError` |
| `endpoints.ts` | 262 | Endpoint бүрд нэг функц, гэрээний схемтэй хосолсон |

#### `src/hooks/`

| Файл | Мөр | Зориулалт |
|---|---:|---|
| `useAuth.ts` | 96 | Токенгүй үед автоматаар нэвтэрнэ. `deviceId` хадгалагдана — апп дахин нээхэд ахиц алдагдахгүй |
| `useAppFonts.ts` | 36 | Unbounded гарчгийн фонт (A4). ⚠ Фонт ачаалагдаагүй ч `ready: true` буцаана — фонтын алдаа аппыг блоклохгүй |
| `queries.ts` | 161 | TanStack Query — `useProfile`, `useLeague`, `useCatalog`, `useSyncOffline`, `usePrefetchOfflinePack`. Хуучирсан токеныг автоматаар цэвэрлэнэ |

#### `src/offline/` — офлайн дараалал (Бүлэг 6.6)

| Файл | Мөр | Зориулалт |
|---|---:|---|
| `queue.native.ts` | 175 | **SQLite** хувилбар — Android/iOS. Metro автоматаар сонгоно |
| `queue.ts` | 115 | **localStorage** хувилбар — вэб. Интерфэйс ижил тул дуудагч ялгааг мэдэхгүй |

#### `src/` — бусад

| Файл | Мөр | Зориулалт |
|---|---:|---|
| `store/useGameStore.ts` | 88 | zustand — **зөвхөн клиент төлөв**: токен, профайлын хуулбар, офлайн төлөв, хэл. Серверийн төлөв нь TanStack Query-д |
| `theme/index.ts` | 178 | Өнгө, зай, фонт, радиус (Бүлэг 7.1). **Мөнх хөх тэнгэрийн туйл**, `eraColors`, `elevation`, `gradients` (A1) |
| `feedback/index.ts` | 99 | **Haptic + дуу нэг цэгээс** (A2, C5). Бүгд `safe()`-ээр боогдсон тул вэб/тест/дэмжигдэхгүй төхөөрөмж дээр чимээгүй унтарна |
| `audio/index.ts` | 100 | **Морин хуур, хөөмий** (C5). Дуугүй горимд заавал унтарна |
| `navigation/types.ts` | 32 | Дэлгэц хоорондын параметрийн гэрээ — typed navigation |
| `i18n/index.ts` | 72 | ⚠ **Суурь бэлэн, ХАРААХАН ХОЛБОГДООГҮЙ** — дэлгэрэнгүйг файлын толгойгоос |
| `components/motion.tsx` | 220 | **Хөдөлгөөн** (A2) — `FadeInUp`, `usePulse`, `useShake`, `usePressScale`, `useFlicker`, `useFoilSweep`, `useBurst`. Reduce-motion асаалттай бол үргэлжлэх хугацааг тэглэнэ |
| `components/Ornament.tsx` | 192 | **Угалзан хээ SVG** (A3) — `Ulzii`, `HornBorder`, `OrnamentDivider`, `OrnamentProgress`. ⚠ Хас хээг зориудаар ашиглаагүй |
| `components/HeroCard.tsx` | 260 | **Баатрын карт** (B2) — ховордлын жааз, эпик/домогтод гялалзах эффект, нээгдээгүйд силуэт + шаардлагатай XP |
| `components/MediationPanel.tsx` | 224 | **«Дүү нартаа тайлбарла»** (C1) — зуучлалын оруулга, сервертэй ижил хязгаар |
| `components/ScriptCard.tsx` | 107 | **Босоо монгол бичиг** (C3) — өдрийн нэг үсэг, баатрын нэрийг хоёр бичгээр |
| `components/ShareCard.tsx` | 186 | **Хуваалцах карт** (C4) — угалзан жааз, 9:16 Story хэмжээ |
| `components/CountUp.tsx` | 60 | XP тоологч (A2) — easeOutCubic. Reduce-motion үед шууд эцсийн утга |
| `components/ui.tsx` | 278 | `PrimaryButton`, `Card`, `ProgressBar`, `StreakBadge`, `ErrorState`, `EmptyState`, `Skeleton`, `OfflineBanner`, `Loading` |
| `components/ErrorBoundary.tsx` | 78 | Гэнэтийн алдаанд цагаан дэлгэц биш, сэргээх товч |

#### `src/screens/` — 15 дэлгэц

| Дэлгэц | Мөр | Юу харуулдаг |
|---|---:|---|
| `OnboardingScreen` | 458 | **Эхний ялалт 20 секундэд** (B6): эрин сонгох → шууд нэг асуулт → XP тоологдоно → **дараа нь** нэр. Бодит нэр шаардахгүй (Бүлэг 6.5) |
| `HomeScreen` | 274 | Өдрийн сорил, streak, rank ахиц, идэвхтэй баатар, шуурхай холбоос |
| `QuizScreen` | 560 | **Хамгийн том.** Итгэлийн үнэлгээ → асуулт → тайлбар. Таймер, 50/50, офлайн горим, сесс дуусах сэргээлт |
| `ResultScreen` | 303 | XP задаргаа, streak, rank ахилт, **бодит эринээр ахиц**, дараагийн зорилго |
| `HeroesScreen` | 231 | Баатрын каталог, perk, нээгдэх нөхцөл, идэвхтэйг сонгох |
| `MuseumScreen` | 700 | **«Миний гэр»** (B1) — Blender диорама (шөнийн тэнгэр, Долоон бурхан, тооно/хана/босгыг заасан шошго), эд байрлуулах, олдворын цуглуулга. Эдийн 3D дүрс `GerArt`-аас (түгжээтэй эд = сүүдэр + алтан гэрэгэ); дүрсийг `tools/blender/` скриптээр дахин үүсгэнэ. «3D-ээр тойрон харах» товч `Ger3D` руу |
| `Ger3DScreen` | 305 | **Бодит цагийн 3D гэр** — тойрон харах, босгыг гишгэлгүй тонгойж орох, байрлуулсан эд бүрийг уламжлалт байранд нь (хоймор, баруун/эрэгтэй ба зүүн/эмэгтэй тал, гал голомт, тооно) үзэх; эд эсвэл 3D шошго дээр дарахад тайлбар + эх сурвалж. Хөдөлгүүр `src/ger3d/` (three.js 0.162 + expo-gl, `GerEngine` 720 мөр), загвар `tools/blender/ger_realtime.py`; гэрээг `tests/ger3d.test.ts` шалгана |
| `LeaderboardScreen` | 194 | 30 хүний чансаа, шилжилтийн заалт, Redis унасан үеийн тэмдэглэгээ |
| `ProfileScreen` | 198 | Статистик, streak-гүй горим, хэл, өгөгдөл устгах |
| `MentorScreen` | 309 | RAG чат — persona сонголт, эх сурвалж, өдрийн лимит |
| `VoiceBattleScreen` | 294 | Микрофоны бичлэг → сервер оноолт → 0–100 |
| `BattleScreen` | 286 | PvP 5 тойрог — серверийн оноолт |
| `PaywallScreen` | 181 | Hero Story Pass — pay-to-win биш гэдгийг тодотгосон |
| `ContributionScreen` | 351 | **Ахмад үеийн дуу хоолой** (B3) — өвөө эмээгийн үлгэр, зүйр үг илгээх |
| `ClassroomScreen` | 313 | **Ангийн лиг** (B4) — кодоор нэгдэх, хамтын зорилт |
| `StoryScreen` | 351 | **Интерактив өгүүлэмж** (C2) — шийдвэр гаргах, 2–3 минутын мөчлөг |

#### `tests/`

| Файл | Мөр | Юу шалгадаг |
|---|---:|---|
| `client.test.ts` | 114 | **8 тест** — схем зөрчлийг дэлгэц рүү нэвтрүүлэхгүй, алдааны хөрвүүлэлт, retry бодлого |
| `stubs/` | 23 | `expo-constants`, `react-native` орлуулга — Flow синтакс vitest-д задлагдахгүй |

---

## Өгөгдлийн урсгал

### Quiz-ийн гурван алхам (Бүлэг 6.1)

```
   MOBILE                      API                        DB
     │                          │                          │
     │  POST /quiz/session      │                          │
     ├─────────────────────────►│  published асуулт татах  │
     │                          ├─────────────────────────►│
     │  ◄── асуулт + token ─────┤                          │
     │      (correctIndex ❌)   │  сесс бүртгэх            │
     │                          ├─────────────────────────►│
     │                          │                          │
     │  POST /quiz/answer       │                          │
     ├─────────────────────────►│  token шалгах            │
     │      { token, index }    │  хугацаа (СЕРВЕРИЙН цаг) │
     │                          │  оноолох                 │
     │                          ├──── attempts ───────────►│
     │  ◄── зөв/буруу + XP ─────┤     UNIQUE хамгаалалт    │
     │      correctIndex ✓      │                          │
     │                          │                          │
     │  POST /quiz/finish       │                          │
     ├─────────────────────────►│  attempts-аас НИЙЛБЭРЛЭХ │
     │                          │  (клиентийн XP-д итгэхгүй)│
     │  ◄── дүн + unlock ───────┤                          │
```

### Офлайн горим (Бүлэг 6.6)

```
Онлайн  ──► GET /offline/pack ──► SQLite/localStorage-д кэш
Офлайн  ──► хариултыг дараалалд хийнэ (серверийн оноолт хийгдээгүй)
Сэргэх  ──► POST /offline/sync ──► сервер цагийг дахин шалгаж (≤24ц) оноолно
```

---

## Шалгалт ба чанар

```bash
npm run verify   # typecheck → lint → test
```

| Шалгуур | Төлөв |
|---|---|
| `typecheck` (5 багц) | ✅ 0 алдаа · `strict` · `noUnusedLocals` · `any` хориотой |
| `lint` | ✅ 0 алдаа · `exhaustive-deps: error` |
| `test` | ✅ **353 тест** (core 230 · db 43 · api 43 · mobile 37) |
| `build` | ✅ Next.js production, warning-гүй |
| Mobile bundle | ✅ Android 1531 · iOS 1536 модуль (тус бүр 5.1 MB HBC) |
| `expo-doctor` | ✅ 21/21 |
| `npm audit` | 0 critical · 0 high · 15 moderate (dev хэрэгсэл) |

**Тестийн 76 нь БОДИТ Postgres дээр** ажиллана (PGlite — WASM Postgres).
Migration, UNIQUE хязгаарлалт, FK, partial index, seed-ийн идемпотент байдал,
quiz-ийн бүтэн урсгал бодитоор шалгагдана — mock биш.

---

## Дуусаагүй зүйлс

**Код бэлэн, гадаад бүртгэл дутуу.** Аль нь ч хуурамч үр дүн БУЦААХГҮЙ —
тохируулаагүй бол ил тод алдаа өгнө.

| Юу | Юу дутуу | Одоогийн зан төлөв |
|---|---|---|
| Voice Battle | FastAPI + Wav2Vec2/MMS (`VOICE_SERVICE_URL`) | 503 «модуль түр боломжгүй» |
| AI зөвлөх | `LLM_API_KEY` | Корпусын текстийг шууд буцаана — хий үзэгдэл гарахгүй |
| Төлбөр | QPay худалдаачийн бүртгэл | 503 + «үндсэн бүх үйлдэл үнэгүй» |
| Real-time PvP | Ably / Socket.io | Серверийн талын бот; UI-д «бот» гэж ил бичсэн |
| Нэвтрэлт | Auth.js OAuth провайдер | `dev-login` (production-д 404) |
| Push · PostHog | Credentials | Холбоогүй |
| i18n | Дэлгэцүүдийг `t()` рүү холбох | Хэлний сонголт хадгалагдана, текст монголоор |

### 🔴 Хамгийн чухал дутуу зүйл: контент

> Бүлэг 6.2: «Ажиллах quiz бүтээгдэхүүнд **300–500** баталгаажсан асуулт
> шаардлагатай… Quiz апп-ууд кодоос болж биш, **контент дуусаад үхдэг**.»

Одоо **21 асуулт**, Phase 0-ийн зорилт 50, MVP-д 300. Эдгээр нь `sourceRef`-тэй
боловч **мэргэжлийн түүхчээр хянуулаагүй**. Phase 0 ажил 0.4 (түүхчтэй гэрээ)
болон 0.5 нь кодоор шийдэгдэх зүйл биш.

---

## Засагдсан алдаанууд

Прототипээс **41 алдаа** засагдсан. Бүлэглэвэл:

**Түгжрэл (2)** — PvP 1-р тойргийн дараа зогсох · quiz сесс дуусахад апп түгжигдэх

**Спец зөрчсөн логик (12)** — хурдан бонус зөвхөн 1-р асуултад · XP-ийн 4 бонус
олгогддоггүй · музей хэзээ ч дүүрэхгүй · perk 3 хэрэгжээгүй · bronze баатар
алдагдах · «эринээр ахиц» хуурамч · чансаа mock · mentor лимит тойрч болох ·
persona задрах · микрофон байхгүй · таймер цэвэрлэгддэггүй

**Dead code (6)** — i18n · Admin · `RateLimiter` · төлбөрийн статус ·
`radiusMd()` · ашиглагдаагүй импорт

**Статик шалгалтаар илэрсэн (5)** — `updateStreak` ямар ч завсрыг аварч байсан ·
`validateHeroChronology` он цаг харьцуулдаггүй · Ану хатны эриний зөрчил ·
`rules-of-hooks` зөрчил · `__DEV__` хамгаалалтгүй

**Ажиллуулж байж илэрсэн (6)** — `lib/db.ts` импортын үед шидэж `next build`
унагаах · `app.json` `locales` буруу формат · monorepo entry зам ·
`expo-sqlite` plugin · `ignoreDeprecations` · RAG davhardлыг persona-д хамааруулах

**Суулгах урсгалаас (7)** — turbo `packageManager` · `db:seed` `.env` уншдаггүй ·
локал ӨС байхгүй · `drizzle-orm` SQL injection · Drizzle 0.45 боолт 409→500 ·
Next 14 (21 high) · Expo SDK 51 (20 high + 1 critical)

**Орчны (3)** — `ANDROID_HOME` · Windows нөөцөлсөн порт (`EACCES`) ·
Android эмулятор `localhost` → `10.0.2.2`

---

## Баримт бичигтэй холбоос

| Баримт | Хэрэгжилт |
|---|---|
| Бүлэг 3.2 Rank & Hero | `core/rank.ts`, `core/unlock.ts`, `core/perk.ts` |
| Бүлэг 3.6 Онооны дүрэм | `core/xp.ts`, `core/league.ts` |
| Бүлэг 3.7 Метакогнитив | `confidence_level`, `eraBreakdown`, `streakFreeMode` |
| Бүлэг 5.1 ӨС загвар | `db/src/schema.ts` — 19 хүснэгт |
| Бүлэг 5.4 Кирилл · UTC+8 | `core/text.ts`, `core/date.ts` |
| Бүлэг 6.1 Server-authoritative | `api/lib/session.ts`, `quiz/*` routes, `core/anticheat.ts` |
| Бүлэг 6.2 Контентийн засаглал | `source_ref NOT NULL`, `draft→reviewed→published` |
| Бүлэг 6.3 Геймификацийн зөрчил | `content/report` — XP олгохгүй |
| Бүлэг 6.4 AI найдвартай байдал | `api/lib/rag.ts` |
| Бүлэг 6.6 Офлайн | `mobile/src/offline/`, `offline/*` routes |
| Бүлэг 8.5 Тогтвортой байдал | `core/retention.ts`, `retention/probe` |
| ADR-003 Redis ZSET | `api/lib/redis.ts`, `league/*` |
| ADR-004 Токио бүс | `vercel.json` |
| ADR-005 Expo RN | Monorepo бүтэц, `packages/core` |
| ADR-006 Forced alignment | `core/voice.ts`, `voice/score` |
| ADR-007 RAG | `api/lib/rag.ts`, `knowledge_chunks` |
