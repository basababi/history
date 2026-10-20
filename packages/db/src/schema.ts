/**
 * Drizzle схем — Бүлэг 5.1: 14 хүснэгт бүгд
 * Индексүүд — Бүлэг 5.2:
 *   - attempts(user_id, created_at DESC)
 *   - questions(era_id, difficulty, status) partial WHERE status='published'
 *   - UNIQUE(attempts.session_id, question_id) ← давхар хариултын ӨС-ийн хамгаалалт
 * Бүх timestamp UTC (Бүлэг 5.4)
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

// ─── Хэрэглэгч ───

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 255 }).unique(),
    /** guest | google | facebook | dev */
    provider: varchar('provider', { length: 32 }).notNull(),
    /**
     * Провайдерын ID. `guest`-ийн хувьд СЭРГЭЭХ КОДЫН sha256 хэш —
     * код өөрөө ХЭЗЭЭ Ч хадгалагдахгүй.
     */
    providerId: varchar('provider_id', { length: 128 }),
    locale: varchar('locale', { length: 8 }).notNull().default('mn'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** Нэвтрэлтийн хайлт + нэг провайдерт нэг л бүртгэл */
    usersProviderUq: uniqueIndex('users_provider_uq').on(t.provider, t.providerId),
  })
);

export const profiles = pgTable(
  'profiles',
  {
    userId: integer('user_id')
      .primaryKey()
      .references(() => users.id),
    /**
     * Дэлгэцийн нэр. NULL = зочин нэрээ хараахан тавиагүй — UI «Зочин»
     * гэж харуулж, хуваалцах эсвэл бүлэгт нэгдэх үед нэр асууна.
     */
    displayName: varchar('display_name', { length: 40 }),
    /** Хамгийн урт цуврал — «дээд амжилт» */
    bestStreak: integer('best_streak').notNull().default(0),
    avatarEmoji: varchar('avatar_emoji', { length: 16 }).notNull().default('🧑‍🌾'),
    xp: integer('xp').notNull().default(0),
    rankTier: varchar('rank_tier', { length: 16 }).notNull().default('bronze'),
    activeHeroId: integer('active_hero_id'),
    streakDays: integer('streak_days').notNull().default(0),
    lastActiveDate: varchar('last_active_date', { length: 10 }), // YYYY-MM-DD (UB)
    streakFreeMode: boolean('streak_free_mode').notNull().default(false),
    streakShieldUsedMonth: varchar('streak_shield_used_month', { length: 7 }),
    fiftyFiftyUsedDate: varchar('fifty_fifty_used_date', { length: 10 }),
    bonusLedger: jsonb('bonus_ledger').notNull().default({}),
    onboardingDone: boolean('onboarding_done').notNull().default(false),
    /**
     * ROADMAP B5 — тоглогчийн зам (competitor|collector|researcher|storyteller).
     * ⚠ ХААЛТ БИШ, зөвхөн нүүр дэлгэцийн эрэмбэ. NULL = эрэмбэлэхгүй.
     */
    playerPath: varchar('player_path', { length: 16 }),
  },
    (t) => ({
    profilesRankXpIdx: index('profiles_rank_xp_idx').on(t.rankTier, t.xp),
  })
);

// ─── Контент ───

export const eras = pgTable('eras', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  orderIndex: integer('order_index').notNull(),
  startYear: varchar('start_year', { length: 60 }),
  endYear: varchar('end_year', { length: 60 }),
  description: text('description'),
});

export const questions = pgTable(
  'questions',
  {
    id: serial('id').primaryKey(),
    eraId: integer('era_id')
      .notNull()
      .references(() => eras.id),
    type: varchar('type', { length: 24 }).notNull().default('multiple_choice'),
    difficulty: varchar('difficulty', { length: 12 }).notNull(), // easy|medium|hard
    /** classic | myth_or_fact | proverb | what_if — @nomad/core QuestionFormat */
    format: varchar('format', { length: 24 }).notNull().default('classic'),
    body: text('body').notNull(),
    options: jsonb('options').notNull(),
    correctIndex: integer('correct_index').notNull(),
    explanation: text('explanation').notNull(),
    /** Эх сурвалж — ЗААВАЛ (Бүлэг 6.2) */
    sourceRef: text('source_ref').notNull(),
    status: varchar('status', { length: 16 }).notNull().default('draft'), // draft|reviewed|published
    isGoldenStandard: boolean('is_golden_standard').notNull().default(false), // Бүлэг 6.3
    /**
     * Агуулгын хүснэгтийн тогтвортой түлхүүр (`Q-0001`) — `content/questions.csv`.
     * CSV-г хэдэн ч удаа импортолсон давхардахгүй, засвар нь ижил мөрийг шинэчилнэ.
     */
    contentKey: varchar('content_key', { length: 32 }),
    /** Нийтлэхийг зөвшөөрсөн түүхч — хариуцлага, аудит */
    reviewedBy: varchar('reviewed_by', { length: 120 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
    (t) => ({
    questionsQuizIdx: // Partial index — зөвхөн published асуултууд quiz-д орно (Бүлэг 5.2)
    index('questions_quiz_idx')
      .on(t.eraId, t.difficulty, t.status)
      .where(sql`status = 'published'`),
    questionsContentKeyUq: uniqueIndex('questions_content_key_uq').on(t.contentKey),
  })
);

export const questionStats = pgTable('question_stats', {
  questionId: integer('question_id')
    .primaryKey()
    .references(() => questions.id),
  attempts: integer('attempts').notNull().default(0),
  correctCount: integer('correct_count').notNull().default(0),
  avgMs: real('avg_ms').notNull().default(0),
  // Өдөрт нэг удаа batch job-аар шинэчилнэ (Бүлэг 5.2)
});

export const contentReviews = pgTable('content_reviews', {
  id: serial('id').primaryKey(),
  questionId: integer('question_id')
    .notNull()
    .references(() => questions.id),
  reviewerId: integer('reviewer_id').references(() => users.id),
  verdict: varchar('verdict', { length: 24 }).notNull(), // approve|reject|report
  note: text('note'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Quiz ───

export const quizSessions = pgTable(
  'quiz_sessions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    questionIds: jsonb('question_ids').notNull(),
    serverNonce: varchar('server_nonce', { length: 64 }).notNull().unique(),
    mode: varchar('mode', { length: 16 }).notNull().default('daily'), // daily|free|battle
  },
    (t) => ({
    quizSessionsUserIdx: index('quiz_sessions_user_idx').on(t.userId, t.issuedAt),
  })
);

export const attempts = pgTable(
  'attempts',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    questionId: integer('question_id')
      .notNull()
      .references(() => questions.id),
    sessionId: integer('session_id')
      .notNull()
      .references(() => quizSessions.id),
    isCorrect: boolean('is_correct').notNull(),
    responseMs: integer('response_ms').notNull(),
    confidenceLevel: integer('confidence_level'), // 1–3 метакогнитив (Бүлэг 3.7)
    xpAwarded: integer('xp_awarded').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
    (t) => ({
    attemptsSessionQuestionUq: // 🔴 КРИТИК: ӨС-ийн түвшний давхар хариултын хамгаалалт (Бүлэг 5.2, 6.1)
    uniqueIndex('attempts_session_question_uq').on(t.sessionId, t.questionId),
    attemptsUserCreatedIdx: index('attempts_user_created_idx').on(t.userId, t.createdAt.desc()),
  })
);

// ─── Баатар / Олдвор ───

export const heroes = pgTable('heroes', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 80 }).notNull(),
  eraId: integer('era_id')
    .notNull()
    .references(() => eras.id),
  rankTier: varchar('rank_tier', { length: 16 }).notNull(),
  rarity: varchar('rarity', { length: 16 }).notNull().default('common'),
  perk: jsonb('perk').notNull().default({}),
  artUrl: text('art_url'),
  lore: text('lore').notNull(),
  sourceRef: text('source_ref').notNull(),
  chronologicalOrder: real('chronological_order').notNull(), // он цагийн эрэмбэ
});

export const userHeroes = pgTable(
  'user_heroes',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    heroId: integer('hero_id')
      .notNull()
      .references(() => heroes.id),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
    level: integer('level').notNull().default(1),
  },
    (t) => ({
    userHeroesUq: uniqueIndex('user_heroes_uq').on(t.userId, t.heroId),
  })
);

export const artifacts = pgTable('artifacts', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  eraId: integer('era_id')
    .notNull()
    .references(() => eras.id),
  rarity: varchar('rarity', { length: 16 }).notNull(),
  modelUrl: text('model_url'),
  emoji: varchar('emoji', { length: 16 }),
  description: text('description').notNull(),
  sourceRef: text('source_ref').notNull(),
});

export const userArtifacts = pgTable(
  'user_artifacts',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    artifactId: integer('artifact_id')
      .notNull()
      .references(() => artifacts.id),
    acquiredAt: timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
  },
    (t) => ({
    userArtifactsUq: uniqueIndex('user_artifacts_uq').on(t.userId, t.artifactId),
  })
);

// ─── Лиг ───

export const leagues = pgTable(
  'leagues',
  {
    id: serial('id').primaryKey(),
    weekKey: varchar('week_key', { length: 12 }).notNull(), // 2026-W35
    tier: varchar('tier', { length: 16 }).notNull(),
    bucketNo: integer('bucket_no').notNull(),
  },
    (t) => ({
    leaguesWeekTierBucketUq: uniqueIndex('leagues_week_tier_bucket_uq').on(t.weekKey, t.tier, t.bucketNo),
  })
);

export const leagueMembers = pgTable(
  'league_members',
  {
    leagueId: integer('league_id')
      .notNull()
      .references(() => leagues.id),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    weeklyXp: integer('weekly_xp').notNull().default(0),
    finalRank: integer('final_rank'),
  },
    (t) => ({
    leagueMembersUq: uniqueIndex('league_members_uq').on(t.leagueId, t.userId),
  })
);

// ─── RAG корпус (ADR-007, Бүлэг 6.4) ───

/**
 * Баталгаажсан монгол түүхийн корпус.
 * «AI нь энэ корпусаас гадуур юу ч хэлэхгүй.»
 *
 * Phase 2: `embedding` баганад pgvector(1536) + HNSW индекс нэмнэ.
 * MVP: keyword + pg_trgm хайлт (кирилл дээр ажиллана — Бүлэг 5.4).
 */
export const knowledgeChunks = pgTable(
  'knowledge_chunks',
  {
    id: serial('id').primaryKey(),
    /** Аль баатрын persona-д хамаарах вэ — ХАТУУ тусгаарлалт */
    personaHeroId: integer('persona_hero_id')
      .notNull()
      .references(() => heroes.id),
    eraId: integer('era_id').references(() => eras.id),
    keywords: jsonb('keywords').notNull(),
    text: text('text').notNull(),
    /** Эх сурвалж — ЗААВАЛ (Бүлэг 6.4: хариулт бүрд харуулна) */
    sourceRef: text('source_ref').notNull(),
    status: varchar('status', { length: 16 }).notNull().default('published'),
  },
    (t) => ({
    knowledgePersonaIdx: index('knowledge_persona_idx').on(t.personaHeroId, t.status),
  })
);

/** Түгээмэл асуултын кэш — зардлын хяналт (Бүлэг 6.4) */
export const mentorCache = pgTable(
  'mentor_cache',
  {
    id: serial('id').primaryKey(),
    personaHeroId: integer('persona_hero_id')
      .notNull()
      .references(() => heroes.id),
    /** normalize хийсэн асуултын хэш */
    queryHash: varchar('query_hash', { length: 64 }).notNull(),
    answer: text('answer').notNull(),
    sources: jsonb('sources').notNull(),
    hits: integer('hits').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
    (t) => ({
    mentorCacheUq: uniqueIndex('mentor_cache_uq').on(t.personaHeroId, t.queryHash),
  })
);

// ─── Хойшлуулсан шалгалт (Бүлэг 8.5) ───

/**
 * Сургалтын тогтвортой байдлын хэмжилт — R2/R4/R8/R12.
 * Салбарын судалгааны зөвхөн 11.1% нь үүнийг хэмждэг.
 */
export const retentionProbes = pgTable(
  'retention_probes',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    questionId: integer('question_id')
      .notNull()
      .references(() => questions.id),
    /** 2 | 4 | 8 | 12 */
    weekOffset: integer('week_offset').notNull(),
    /** Анх зөв хариулсан огноо */
    firstCorrectAt: timestamp('first_correct_at', { withTimezone: true }).notNull(),
    /** Probe-д хариулсан эсэх, зөв эсэх */
    probedAt: timestamp('probed_at', { withTimezone: true }),
    retained: boolean('retained'),
  },
    (t) => ({
    retentionProbeUq: uniqueIndex('retention_probe_uq').on(t.userId, t.questionId, t.weekOffset),
    retentionDueIdx: index('retention_due_idx').on(t.userId, t.weekOffset, t.probedAt),
  })
);

// ─── Офлайн sync-ийн давхардлын хамгаалалт (Бүлэг 6.6) ───

export const offlineSyncLog = pgTable(
  'offline_sync_log',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    questionId: integer('question_id')
      .notNull()
      .references(() => questions.id),
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull(),
    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
    (t) => ({
    offlineSyncUq: uniqueIndex('offline_sync_uq').on(t.userId, t.questionId, t.answeredAt),
  })
);


// ─── Гэрийн засал — ROADMAP B1 ───

/**
 * Гэрийн эд зүйл (ширдэг, хөшиг, авдар, морин хуур, тооно…).
 *
 * СУДАЛГААНЫ ҮНДЭСЛЭЛ (Lee, Yi, Kim 2020): тэдний туршилтад шагнал нь
 * ӨӨРӨӨ ЗАСВАРЛАДАГ ҮЗЭСГЭЛЭН байсан — шал, ханын цаас, хөгжим, баримал,
 * зураг. Ишлэл: «Зорилгодоо хүрсний дараа шагнал үр нөлөөгөө алддаг.
 * Тиймээс сонирхлыг хадгалахын тулд ӨӨРЧЛӨХ бүрэлдэхүүнийг ашигласан.»
 *
 * Монгол хувилбар нь бэлэн: ГЭР бол үзэсгэлэнгийн танхим.
 */
export const gerItems = pgTable('ger_items', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  /** floor | wall | furniture | instrument | roof | light */
  slot: varchar('slot', { length: 24 }).notNull(),
  eraId: integer('era_id').references(() => eras.id),
  rarity: varchar('rarity', { length: 16 }).notNull().default('common'),
  emoji: varchar('emoji', { length: 16 }),
  description: text('description').notNull(),
  sourceRef: text('source_ref').notNull(),
  /** Аль түвшинд нээгдэх вэ — Lee-гийн шаталсан шагналын загвар */
  unlockLevel: integer('unlock_level').notNull().default(1),
});

export const userGerItems = pgTable(
  'user_ger_items',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    itemId: integer('item_id')
      .notNull()
      .references(() => gerItems.id),
    acquiredAt: timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
    /** Гэрт байрлуулсан эсэх — нэг slot-д нэг л зүйл */
    equipped: boolean('equipped').notNull().default(false),
  },
  (t) => ({
    userGerItemsUq: uniqueIndex('user_ger_items_uq').on(t.userId, t.itemId),
    userGerEquippedIdx: index('user_ger_equipped_idx').on(t.userId, t.equipped),
  })
);

// ─── Интерактив өгүүлэмж (ROADMAP C2) ───

/**
 * Интерактив өгүүлэмж — «Та бол 1206 оны Их хуралдай дээрх элч».
 *
 * СУДАЛГААНЫ ҮНДЭСЛЭЛ: Khan-ы тоймд өгүүлэмж хамгийн олон давтагдсан.
 * López-Enríquez нарын ангиллаар «Structural» → «Narrative» шилжилт.
 *
 * ⚠ Асуулттай ижил ЗАСАГЛАЛД захирагдана: `status` нь `draft` төлөвтэй
 *   үүсэх ба `sourceRef` заавал (Бүлэг 6.2). Түүхч батлаагүй өгүүлэмж
 *   хүүхдэд харагдахгүй.
 */
export const stories = pgTable(
  'stories',
  {
    id: serial('id').primaryKey(),
    eraId: integer('era_id')
      .notNull()
      .references(() => eras.id),
    title: varchar('title', { length: 120 }).notNull(),
    summary: text('summary').notNull(),
    /** ⚠ Заавал — эх сурвалжгүй контент нийтлэгдэхгүй */
    sourceRef: text('source_ref').notNull(),
    /** draft | published */
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    xpReward: integer('xp_reward').notNull().default(40),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    storiesStatusIdx: index('stories_status_idx').on(t.status, t.eraId),
  })
);

/**
 * Өгүүлэмжийн зангилаа.
 *
 * `choices` нь `[{ label, nextKey, factNote }]`. Хоосон массив = ТӨГСГӨЛ.
 * ⚠ Граф нь `validateStory`-оор seed-ийн үед шалгагдана — эвдэрсэн
 *   өгүүлэмж ӨС-д орохгүй.
 */
export const storyNodes = pgTable(
  'story_nodes',
  {
    id: serial('id').primaryKey(),
    storyId: integer('story_id')
      .notNull()
      .references(() => stories.id),
    /** Графын доторх түлхүүр — «start», «end_a» гэх мэт */
    key: varchar('key', { length: 40 }).notNull(),
    body: text('body').notNull(),
    choices: jsonb('choices').notNull().default([]),
    /** Төгсгөлийн нэр — ⚠ аль ч төгсгөл «буруу» биш */
    endingLabel: varchar('ending_label', { length: 60 }),
  },
  (t) => ({
    storyNodesUq: uniqueIndex('story_nodes_uq').on(t.storyId, t.key),
  })
);

/** Дуусгасан өгүүлэмж — XP нэг л удаа */
export const storyCompletions = pgTable(
  'story_completions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    storyId: integer('story_id')
      .notNull()
      .references(() => stories.id),
    /** Хүрсэн төгсгөл — дахин тоглоход өөр төгсгөлд хүрч болно */
    endingKey: varchar('ending_key', { length: 40 }).notNull(),
    xpAwarded: integer('xp_awarded').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    storyCompletionsUq: uniqueIndex('story_completions_uq').on(t.userId, t.storyId),
  })
);

// ─── Ангийн лиг (ROADMAP B4) ───

/**
 * Анги — багшийн удирдлагатай бүлэг.
 *
 * СУДАЛГААНЫ ҮНДЭСЛЭЛ: Lee & Ko (2026) — үе тэнгийн харилцаа нь AI-тай
 * харилцахтай ИЖИЛ үр дүн өгдөг.
 *
 * ⚠ ЧӨЛӨӨТ БИЧВЭР БАЙХГҮЙ: `name` нь зөвхөн үүсгэгчид харагдах шошго
 *   (ж нь «10А анги»). Чат, сэтгэгдэл байхгүй тул Бүлэг 6.5-ын
 *   модерацийн эрсдэл нэмэгдэхгүй.
 */
export const classrooms = pgTable(
  'classrooms',
  {
    id: serial('id').primaryKey(),
    /** Нэгдэх код — самбар дээр бичихэд зориулсан */
    code: varchar('code', { length: 8 }).notNull().unique(),
    name: varchar('name', { length: 60 }).notNull(),
    /** Үүсгэсэн хүн — багш */
    ownerId: integer('owner_id')
      .notNull()
      .references(() => users.id),
    /** Хамтын зорилт — «анги нийлээд N асуулт» */
    goalTarget: integer('goal_target').notNull().default(1000),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    classroomsOwnerIdx: index('classrooms_owner_idx').on(t.ownerId),
  })
);

export const classroomMembers = pgTable(
  'classroom_members',
  {
    classroomId: integer('classroom_id')
      .notNull()
      .references(() => classrooms.id),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** Нэг хүүхэд нэг ангид нэг л удаа */
    classroomMembersUq: uniqueIndex('classroom_members_uq').on(t.classroomId, t.userId),
    classroomMembersUserIdx: index('classroom_members_user_idx').on(t.userId),
  })
);

// ─── Ахмад үеийн дуу хоолой (ROADMAP B3) ───

/**
 * Хүүхдийн өвөө эмээгээсээ цуглуулсан үлгэр, зүйр үг, домог.
 *
 * СУДАЛГААНЫ ҮНДЭСЛЭЛ: Khan — «биет бус өв нь биет өвөөс илүү чухал».
 * LOCUS төслийн үе хоорондын контент бүтээлт.
 *
 * ⚠ ЭНЭ НЬ R1 ЭРСДЭЛИЙГ ШИЙДНЭ: 100 хүүхэд × 3 зүйл = контентийн
 *   хомсдол дуусна. Гэхдээ ТҮҮХЧИЙН ЭЦСИЙН ХЯНАЛТ хэвээр (Бүлэг 6.2 —
 *   түүхэн үнэн зөв байдал нь нэр хүндийн эрсдэл).
 *
 * ⚠ МОДЕРАЦИ: `status` нь `pending` байх үед энэ бичвэр өөр хэрэглэгчид
 *   ХЭЗЭЭ Ч харагдахгүй. Зөвхөн `approved` болсны дараа нийтэд гарна.
 *   Тиймээс Бүлэг 6.5-ын чөлөөт бичвэрийн эрсдэл хяналтад байна.
 *
 * ⚠ НАСАНД ХҮРЭЭГҮЙ ХЭРЭГЛЭГЧ: `consentConfirmed` нь заавал true. Ахмад
 *   хүний БҮТЭН НЭР хадгалахгүй — зөвхөн хэрхэн дуудахыг (`elderLabel`,
 *   ж нь «Дорж өвөө») хадгална.
 */
export const elderContributions = pgTable(
  'elder_contributions',
  {
    id: serial('id').primaryKey(),
    /** Цуглуулсан хүүхэд — нэр нь баталгаажсаны дараа хажууд нь гарна */
    contributorId: integer('contributor_id')
      .notNull()
      .references(() => users.id),
    /** proverb | legend | story | custom | song */
    kind: varchar('kind', { length: 24 }).notNull(),
    /** Цуглуулсан бичвэр */
    body: text('body').notNull(),
    /** Хэрхэн дуудахыг — БҮТЭН НЭР БИШ (ж нь «Дорж өвөө») */
    elderLabel: varchar('elder_label', { length: 60 }).notNull(),
    /** Хаанаас, ямар нутгийнх — контекст */
    regionNote: text('region_note'),
    /** Зөвшөөрөл авсныг хүүхэд баталгаажуулсан эсэх — ЗААВАЛ true */
    consentConfirmed: boolean('consent_confirmed').notNull().default(false),
    /** pending | approved | rejected */
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    /** Түүхч/багшийн тэмдэглэл */
    reviewNote: text('review_note'),
    reviewerId: integer('reviewer_id').references(() => users.id),
    /** Баталгаажсаны дараа энэ хувь нэмрээс үүссэн асуулт */
    questionId: integer('question_id').references(() => questions.id),
    /** ⚠ Бүлэг 6.3: ЦУГЛУУЛАХАД олгоно, баталгаажуулахад олгохгүй */
    xpAwarded: integer('xp_awarded').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    elderContribUserIdx: index('elder_contrib_user_idx').on(t.contributorId, t.createdAt),
    /** Хяналтын дараалал — түүхч зөвхөн pending-ийг үзнэ */
    elderContribStatusIdx: index('elder_contrib_status_idx').on(t.status, t.createdAt),
  })
);

// ─── Зуучлал (ROADMAP C1) ───

/**
 * Зуучлалын оролдлого — «дүү нартаа тайлбарла».
 *
 * ⚠ НУУЦЛАЛ: `userText` нь ЗӨВХӨН бичсэн хэрэглэгчид харагдана. Өөр
 * хэрэглэгчид хэзээ ч үзүүлэхгүй тул Бүлэг 6.5-ын чөлөөт бичвэрийн
 * модерацийн эрсдэл үүсэхгүй. Энэ нь зохиомжийн шийдвэр — өөрчилвөл
 * модерацийн бүрэн шийдэл шаардлагатай болно.
 *
 * Оноог зөвхөн сервер тооцоолно (Бүлэг 6.1).
 */
export const mediationAttempts = pgTable(
  'mediation_attempts',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    questionId: integer('question_id')
      .notNull()
      .references(() => questions.id),
    /** explain_simple · explain_english · modernize · script_bridge */
    kind: text('kind').notNull().default('explain_simple'),
    /** Хэрэглэгчийн бичсэн текст — ЗӨВХӨН эзэнд нь харагдана */
    userText: text('user_text').notNull(),
    /** 0–100, сервер тооцоолсон */
    score: integer('score').notNull(),
    passed: boolean('passed').notNull(),
    xpAwarded: integer('xp_awarded').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** Нэг асуултад нэг л удаа XP — давтан бичих боломжтой ч XP нэг удаа */
    mediationUq: uniqueIndex('mediation_attempts_uq').on(t.userId, t.questionId, t.kind),
    mediationUserIdx: index('mediation_user_idx').on(t.userId, t.createdAt),
  })
);

// ─── Төлбөр (Phase 2 сүүл) ───

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  plan: varchar('plan', { length: 16 }).notNull(), // monthly|yearly
  provider: varchar('provider', { length: 16 }).notNull(), // qpay|socialpay
  externalInvoiceId: varchar('external_invoice_id', { length: 128 }),
  status: varchar('status', { length: 16 }).notNull().default('pending'), // pending|active|expired
  startedAt: timestamp('started_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
// ═══════════════════════════════════════════════════════════════════
// «ӨДРИЙН ТАВ» — вэб-д суурилсан бүтээгдэхүүн (2026-10)
// ═══════════════════════════════════════════════════════════════════

/**
 * Өдрийн багц — бүх хүнд ижил таван асуулт.
 *
 * ⚠ ЯАГААД ХАДГАЛДАГ ВЭ: сонголтыг хэшээр тооцвол асуулт нэмэгдэх бүрд
 *   ӨНГӨРСӨН өдрийн багц өөрчлөгдөнө — тэгвэл өчигдрийн сорилтын линкээр
 *   орсон найз өөр асуулт авч, харьцуулалт утгагүй болно.
 */
export const dailySets = pgTable('daily_sets', {
  /** UB огноо YYYY-MM-DD */
  dayKey: varchar('day_key', { length: 10 }).primaryKey(),
  /** Харагдах дарааллаар (амархан → хүнд) */
  questionIds: jsonb('question_ids').$type<number[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Нэг хэрэглэгчийн нэг өдрийн тоглолт.
 *
 * 🔴 UNIQUE(user_id, day_key) — нэг өдрийг НЭГ л удаа. Дахин тоглож
 *   оноогоо сайжруулах боломжгүй тул найзын харьцуулалт шударга.
 */
export const dailyPlays = pgTable(
  'daily_plays',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    dayKey: varchar('day_key', { length: 10 })
      .notNull()
      .references(() => dailySets.dayKey),
    /** Тухайн өдөрт нь тоглосон — зөвхөн энэ нь цувралд тооцогдоно */
    onTime: boolean('on_time').notNull().default(false),
    /** Хэний сорилтын линкээр орж ирсэн (сорилт → өрсөлдөгч болно) */
    challengedByPlayId: integer('challenged_by_play_id').references(
      (): AnyPgColumn => dailyPlays.id
    ),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    correctCount: integer('correct_count').notNull().default(0),
    /** Серверийн хэмжсэн нийт хариулах хугацаа — тайлбар унших хугацааг ОРУУЛАХГҮЙ */
    totalMs: integer('total_ms').notNull().default(0),
    /** Сорилтын линкийн код — дууссаны дараа үүснэ */
    shareCode: varchar('share_code', { length: 12 }).unique(),
  },
  (t) => ({
    dailyPlaysUserDayUq: uniqueIndex('daily_plays_user_day_uq').on(t.userId, t.dayKey),
    dailyPlaysDayIdx: index('daily_plays_day_idx').on(t.dayKey, t.finishedAt),
    dailyPlaysUserFinishedIdx: index('daily_plays_user_finished_idx').on(t.userId, t.finishedAt),
  })
);

/**
 * Асуулт тус бүрийн хариулт.
 *
 * `servedAt` нь асуулт НЭЭГДСЭН серверийн цаг. Хариултын хугацаа =
 * answeredAt − servedAt. Ингэснээр:
 *   • бүх асуултыг урьдчилж харах боломжгүй (нэг нэгээр нээгдэнэ)
 *   • тайлбар уншсан хугацаа дараагийн асуултад тооцогдохгүй
 */
export const dailyAnswers = pgTable(
  'daily_answers',
  {
    playId: integer('play_id')
      .notNull()
      .references(() => dailyPlays.id),
    /** 0..4 — багц доторх байрлал */
    position: smallint('position').notNull(),
    questionId: integer('question_id')
      .notNull()
      .references(() => questions.id),
    servedAt: timestamp('served_at', { withTimezone: true }).notNull().defaultNow(),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    /** ХАДГАЛСАН (canonical) индекс; -1 = хугацаа дууссан */
    selectedIndex: smallint('selected_index'),
    isCorrect: boolean('is_correct'),
    responseMs: integer('response_ms'),
  },
  (t) => ({
    dailyAnswersPk: primaryKey({ columns: [t.playId, t.position] }),
    dailyAnswersQuestionIdx: index('daily_answers_question_idx').on(t.questionId),
  })
);

/**
 * Найзын бүлэг — найзууд, гэр бүл, анги, клуб.
 * ⚠ Чат, сэтгэгдэл БАЙХГҮЙ — модерацийн эрсдэл нэмэгдэхгүй.
 */
export const friendGroups = pgTable(
  'friend_groups',
  {
    id: serial('id').primaryKey(),
    /** Урилгын код — гишүүн бүр хуваалцаж болно */
    code: varchar('code', { length: 8 }).notNull().unique(),
    name: varchar('name', { length: 40 }).notNull(),
    ownerId: integer('owner_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    friendGroupsOwnerIdx: index('friend_groups_owner_idx').on(t.ownerId),
  })
);

export const friendGroupMembers = pgTable(
  'friend_group_members',
  {
    groupId: integer('group_id')
      .notNull()
      .references(() => friendGroups.id),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    friendGroupMembersPk: primaryKey({ columns: [t.groupId, t.userId] }),
    friendGroupMembersUserIdx: index('friend_group_members_user_idx').on(t.userId),
  })
);

/**
 * Өрсөлдөгч — сорилтын линкээр нэг нэгнээ сорьсон хоёр хүн.
 *
 * Хос бүр НЭГ л мөр: `userLow < userHigh` (CHECK). Тулааны оноо нь
 * хадгалагдахгүй — хоёулаа тоглосон өдрүүдээс тооцоологдоно, тиймээс
 * хэзээ ч зөрөхгүй.
 */
export const rivalries = pgTable(
  'rivalries',
  {
    userLow: integer('user_low')
      .notNull()
      .references(() => users.id),
    userHigh: integer('user_high')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    rivalriesPk: primaryKey({ columns: [t.userLow, t.userHigh] }),
    rivalriesHighIdx: index('rivalries_high_idx').on(t.userHigh),
    rivalriesOrderCk: check('rivalries_order_ck', sql`${t.userLow} < ${t.userHigh}`),
  })
);
