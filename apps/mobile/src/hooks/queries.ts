/**
 * TanStack Query hook-ууд — серверийн төлөв, кэш, retry
 * Дэлгэц бүрд loading / error / offline төлөв өгнө.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateProfileRequest } from '@nomad/contracts';
import { ApiError } from '@/api/client';
import {
  fetchCatalog,
  fetchLeague,
  fetchOfflinePack,
  fetchProfile,
  fetchTwisters,
  syncOfflineAttempts,
  updateProfile,
} from '@/api/endpoints';
import {
  clearAttempts,
  getPendingAttempts,
  pruneStaleAttempts,
  saveOfflinePack,
} from '@/offline/queue';
import { useGameStore } from '@/store/useGameStore';

export const queryKeys = {
  profile: ['profile'] as const,
  league: ['league'] as const,
  twisters: ['twisters'] as const,
};

/** Сүлжээний алдааг 2 удаа л дахин оролдоно; 4xx-д огт оролдохгүй */
function retryPolicy(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    if (!error.retryable) return false;
    return failureCount < 2;
  }
  return failureCount < 2;
}

/**
 * Токен хүчингүй болсон эсэхийг таних.
 *
 * Хөгжүүлэлтэд ӨС дахин үүсэхэд (`db:reset`, эвдэрсэн хавтас сэргээх)
 * хуучин токен байхгүй хэрэглэгч рүү заасаар үлддэг. Ийм үед токеныг
 * цэвэрлэвэл `useAuth` автоматаар шинээр нэвтэрнэ.
 */
function isStaleSession(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === 'UNAUTHORIZED' || error.code === 'NO_PROFILE')
  );
}

export function useProfile() {
  const setProfile = useGameStore((s) => s.setProfile);
  const setOffline = useGameStore((s) => s.setOffline);
  const setAuthToken = useGameStore((s) => s.setAuthToken);

  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: async () => {
      try {
        const profile = await fetchProfile();
        setProfile(profile);
        setOffline(false);
        return profile;
      } catch (err) {
        if (isStaleSession(err)) {
          // Токеныг унтраана → useAuth дахин нэвтэрч, асуулга давтагдана
          setAuthToken(null);
        }
        throw err;
      }
    },
    retry: retryPolicy,
    staleTime: 30_000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateProfileRequest) => updateProfile(patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}

export function useLeague() {
  return useQuery({
    queryKey: queryKeys.league,
    queryFn: fetchLeague,
    retry: retryPolicy,
    staleTime: 60_000,
  });
}

export function useTwisters() {
  return useQuery({
    queryKey: queryKeys.twisters,
    queryFn: fetchTwisters,
    retry: retryPolicy,
    staleTime: 5 * 60_000,
  });
}

/**
 * Офлайн дарааллыг sync хийнэ (Бүлэг 6.6).
 * Сервер СЕРВЕРИЙН цагаар дахин баталгаажуулна — 24 цагаас хэтэрсэн
 * бол татгалзана, тиймээс эхлээд хуучирсныг цэвэрлэнэ.
 */
export function useSyncOffline() {
  const qc = useQueryClient();
  const setPendingSyncCount = useGameStore((s) => s.setPendingSyncCount);

  return useMutation({
    mutationFn: async () => {
      await pruneStaleAttempts();
      const pending = await getPendingAttempts();
      if (pending.length === 0) {
        setPendingSyncCount(0);
        return { accepted: 0, rejected: [], xpAwarded: 0 };
      }

      const result = await syncOfflineAttempts(
        pending.map(({ rowId: _rowId, ...a }) => a)
      );

      // Хүлээн авсан ба татгалзсан бүгдийг дарааллаас хасна —
      // татгалзсаныг дахин илгээх утгагүй (DUPLICATE эсвэл TOO_OLD)
      await clearAttempts(pending.map((p) => p.rowId));
      setPendingSyncCount(0);
      return result;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.profile });
      void qc.invalidateQueries({ queryKey: queryKeys.league });
    },
  });
}

/** Маргаашийн багцыг урьдчилж татаж кэшлэнэ (Бүлэг 6.6) */
export function usePrefetchOfflinePack() {
  return useMutation({
    mutationFn: async () => {
      const pack = await fetchOfflinePack();
      await saveOfflinePack(pack.packDate, pack.expiresAt, pack.questions);
      return pack.questions.length;
    },
  });
}

export function useCatalog() {
  return useQuery({
    queryKey: ['catalog'] as const,
    queryFn: fetchCatalog,
    retry: retryPolicy,
    staleTime: 5 * 60_000,
  });
}
