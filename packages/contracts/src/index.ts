/**
 * @nomad/contracts — API-ийн хил бүрд zod валидаци (Бүлэг 4.3)
 * Клиент болон сервер ижил schema ашиглана.
 *
 * ГОЛ ДҮРЭМ: `correctIndex` нь зөвхөн ХАРИУЛСНЫ ДАРАА AnswerResult дотор
 * буцна. Асуулт үйлчлэх үед ХЭЗЭЭ Ч явахгүй (Бүлэг 6.1).
 */
import { z } from 'zod';

// ─── Нийтлэг ───

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const difficultySchema = z.enum(['easy', 'medium', 'hard']);
export type Difficulty = z.infer<typeof difficultySchema>;

export const rankTierSchema = z.enum(['bronze', 'silver', 'gold', 'platinum']);
export type RankTier = z.infer<typeof rankTierSchema>;

export const questionStatusSchema = z.enum(['draft', 'reviewed', 'published']);
export type QuestionStatus = z.infer<typeof questionStatusSchema>;

/** Метакогнитив итгэлийн үнэлгээ (Бүлэг 3.7): 1=таамаг, 2=дунд, 3=итгэлтэй */
export const confidenceLevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;

export const quizModeSchema = z.enum(['daily', 'free', 'battle']);
export type QuizMode = z.infer<typeof quizModeSchema>;

// ─── Нэвтрэлт ───

export const DevLoginRequestSchema = z.object({
  deviceId: z.string().min(6).max(64),
  displayName: z.string().min(1).max(40).optional(),
});
export type DevLoginRequest = z.infer<typeof DevLoginRequestSchema>;

export const DevLoginResponseSchema = z.object({
  token: z.string(),
  userId: z.number().int(),
  isNewUser: z.boolean(),
});
export type DevLoginResponse = z.infer<typeof DevLoginResponseSchema>;

// ─── Профайл (GET /api/profile) ───

export const HeroPerkSchema = z.object({
  extraSeconds: z.number().optional(),
  fiftyFifty: z.boolean().optional(),
  streakShield: z.boolean().optional(),
  eraBonusMultiplier: z.number().optional(),
});
export type HeroPerk = z.infer<typeof HeroPerkSchema>;

export const HeroSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  eraId: z.number().int(),
  rankTier: rankTierSchema,
  rarity: z.string(),
  emoji: z.string().nullable(),
  lore: z.string(),
  sourceRef: z.string(),
  perk: HeroPerkSchema,
  unlocked: z.boolean(),
});
export type Hero = z.infer<typeof HeroSchema>;

export const ArtifactSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  eraId: z.number().int(),
  rarity: z.enum(['common', 'rare', 'epic']),
  emoji: z.string().nullable(),
  description: z.string(),
  sourceRef: z.string(),
  owned: z.boolean(),
});
export type Artifact = z.infer<typeof ArtifactSchema>;

export const EraSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  orderIndex: z.number().int(),
  startYear: z.string().nullable(),
  endYear: z.string().nullable(),
  description: z.string().nullable(),
});
export type Era = z.infer<typeof EraSchema>;

/** ROADMAP B5 — тоглогчийн зам (ХААЛТ БИШ, зөвхөн эрэмбэ) */
export const playerPathSchema = z.enum([
  'competitor',
  'collector',
  'researcher',
  'storyteller',
]);

export const ProfileResponseSchema = z.object({
  userId: z.number().int(),
  displayName: z.string(),
  avatarEmoji: z.string(),
  xp: z.number().int(),
  rankTier: rankTierSchema,
  rankTitle: z.string(),
  rankEra: z.string(),
  nextTierMinXp: z.number().int().nullable(),
  activeHeroId: z.number().int().nullable(),
  streakDays: z.number().int(),
  lastActiveDate: z.string().nullable(),
  streakFreeMode: z.boolean(),
  dailyDone: z.boolean(),
  unlockedHeroIds: z.array(z.number().int()),
  artifactIds: z.array(z.number().int()),
  onboardingDone: z.boolean(),
  /** ROADMAP B5 — null бол нүүр дэлгэц эрэмбэлэгдэхгүй */
  playerPath: playerPathSchema.nullable(),
});
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;

export const UpdateProfileRequestSchema = z.object({
  displayName: z.string().min(1).max(40).optional(),
  avatarEmoji: z.string().min(1).max(16).optional(),
  activeHeroId: z.number().int().nullable().optional(),
  streakFreeMode: z.boolean().optional(),
  onboardingDone: z.boolean().optional(),
  /** ROADMAP B5 — null нь «эрэмбэлэхгүй» гэсэн үг */
  playerPath: playerPathSchema.nullable().optional(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const CatalogResponseSchema = z.object({
  eras: z.array(EraSchema),
  heroes: z.array(HeroSchema),
  artifacts: z.array(ArtifactSchema),
});
export type CatalogResponse = z.infer<typeof CatalogResponseSchema>;

// ─── Quiz session (POST /api/quiz/session) ───

export const CreateSessionRequestSchema = z.object({
  questionCount: z.number().int().min(1).max(20).default(10),
  eraId: z.number().int().optional(),
  mode: quizModeSchema.default('daily'),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

/** correctIndex ХЭЗЭЭ Ч буцаахгүй — Бүлэг 6.1 */
export const ServedQuestionSchema = z.object({
  id: z.number().int(),
  eraId: z.number().int(),
  difficulty: difficultySchema,
  body: z.string(),
  options: z.array(z.string()),
  /** Серверийн epoch ms — хурдан бонусын хэмжилтийн суурь (алдааны засвар №4) */
  servedAt: z.number(),
});
export type ServedQuestion = z.infer<typeof ServedQuestionSchema>;

export const CreateSessionResponseSchema = z.object({
  sessionId: z.number().int(),
  token: z.string(),
  expiresAt: z.number(),
  mode: quizModeSchema,
  questions: z.array(ServedQuestionSchema),
  /** Идэвхтэй баатрын perk-ээс ирэх нэмэлт секунд */
  extraSecondsPerQuestion: z.number().int(),
  /** 50/50 өнөөдөр ашиглах боломжтой эсэх */
  fiftyFiftyAvailable: z.boolean(),
});
export type CreateSessionResponse = z.infer<typeof CreateSessionResponseSchema>;

// ─── 50/50 (POST /api/quiz/fifty-fifty) ───

export const FiftyFiftyRequestSchema = z.object({
  token: z.string(),
  questionId: z.number().int(),
});
export type FiftyFiftyRequest = z.infer<typeof FiftyFiftyRequestSchema>;

export const FiftyFiftyResponseSchema = z.object({
  hiddenIndexes: z.array(z.number().int()),
  remainingToday: z.number().int(),
});
export type FiftyFiftyResponse = z.infer<typeof FiftyFiftyResponseSchema>;

// ─── Answer (POST /api/quiz/answer) ───

export const SubmitAnswerRequestSchema = z.object({
  token: z.string().min(16),
  questionId: z.number().int(),
  /** -1 = хугацаа дууссан */
  selectedIndex: z.number().int().min(-1).max(9),
  confidenceLevel: confidenceLevelSchema.optional(),
});
export type SubmitAnswerRequest = z.infer<typeof SubmitAnswerRequestSchema>;

export const AnswerResultSchema = z.object({
  questionId: z.number().int(),
  isCorrect: z.boolean(),
  /** Зөвхөн хариулсны ДАРАА л ирнэ */
  correctIndex: z.number().int(),
  xpAwarded: z.number().int(),
  timeBonusApplied: z.boolean(),
  eraBonusApplied: z.boolean(),
  /** Өдрийн амархан асуултын хязгаар хүрсэн — XP олгогдоогүй (Бүлэг 3.6) */
  dailyLimitReached: z.boolean().optional(),
  responseMs: z.number().int(),
  explanation: z.string(),
  sourceRef: z.string(),
});
export type AnswerResult = z.infer<typeof AnswerResultSchema>;

// ─── Finish (POST /api/quiz/finish) ───

export const EraBreakdownSchema = z.object({
  eraId: z.number().int(),
  eraName: z.string(),
  attempted: z.number().int(),
  correct: z.number().int(),
  /** 0..1 — сул эрнийг харуулах (Бүлэг 3.7 эргэцүүлэл) */
  accuracy: z.number(),
});
export type EraBreakdown = z.infer<typeof EraBreakdownSchema>;

export const FinishSessionRequestSchema = z.object({
  token: z.string().min(16),
});
export type FinishSessionRequest = z.infer<typeof FinishSessionRequestSchema>;

export const FinishSessionResponseSchema = z.object({
  baseXp: z.number().int(),
  bonusXp: z.number().int(),
  totalXp: z.number().int(),
  correctCount: z.number().int(),
  totalQuestions: z.number().int(),
  newXp: z.number().int(),
  streakDays: z.number().int(),
  streakIncreased: z.boolean(),
  shieldUsed: z.boolean(),
  dailyChallengeAwarded: z.boolean(),
  streak7Awarded: z.boolean(),
  rankUp: rankTierSchema.nullable(),
  newRankTitle: z.string().nullable(),
  unlockedHeroIds: z.array(z.number().int()),
  unlockedArtifactIds: z.array(z.number().int()),
  /** Бодит эрин тус бүрийн нарийвчлал — Бүлэг 3.7 (алдааны засвар №9) */
  eraBreakdown: z.array(EraBreakdownSchema),
  /** Итгэлтэй байж буруудсан — давтах дараалалд эрт орно */
  overconfidentQuestionIds: z.array(z.number().int()),
});
export type FinishSessionResponse = z.infer<typeof FinishSessionResponseSchema>;

// ─── League (GET /api/league/me) ───

export const LeagueEntrySchema = z.object({
  userId: z.number().int(),
  displayName: z.string(),
  avatarEmoji: z.string(),
  weeklyXp: z.number().int(),
  rank: z.number().int(),
  isMe: z.boolean(),
  movement: z.enum(['promote', 'relegate', 'stay']),
});
export type LeagueEntry = z.infer<typeof LeagueEntrySchema>;

export const LeagueResponseSchema = z.object({
  weekKey: z.string(),
  tier: rankTierSchema,
  bucketNo: z.number().int(),
  myRank: z.number().int(),
  totalMembers: z.number().int(),
  entries: z.array(LeagueEntrySchema),
  /** Redis унасан → Postgres snapshot-оос уншсан (graceful degradation) */
  degraded: z.boolean(),
});
export type LeagueResponse = z.infer<typeof LeagueResponseSchema>;

// ─── Гэрийн засал (ROADMAP B1) ───

export const gerSlotSchema = z.enum([
  'floor',
  'wall',
  'furniture',
  'instrument',
  'roof',
  'light',
]);
export type GerSlot = z.infer<typeof gerSlotSchema>;

export const GerItemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slot: gerSlotSchema,
  eraId: z.number().int().nullable(),
  rarity: z.enum(['common', 'rare', 'epic']),
  emoji: z.string().nullable(),
  description: z.string(),
  sourceRef: z.string(),
  unlockLevel: z.number().int(),
  available: z.boolean(),
  owned: z.boolean(),
  equipped: z.boolean(),
});
export type GerItem = z.infer<typeof GerItemSchema>;

export const GerResponseSchema = z.object({
  level: z.number().int(),
  items: z.array(GerItemSchema),
});
export type GerResponse = z.infer<typeof GerResponseSchema>;

export const UpdateGerRequestSchema = z.object({
  itemId: z.number().int(),
  equipped: z.boolean(),
});
export type UpdateGerRequest = z.infer<typeof UpdateGerRequestSchema>;

// ─── Mentor (POST /api/mentor/ask) ───

export const MentorAskRequestSchema = z.object({
  personaId: z.number().int(),
  query: z.string().min(1).max(500),
});
export type MentorAskRequest = z.infer<typeof MentorAskRequestSchema>;

export const MentorReplySchema = z.object({
  text: z.string(),
  sources: z.array(z.string()),
  /** Контекст олдоогүй — «мэдэхгүй» гэж хариулсан (ADR-007) */
  outOfScope: z.boolean(),
  remainingMessages: z.number().int(),
});
export type MentorReply = z.infer<typeof MentorReplySchema>;

// ─── Voice (POST /api/voice/score) ───

export const VoiceScoreRequestSchema = z.object({
  twisterId: z.number().int(),
  durationSec: z.number().min(0).max(120),
  /** base64 аудио — оноолсны дараа ШУУД устгана (Бүлэг 6.5) */
  audioBase64: z.string().optional(),
});
export type VoiceScoreRequest = z.infer<typeof VoiceScoreRequestSchema>;

export const VoiceScoreResponseSchema = z.object({
  score: z.number().int().min(0).max(100),
  confidenceScore: z.number().int(),
  pacingScore: z.number().int(),
  durationScore: z.number().int(),
  durationSec: z.number(),
  feedback: z.string(),
  /** Түүхий аудио устгагдсаныг баталгаажуулна */
  audioDiscarded: z.boolean(),
});
export type VoiceScoreResponse = z.infer<typeof VoiceScoreResponseSchema>;

// ─── Офлайн (Бүлэг 6.6) ───

export const OfflinePackResponseSchema = z.object({
  packDate: z.string(),
  expiresAt: z.number(),
  questions: z.array(ServedQuestionSchema),
});
export type OfflinePackResponse = z.infer<typeof OfflinePackResponseSchema>;

export const OfflineAttemptSchema = z.object({
  questionId: z.number().int(),
  selectedIndex: z.number().int().min(-1).max(9),
  confidenceLevel: confidenceLevelSchema.optional(),
  /** Клиентийн бичсэн хариулсан цаг — сервер дахин баталгаажуулна */
  answeredAt: z.number(),
  responseMs: z.number().int().min(0),
});
export type OfflineAttempt = z.infer<typeof OfflineAttemptSchema>;

export const OfflineSyncRequestSchema = z.object({
  attempts: z.array(OfflineAttemptSchema).max(200),
});
export type OfflineSyncRequest = z.infer<typeof OfflineSyncRequestSchema>;

export const OfflineSyncResponseSchema = z.object({
  accepted: z.number().int(),
  rejected: z.array(
    z.object({ questionId: z.number().int(), reason: z.string() })
  ),
  xpAwarded: z.number().int(),
});
export type OfflineSyncResponse = z.infer<typeof OfflineSyncResponseSchema>;

// ─── Контентийн засаглал (Бүлэг 6.2, 6.3) ───

export const ContentReportRequestSchema = z.object({
  questionId: z.number().int(),
  /** Чөлөөт бичвэр БИШ — бүтэцлэгдсэн сонголт (Бүлэг 6.3 засвар №3) */
  reason: z.enum([
    'factually_wrong',
    'ambiguous_wording',
    'wrong_answer_marked',
    'outdated_source',
    'typo',
    'other',
  ]),
  note: z.string().max(500).optional(),
});
export type ContentReportRequest = z.infer<typeof ContentReportRequestSchema>;

export const ContentReportResponseSchema = z.object({
  queued: z.boolean(),
  /** Баталгаажуулалтад XP ОЛГОХГҮЙ — Бүлэг 6.3 засвар №1 */
  xpAwarded: z.literal(0),
});
export type ContentReportResponse = z.infer<typeof ContentReportResponseSchema>;

// ─── Хойшлуулсан шалгалт (Бүлэг 8.5) ───

export const RetentionProbeResponseSchema = z.object({
  week: z.union([z.literal(2), z.literal(4), z.literal(8), z.literal(12)]),
  questions: z.array(ServedQuestionSchema),
  /** Хэрэглэгч энэ probe-д хамрагдах эсэх (санамсаргүй түүвэр) */
  eligible: z.boolean(),
});
export type RetentionProbeResponse = z.infer<typeof RetentionProbeResponseSchema>;

// ─── Зуучлал (ROADMAP C1) ───

export const mediationKindSchema = z.enum([
  'explain_simple',
  'explain_english',
  'modernize',
  'script_bridge',
]);

export const MediationRequestSchema = z.object({
  questionId: z.number().int(),
  kind: mediationKindSchema.default('explain_simple'),
  /** Хэрэглэгчийн тайлбар — зөвхөн эзэнд нь харагдана */
  userText: z.string().min(1).max(280),
});
export type MediationRequest = z.infer<typeof MediationRequestSchema>;

export const MediationResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  coverageScore: z.number().int(),
  originalityScore: z.number().int(),
  lengthScore: z.number().int(),
  passed: z.boolean(),
  copied: z.boolean(),
  matchedTerms: z.array(z.string()),
  missedTerms: z.array(z.string()),
  feedback: z.string(),
  xpAwarded: z.number().int(),
  /** Энэ асуултад аль хэдийн XP авсан — дахин олгогдохгүй */
  alreadyRewarded: z.boolean(),
});
export type MediationResult = z.infer<typeof MediationResultSchema>;

// ─── Ахмад үеийн дуу хоолой (ROADMAP B3) ───

export const contributionKindSchema = z.enum([
  'proverb',
  'legend',
  'story',
  'custom',
  'song',
]);

export const ContributionRequestSchema = z.object({
  kind: contributionKindSchema,
  body: z.string().min(1).max(2000),
  /** Хэрхэн дуудахыг — БҮТЭН НЭР БИШ */
  elderLabel: z.string().min(1).max(60),
  regionNote: z.string().max(200).optional(),
  /** Ахмад хүнээс зөвшөөрөл авсан — ЗААВАЛ true */
  consentConfirmed: z.boolean(),
});
export type ContributionRequest = z.infer<typeof ContributionRequestSchema>;

export const ContributionItemSchema = z.object({
  id: z.number().int(),
  kind: contributionKindSchema,
  body: z.string(),
  elderLabel: z.string(),
  status: z.enum(['pending', 'approved', 'rejected']),
  reviewNote: z.string().nullable(),
  xpAwarded: z.number().int(),
  createdAt: z.string(),
});
export type ContributionItem = z.infer<typeof ContributionItemSchema>;

export const ContributionResponseSchema = z.object({
  accepted: z.boolean(),
  /** Тэнцээгүй шалтгаан */
  reason: z.string().optional(),
  message: z.string().optional(),
  xpAwarded: z.number().int(),
  /** Өнөөдөр үлдсэн илгээх эрх */
  remainingToday: z.number().int(),
  item: ContributionItemSchema.optional(),
});
export type ContributionResponse = z.infer<typeof ContributionResponseSchema>;

export const ContributionListSchema = z.object({
  items: z.array(ContributionItemSchema),
  remainingToday: z.number().int(),
  /** Нийт баталгаажсан тоо — «чиний оруулсан хувь нэмэр» */
  approvedCount: z.number().int(),
});
export type ContributionList = z.infer<typeof ContributionListSchema>;

// ─── Ангийн лиг (ROADMAP B4) ───

/** Анги үүсгэх эсвэл кодоор нэгдэх — ялгаварласан нэгдэл */
export const ClassroomActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    name: z.string().min(1).max(60),
  }),
  z.object({
    action: z.literal('join'),
    code: z.string().min(1).max(12),
  }),
]);
export type ClassroomAction = z.infer<typeof ClassroomActionSchema>;

export const ClassGoalSchema = z.object({
  ratio: z.number(),
  percent: z.number().int(),
  current: z.number().int(),
  target: z.number().int(),
  reached: z.boolean(),
  message: z.string(),
});

export const ClassEntrySchema = z.object({
  userId: z.number().int(),
  displayName: z.string(),
  avatarEmoji: z.string(),
  weeklyXp: z.number().int(),
  rank: z.number().int(),
  isMe: z.boolean(),
});

export const ClassroomResponseSchema = z.discriminatedUnion('joined', [
  z.object({ joined: z.literal(false) }),
  z.object({
    joined: z.literal(true),
    classroom: z.object({
      id: z.number().int(),
      /** Зөвхөн үүсгэгчид харагдана */
      code: z.string().nullable(),
      name: z.string(),
      isOwner: z.boolean(),
      memberCount: z.number().int(),
    }),
    weekKey: z.string(),
    goal: ClassGoalSchema,
    entries: z.array(ClassEntrySchema),
  }),
]);
export type ClassroomResponse = z.infer<typeof ClassroomResponseSchema>;

export const ClassroomJoinResultSchema = z.object({
  joined: z.boolean(),
  created: z.boolean(),
  code: z.string().nullable(),
  name: z.string(),
});
export type ClassroomJoinResult = z.infer<typeof ClassroomJoinResultSchema>;

// ─── Интерактив өгүүлэмж (ROADMAP C2) ───

export const StoryChoiceSchema = z.object({
  label: z.string(),
  nextKey: z.string(),
  /** Сонгосны ДАРАА харагдах түүхэн баримт */
  factNote: z.string().optional(),
});

export const StoryNodeSchema = z.object({
  key: z.string(),
  body: z.string(),
  choices: z.array(StoryChoiceSchema),
  /** ⚠ Аль ч төгсгөл «буруу» биш */
  endingLabel: z.string().optional(),
});

export const StorySchema = z.object({
  id: z.number().int(),
  eraId: z.number().int(),
  title: z.string(),
  summary: z.string(),
  sourceRef: z.string(),
  xpReward: z.number().int(),
  /** Өмнө нь хүрсэн төгсгөл — дахин тоглож өөр төгсгөл үзэж болно */
  completedEnding: z.string().nullable(),
  nodes: z.array(StoryNodeSchema),
});
export type Story = z.infer<typeof StorySchema>;

export const StoryListResponseSchema = z.object({
  stories: z.array(StorySchema),
});
export type StoryListResponse = z.infer<typeof StoryListResponseSchema>;

export const StoryCompleteRequestSchema = z.object({
  storyId: z.number().int(),
  /** `start`-аас хойш сонгосон зангилаанууд — сервер дахин алхаж шалгана */
  path: z.array(z.string()).max(20),
});
export type StoryCompleteRequest = z.infer<typeof StoryCompleteRequestSchema>;

export const StoryCompleteResponseSchema = z.object({
  endingKey: z.string(),
  xpAwarded: z.number().int(),
  alreadyCompleted: z.boolean(),
});
export type StoryCompleteResponse = z.infer<typeof StoryCompleteResponseSchema>;

// ─── «Өдрийн тав» (вэб-д суурилсан бүтээгдэхүүн) ───
export * from './game';
