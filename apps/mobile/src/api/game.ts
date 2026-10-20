/**
 * «Өдрийн тав»-ын API — дэлгэцүүд зөвхөн эдгээр функцээр сервертэй ярина.
 * Бүх хариу zod-оор баталгаажна (`apiRequest`) — гэрээ зөрвөл ЭНД илэрнэ.
 */
import {
  ChallengeResponseSchema,
  ContentReportResponseSchema,
  DailyAnswerResultSchema,
  DailyNextResponseSchema,
  DailyTodayResponseSchema,
  DayResultSchema,
  GroupActionResultSchema,
  GroupDetailSchema,
  GroupLeaveResultSchema,
  GroupPreviewSchema,
  GroupsResponseSchema,
  MeResponseSchema,
  RecoveryCodeResponseSchema,
  RestoreAuthResponseSchema,
  SessionResponseSchema,
  RivalsResponseSchema,
  type ContentReportRequest,
  type DailyAnswerRequest,
  type DailyNextRequest,
  type GroupAction,
} from '@nomad/contracts';
import { apiRequest } from './client';

// ─── Нэвтрэлт ───

export const restoreSession = (recoveryCode: string) =>
  apiRequest('/api/auth/restore', RestoreAuthResponseSchema, { method: 'POST', body: { recoveryCode } });

/** Нэг дуудлагат эхлэл: cookie → сэргээх код → шинэ зочин (сервер шийднэ) */
export const startSession = (recoveryCode: string | null) =>
  apiRequest('/api/auth/session', SessionResponseSchema, {
    method: 'POST',
    body: recoveryCode ? { recoveryCode } : {},
  });

/** Шинэ сэргээх код — хуучин нь тэр дороо хүчингүй */
export const rotateRecoveryCode = () =>
  apiRequest('/api/me/recovery', RecoveryCodeResponseSchema, { method: 'POST', body: {} });

// ─── Профайл ───

export const fetchMe = () => apiRequest('/api/me', MeResponseSchema);

export const updateDisplayName = (displayName: string) =>
  apiRequest('/api/me', MeResponseSchema, { method: 'PATCH', body: { displayName } });

// ─── Өдрийн тав ───

export const fetchToday = () => apiRequest('/api/daily/today', DailyTodayResponseSchema);

export const openNextQuestion = (body: DailyNextRequest) =>
  apiRequest('/api/daily/next', DailyNextResponseSchema, { method: 'POST', body });

export const submitDailyAnswer = (body: DailyAnswerRequest) =>
  apiRequest('/api/daily/answer', DailyAnswerResultSchema, { method: 'POST', body });

export const fetchDayResult = (dayKey: string) =>
  apiRequest(`/api/daily/result?dayKey=${encodeURIComponent(dayKey)}`, DayResultSchema);

// ─── Сорилт ба өрсөлдөгч ───

export const fetchChallenge = (code: string) =>
  apiRequest(`/api/challenges/${encodeURIComponent(code)}`, ChallengeResponseSchema);

export const fetchRivals = () => apiRequest('/api/rivals', RivalsResponseSchema);

// ─── Найзын бүлэг ───

export const fetchGroups = () => apiRequest('/api/groups', GroupsResponseSchema);

export const groupAction = (body: GroupAction) =>
  apiRequest('/api/groups', GroupActionResultSchema, { method: 'POST', body });

export const fetchGroup = (id: number) => apiRequest(`/api/groups/${id}`, GroupDetailSchema);

export const leaveGroup = (id: number) =>
  apiRequest(`/api/groups/${id}/membership`, GroupLeaveResultSchema, { method: 'DELETE' });

export const fetchGroupPreview = (code: string) =>
  apiRequest(`/api/groups/preview/${encodeURIComponent(code)}`, GroupPreviewSchema);

// ─── Контентийн хяналт ───

export const reportDailyQuestion = (body: ContentReportRequest) =>
  apiRequest('/api/content/report', ContentReportResponseSchema, { method: 'POST', body });
