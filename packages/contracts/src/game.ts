/**
 * «Өдрийн тав»-ын API гэрээ — клиент ба сервер ИЖИЛ схем ашиглана.
 *
 * ГОЛ ДҮРЭМ:
 *   • `correctIndex` нь зөвхөн ХАРИУЛСНЫ ДАРАА ирнэ (Бүлэг 6.1).
 *   • Индекс бүр ХАРАГДАХ дарааллаар — сервер өөрөө хадгалсан дараалал руу
 *     хөрвүүлнэ. Клиент хольсон дарааллын талаар юу ч мэдэх шаардлагагүй.
 *   • Нийтэд нээлттэй хариунд (сорилтын линк) асуултын агуулга ХЭЗЭЭ Ч
 *     орохгүй — зөвхөн дүн. Спойлер байхгүй.
 */
import { z } from 'zod';

const int = () => z.number().int();
const dayKey = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const questionFormatSchema = z.enum(['classic', 'myth_or_fact', 'proverb', 'what_if']);
export type QuestionFormatValue = z.infer<typeof questionFormatSchema>;

// ─── Нэвтрэлт ───

export const GuestAuthResponseSchema = z.object({
  token: z.string(),
  userId: int(),
  /**
   * Сэргээх код — ЗӨВХӨН шинэ бүртгэл үүсэхэд НЭГ удаа ирнэ. Клиент
   * хадгалж, токен хүчингүй болоход түүгээр дахин нэвтэрнэ.
   */
  recoveryCode: z.string(),
});
export type GuestAuthResponse = z.infer<typeof GuestAuthResponseSchema>;

export const RestoreAuthRequestSchema = z.object({
  recoveryCode: z.string().min(10).max(64),
});
export type RestoreAuthRequest = z.infer<typeof RestoreAuthRequestSchema>;

export const RestoreAuthResponseSchema = z.object({
  token: z.string(),
  userId: int(),
});
export type RestoreAuthResponse = z.infer<typeof RestoreAuthResponseSchema>;

/**
 * POST /api/auth/session — вэбийн нэг дуудлагат эхлэл.
 *   cookie хүчинтэй → тэр хэрэглэгч · код таарвал → сэргээнэ · эс бөгөөс → шинэ зочин
 */
export const SessionRequestSchema = z.object({
  recoveryCode: z.string().min(10).max(64).optional(),
});
export type SessionRequest = z.infer<typeof SessionRequestSchema>;

export const SessionResponseSchema = z.object({
  token: z.string(),
  userId: int(),
  created: z.boolean(),
  /**
   * Клиентийн ХАДГАЛАХ ёстой сэргээх код: шинэ зочин бол шинэ код, илгээсэн
   * код энэ хэрэглэгчийнх бол түүнийг, бусад үед null (клиент мартана).
   */
  recoveryCode: z.string().nullable(),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

/** POST /api/me/recovery — шинэ сэргээх код (хуучин нь хүчингүй болно) */
export const RecoveryCodeResponseSchema = z.object({
  recoveryCode: z.string(),
});
export type RecoveryCodeResponse = z.infer<typeof RecoveryCodeResponseSchema>;

// ─── Цол ба профайл ───

export const TitleSchema = z.object({
  key: z.string(),
  label: z.string(),
  nextLabel: z.string().nullable(),
  /** 0..1 */
  progress: z.number(),
  remaining: int(),
});
export type TitleInfo = z.infer<typeof TitleSchema>;

export const HistoryEntrySchema = z.object({
  dayKey: dayKey(),
  dayNumber: int(),
  correct: int(),
  total: int(),
  totalMs: int(),
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export const MeResponseSchema = z.object({
  userId: int(),
  /** null = нэрээ хараахан тавиагүй зочин */
  displayName: z.string().nullable(),
  title: TitleSchema,
  streak: z.object({
    current: int(),
    best: int(),
    playedToday: z.boolean(),
  }),
  stats: z.object({
    plays: int(),
    totalCorrect: int(),
    perfectDays: int(),
    /** Нэг өдрийн дундаж зөв */
    averageCorrect: z.number(),
  }),
  /** Сүүлийн 30 тоглолт, шинэ нь эхэнд */
  history: z.array(HistoryEntrySchema),
  todayKey: dayKey(),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

export const UpdateMeRequestSchema = z.object({
  displayName: z.string().min(1).max(60),
});
export type UpdateMeRequest = z.infer<typeof UpdateMeRequestSchema>;

// ─── Өдрийн тав ───

export const playStatusSchema = z.enum(['not_started', 'in_progress', 'finished']);
export type PlayStatus = z.infer<typeof playStatusSchema>;

export const PlayProgressSchema = z.object({
  status: playStatusSchema,
  answered: int(),
  correct: int(),
  total: int(),
  totalMs: int(),
  /** Хариулсан асуултуудын зөв/буруу — дарааллаар */
  marks: z.array(z.boolean()),
  /** Дууссаны дараа л үүснэ */
  shareCode: z.string().nullable(),
});
export type PlayProgress = z.infer<typeof PlayProgressSchema>;

export const DailyTodayResponseSchema = z.object({
  dayKey: dayKey(),
  dayNumber: int(),
  /** Дараагийн тав хүртэлх хугацаа */
  msUntilNext: int(),
  play: PlayProgressSchema,
  /** Өнөөдөр дуусгасан тоглогчийн тоо — нийгмийн баталгаа */
  playersToday: int(),
});
export type DailyTodayResponse = z.infer<typeof DailyTodayResponseSchema>;

export const DailyNextRequestSchema = z.object({
  dayKey: dayKey(),
  /** Найзын сорилтын линкээр орж ирсэн бол — анхны нээлтэд л хэрэглэгдэнэ */
  challengeCode: z.string().max(16).optional(),
});
export type DailyNextRequest = z.infer<typeof DailyNextRequestSchema>;

export const DailyQuestionSchema = z.object({
  dayKey: dayKey(),
  position: int(),
  total: int(),
  questionId: int(),
  format: questionFormatSchema,
  difficulty: z.enum(['easy', 'medium', 'hard']),
  eraName: z.string(),
  body: z.string(),
  /** ХАРАГДАХ дарааллаар */
  options: z.array(z.string()),
  timeLimitMs: int(),
  /** Хугацаа дуустал үлдсэн — хуудас сэргээхэд таймер шинээр эхлэхгүй */
  remainingMs: int(),
});
export type DailyQuestion = z.infer<typeof DailyQuestionSchema>;

export const DailyNextResponseSchema = z.discriminatedUnion('done', [
  z.object({
    done: z.literal(false),
    question: DailyQuestionSchema,
    /** Өмнө хариулсан асуултуудын зөв/буруу — хуудас сэргээхэд хэрэгтэй */
    marks: z.array(z.boolean()),
  }),
  z.object({ done: z.literal(true) }),
]);
export type DailyNextResponse = z.infer<typeof DailyNextResponseSchema>;

export const DailyAnswerRequestSchema = z.object({
  dayKey: dayKey(),
  position: int().min(0).max(19),
  /** ХАРАГДАХ индекс; -1 = клиентийн таймер дууссан */
  selectedIndex: int().min(-1).max(9),
});
export type DailyAnswerRequest = z.infer<typeof DailyAnswerRequestSchema>;

export const DailyAnswerResultSchema = z.object({
  position: int(),
  isCorrect: z.boolean(),
  timedOut: z.boolean(),
  /** ХАРАГДАХ индекс */
  correctIndex: int(),
  /** ХАРАГДАХ индекс; -1 = хугацаа дууссан */
  selectedIndex: int(),
  responseMs: int(),
  explanation: z.string(),
  sourceRef: z.string(),
  /** Энэ асуултыг зөв хариулсан хүмүүсийн хувь (0..1). Цөөн бол null */
  correctRate: z.number().nullable(),
  finished: z.boolean(),
});
export type DailyAnswerResult = z.infer<typeof DailyAnswerResultSchema>;

// ─── Дүн ба тулаан ───

export const RecordSchema = z.object({
  wins: int(),
  losses: int(),
  ties: int(),
  days: int(),
});
export type DuelRecord = z.infer<typeof RecordSchema>;

export const OpponentResultSchema = z.object({
  userId: int(),
  displayName: z.string(),
  title: z.string(),
  correct: int(),
  total: int(),
  totalMs: int(),
  marks: z.array(z.boolean()),
});
export type OpponentResult = z.infer<typeof OpponentResultSchema>;

export const DuelSummarySchema = z.object({
  opponent: OpponentResultSchema,
  outcome: z.enum(['win', 'loss', 'tie']),
  headline: z.string(),
  detail: z.string(),
  record: RecordSchema,
});
export type DuelSummary = z.infer<typeof DuelSummarySchema>;

export const DayResultSchema = z.object({
  dayKey: dayKey(),
  dayNumber: int(),
  isToday: z.boolean(),
  correct: int(),
  total: int(),
  totalMs: int(),
  marks: z.array(z.boolean()),
  perQuestion: z.array(
    z.object({
      position: int(),
      isCorrect: z.boolean(),
      timedOut: z.boolean(),
      responseMs: int(),
      correctRate: z.number().nullable(),
    })
  ),
  shareCode: z.string(),
  /** Өнөөдрийн тоглогчдын дундах байр */
  rank: z.object({ position: int(), players: int() }),
  /** Сорилтын линкээр орж ирсэн бол — тэр хүнтэй харьцуулалт */
  duel: DuelSummarySchema.nullable(),
  /** Энэ өдрийг тоглосон өрсөлдөгчидтэй харьцуулалт */
  rivals: z.array(DuelSummarySchema),
  streak: z.object({ current: int(), best: int() }),
  title: TitleSchema,
  /** Энэ тоглолтоор шинэ цол авсан бол түүний нэр */
  titleUp: z.string().nullable(),
  /** Хуваалцахын өмнө нэр тавих шаардлагатай эсэх */
  needsName: z.boolean(),
});
export type DayResult = z.infer<typeof DayResultSchema>;

// ─── Сорилтын линк (нийтэд нээлттэй) ───

export const ChallengeResponseSchema = z.object({
  code: z.string(),
  dayKey: dayKey(),
  dayNumber: int(),
  isToday: z.boolean(),
  owner: z.object({ displayName: z.string(), title: z.string() }),
  ownerResult: z.object({
    correct: int(),
    total: int(),
    totalMs: int(),
    marks: z.array(z.boolean()),
  }),
  /** Нэвтэрсэн үзэгчийн төлөв — нэвтрээгүй бол null */
  viewer: z
    .object({
      isOwner: z.boolean(),
      status: playStatusSchema,
      duel: DuelSummarySchema.nullable(),
    })
    .nullable(),
});
export type ChallengeResponse = z.infer<typeof ChallengeResponseSchema>;

// ─── Өрсөлдөгчид ───

export const RivalSchema = z.object({
  userId: int(),
  displayName: z.string(),
  title: z.string(),
  record: RecordSchema,
  /** Өнөөдрийн тавыг дуусгасан эсэх; дүн нь зөвхөн хоёулаа тоглосон үед */
  today: z.object({
    played: z.boolean(),
    correct: int().nullable(),
    totalMs: int().nullable(),
  }),
});
export type Rival = z.infer<typeof RivalSchema>;

export const RivalsResponseSchema = z.object({
  rivals: z.array(RivalSchema),
});
export type RivalsResponse = z.infer<typeof RivalsResponseSchema>;

// ─── Найзын бүлэг ───

export const GroupActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), name: z.string().min(1).max(60) }),
  z.object({ action: z.literal('join'), code: z.string().min(1).max(16) }),
]);
export type GroupAction = z.infer<typeof GroupActionSchema>;

export const GroupSummarySchema = z.object({
  id: int(),
  name: z.string(),
  code: z.string(),
  memberCount: int(),
  isOwner: z.boolean(),
  /** Энэ долоо хоногийн миний байр */
  myRank: int(),
  /** Өнөөдөр тоглосон гишүүд */
  playedToday: int(),
});
export type GroupSummary = z.infer<typeof GroupSummarySchema>;

export const GroupsResponseSchema = z.object({
  groups: z.array(GroupSummarySchema),
  maxGroups: int(),
});
export type GroupsResponse = z.infer<typeof GroupsResponseSchema>;

export const GroupActionResultSchema = z.object({
  group: GroupSummarySchema,
  created: z.boolean(),
});
export type GroupActionResult = z.infer<typeof GroupActionResultSchema>;

export const GroupMemberRowSchema = z.object({
  userId: int(),
  displayName: z.string(),
  title: z.string(),
  isMe: z.boolean(),
  isOwner: z.boolean(),
  rank: int(),
  weekCorrect: int(),
  daysPlayed: int(),
  today: z.object({
    played: z.boolean(),
    correct: int().nullable(),
    totalMs: int().nullable(),
    marks: z.array(z.boolean()),
  }),
});
export type GroupMemberRow = z.infer<typeof GroupMemberRowSchema>;

export const GroupDetailSchema = z.object({
  group: GroupSummarySchema,
  weekStart: dayKey(),
  dayKey: dayKey(),
  members: z.array(GroupMemberRowSchema),
});
export type GroupDetail = z.infer<typeof GroupDetailSchema>;

export const GroupPreviewSchema = z.object({
  code: z.string(),
  name: z.string(),
  memberCount: int(),
  isMember: z.boolean(),
  /** Зөвхөн гишүүн бол — «Бүлэг рүү очих» товчинд */
  groupId: int().nullable(),
  full: z.boolean(),
});
export type GroupPreview = z.infer<typeof GroupPreviewSchema>;

export const GroupLeaveResultSchema = z.object({ left: z.literal(true) });
export type GroupLeaveResult = z.infer<typeof GroupLeaveResultSchema>;
