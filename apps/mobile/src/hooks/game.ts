/**
 * TanStack Query hook-ууд — «Өдрийн тав»-ын серверийн төлөв
 *
 * Дэлгэц бүр loading / error төлөвтэй. 4xx-д дахин оролдохгүй (хэрэглэгчийн
 * алдааг давтаад засагдахгүй), сүлжээний алдаанд 2 удаа оролдоно.
 */
import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GroupAction } from '@nomad/contracts';
import { ApiError } from '@/api/client';
import {
  fetchChallenge,
  fetchDayResult,
  fetchGroup,
  fetchGroupPreview,
  fetchGroups,
  fetchMe,
  fetchRivals,
  fetchToday,
  groupAction,
  leaveGroup,
  updateDisplayName,
} from '@/api/game';

export const keys = {
  today: ['today'] as const,
  me: ['me'] as const,
  rivals: ['rivals'] as const,
  groups: ['groups'] as const,
  result: (dayKey: string) => ['result', dayKey] as const,
  challenge: (code: string) => ['challenge', code] as const,
  group: (id: number) => ['group', id] as const,
  groupPreview: (code: string) => ['groupPreview', code] as const,
};

export function retryPolicy(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (!error.retryable || (error.status >= 400 && error.status < 500))) {
    return false;
  }
  return failureCount < 2;
}

export function useToday() {
  return useQuery({
    queryKey: keys.today,
    queryFn: fetchToday,
    retry: retryPolicy,
    staleTime: 15_000,
    // Шөнө дунд өнгөрөөд таб руу буцахад шинэ өдрийг харуулна
    refetchOnWindowFocus: true,
  });
}

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: fetchMe, retry: retryPolicy, staleTime: 30_000 });
}

export function useDayResult(dayKey: string, enabled = true) {
  return useQuery({
    queryKey: keys.result(dayKey),
    queryFn: () => fetchDayResult(dayKey),
    retry: retryPolicy,
    enabled,
    staleTime: 20_000,
  });
}

export function useChallenge(code: string) {
  return useQuery({
    queryKey: keys.challenge(code),
    queryFn: () => fetchChallenge(code),
    retry: retryPolicy,
    staleTime: 20_000,
  });
}

export function useRivals() {
  return useQuery({
    queryKey: keys.rivals,
    queryFn: fetchRivals,
    retry: retryPolicy,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useGroups() {
  return useQuery({ queryKey: keys.groups, queryFn: fetchGroups, retry: retryPolicy, staleTime: 30_000 });
}

export function useGroup(id: number) {
  return useQuery({
    queryKey: keys.group(id),
    queryFn: () => fetchGroup(id),
    retry: retryPolicy,
    staleTime: 20_000,
    refetchOnWindowFocus: true,
  });
}

export function useGroupPreview(code: string) {
  return useQuery({
    queryKey: keys.groupPreview(code),
    queryFn: () => fetchGroupPreview(code),
    retry: retryPolicy,
  });
}

/** Нэр тавих — нэр харагддаг бүх кэшийг шинэчилнэ */
export function useUpdateName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateDisplayName,
    onSuccess: (me) => {
      qc.setQueryData(keys.me, me);
      void qc.invalidateQueries({ queryKey: ['result'] });
      void qc.invalidateQueries({ queryKey: keys.groups });
      void qc.invalidateQueries({ queryKey: ['group'] });
    },
  });
}

export function useGroupAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: GroupAction) => groupAction(action),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.groups });
      void qc.invalidateQueries({ queryKey: ['groupPreview'] });
    },
  });
}

export function useLeaveGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: leaveGroup,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.groups });
    },
  });
}

/** Тоглолт дууссаны дараа холбоотой бүх зүйлийг шинэчилнэ */
export function useInvalidateAfterPlay() {
  const qc = useQueryClient();
  // ⚠ ТОГТВОРТОЙ функц байх ЁСТОЙ: Play дэлгэцийн ачаалах effect үүнээс
  //   хамаардаг. Рендер бүрт шинэ функц буцаахад effect таймерын 200 мс
  //   тутамд дахин ажиллаж, сонголтыг арилгаад асуулт алгасдаг байв.
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: keys.today });
    void qc.invalidateQueries({ queryKey: keys.me });
    void qc.invalidateQueries({ queryKey: keys.rivals });
    void qc.invalidateQueries({ queryKey: keys.groups });
    void qc.invalidateQueries({ queryKey: ['challenge'] });
  }, [qc]);
}
