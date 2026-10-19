/**
 * Endpoint бүрийн typed дуудлага — @nomad/contracts-ийн schema-гаар баталгаажна
 */
import { z } from 'zod';
import {
  StoryCompleteRequestSchema,
  StoryCompleteResponseSchema,
  StoryListResponseSchema,
  ClassroomActionSchema,
  ClassroomJoinResultSchema,
  ClassroomResponseSchema,
  ContentReportRequestSchema,
  ContributionListSchema,
  ContributionRequestSchema,
  ContributionResponseSchema,
  contributionKindSchema,
  MediationRequestSchema,
  MediationResultSchema,
  mediationKindSchema,
  ContentReportResponseSchema,
  CreateSessionRequestSchema,
  CreateSessionResponseSchema,
  FinishSessionResponseSchema,
  FiftyFiftyResponseSchema,
  LeagueResponseSchema,
  MentorReplySchema,
  OfflinePackResponseSchema,
  OfflineSyncResponseSchema,
  CatalogResponseSchema,
  GerResponseSchema,
  DevLoginResponseSchema,
  ProfileResponseSchema,
  AnswerResultSchema,
  VoiceScoreResponseSchema,
  type ConfidenceLevel,
  type ContentReportRequest,
  type OfflineAttempt,
  type QuizMode,
  type UpdateProfileRequest,
} from '@nomad/contracts';
import { apiRequest } from './client';

// ─── Нэвтрэлт ───

/** Хөгжүүлэлтийн нэвтрэлт — production-д 404 буцна */
export function devLogin(params: { deviceId: string; displayName?: string }) {
  return apiRequest('/api/auth/dev-login', DevLoginResponseSchema, {
    method: 'POST',
    body: params,
  });
}

// ─── Гэр (ROADMAP B1) ───

export function fetchGer() {
  return apiRequest('/api/ger', GerResponseSchema);
}

export function updateGerItem(params: { itemId: number; equipped: boolean }) {
  return apiRequest(
    '/api/ger',
    z.object({ ok: z.boolean(), itemId: z.number(), equipped: z.boolean(), slot: z.string() }),
    { method: 'PATCH', body: params }
  );
}

// ─── Профайл ───

export function fetchProfile() {
  return apiRequest('/api/profile', ProfileResponseSchema);
}

export function updateProfile(patch: UpdateProfileRequest) {
  return apiRequest('/api/profile', z.object({ ok: z.boolean() }), {
    method: 'PATCH',
    body: patch,
  });
}

export function fetchCatalog() {
  return apiRequest('/api/catalog', CatalogResponseSchema);
}

// ─── Quiz ───

export function createQuizSession(params: {
  questionCount?: number;
  eraId?: number;
  mode?: QuizMode;
}) {
  return apiRequest('/api/quiz/session', CreateSessionResponseSchema, {
    method: 'POST',
    body: CreateSessionRequestSchema.parse(params),
  });
}

export function submitAnswer(params: {
  token: string;
  questionId: number;
  selectedIndex: number;
  confidenceLevel?: ConfidenceLevel;
}) {
  return apiRequest('/api/quiz/answer', AnswerResultSchema, {
    method: 'POST',
    body: params,
  });
}

export function requestFiftyFifty(params: { token: string; questionId: number }) {
  return apiRequest('/api/quiz/fifty-fifty', FiftyFiftyResponseSchema, {
    method: 'POST',
    body: params,
  });
}

export function finishSession(token: string) {
  return apiRequest('/api/quiz/finish', FinishSessionResponseSchema, {
    method: 'POST',
    body: { token },
  });
}

// ─── Лиг ───

export function fetchLeague() {
  return apiRequest('/api/league/me', LeagueResponseSchema);
}

// ─── Mentor ───

export function askMentor(params: { personaId: number; query: string }) {
  return apiRequest('/api/mentor/ask', MentorReplySchema, {
    method: 'POST',
    body: params,
    timeoutMs: 30_000,
  });
}

// ─── Voice ───

export function scoreVoice(params: {
  twisterId: number;
  durationSec: number;
  audioBase64: string;
}) {
  return apiRequest('/api/voice/score', VoiceScoreResponseSchema, {
    method: 'POST',
    body: params,
    timeoutMs: 30_000,
  });
}

const TwisterListSchema = z.object({
  twisters: z.array(
    z.object({
      id: z.number(),
      text: z.string(),
      minSeconds: z.number(),
      maxSeconds: z.number(),
    })
  ),
});

export function fetchTwisters() {
  return apiRequest('/api/voice/score', TwisterListSchema);
}

// ─── Офлайн ───

export function fetchOfflinePack() {
  return apiRequest('/api/offline/pack', OfflinePackResponseSchema);
}

export function syncOfflineAttempts(attempts: OfflineAttempt[]) {
  return apiRequest('/api/offline/sync', OfflineSyncResponseSchema, {
    method: 'POST',
    body: { attempts },
    timeoutMs: 30_000,
  });
}

// ─── Контент ───

export function reportQuestion(params: ContentReportRequest) {
  return apiRequest('/api/content/report', ContentReportResponseSchema, {
    method: 'POST',
    body: ContentReportRequestSchema.parse(params),
  });
}

// ─── Зуучлал (ROADMAP C1) ───

/**
 * «Дүү нартаа тайлбарла» — оноог ЗӨВХӨН сервер тооцоолно (Бүлэг 6.1).
 * Бичсэн текст өөр хэрэглэгчид харагдахгүй.
 */
export function submitMediation(params: {
  questionId: number;
  kind?: z.infer<typeof mediationKindSchema>;
  userText: string;
}) {
  return apiRequest('/api/mediation', MediationResultSchema, {
    method: 'POST',
    body: MediationRequestSchema.parse({
      questionId: params.questionId,
      kind: params.kind ?? 'explain_simple',
      userText: params.userText,
    }),
  });
}

// ─── Ахмад үеийн дуу хоолой (ROADMAP B3) ───

/** Миний цуглуулсан зүйлс — ЗӨВХӨН өөрийнх */
export function fetchContributions() {
  return apiRequest('/api/contributions', ContributionListSchema);
}

/**
 * Өвөө эмээгээсээ сонссоноо илгээх.
 * ⚠ XP нь илгээснийх — батлагдсанаас хамаарахгүй (Бүлэг 6.3).
 */
export function submitContribution(params: {
  kind: z.infer<typeof contributionKindSchema>;
  body: string;
  elderLabel: string;
  regionNote?: string;
  consentConfirmed: boolean;
}) {
  return apiRequest('/api/contributions', ContributionResponseSchema, {
    method: 'POST',
    body: ContributionRequestSchema.parse(params),
  });
}

// ─── Ангийн лиг (ROADMAP B4) ───

export function fetchClassroom() {
  return apiRequest('/api/classroom', ClassroomResponseSchema);
}

/** Анги үүсгэх эсвэл кодоор нэгдэх */
export function classroomAction(params: z.infer<typeof ClassroomActionSchema>) {
  return apiRequest('/api/classroom', ClassroomJoinResultSchema, {
    method: 'POST',
    body: ClassroomActionSchema.parse(params),
  });
}

// ─── Интерактив өгүүлэмж (ROADMAP C2) ───

export function fetchStories() {
  return apiRequest('/api/story', StoryListResponseSchema);
}

/** ⚠ Зөвхөн явсан замаа илгээнэ — XP-г сервер тооцоолж олгоно */
export function completeStory(params: { storyId: number; path: string[] }) {
  return apiRequest('/api/story', StoryCompleteResponseSchema, {
    method: 'POST',
    body: StoryCompleteRequestSchema.parse(params),
  });
}
