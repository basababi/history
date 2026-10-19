/**
 * Клиент төлөв — zustand
 *
 * ⚠ ЭНЭ ФАЙЛД БИЗНЕС ЛОГИК БАЙХГҮЙ.
 * XP, rank, streak, unlock БҮГД серверээс ирнэ (Бүлэг 6.1). Энд зөвхөн
 * серверийн сүүлийн хариуны кэш болон UI-ийн тохиргоо хадгална.
 *
 * Өмнөх хувилбарт `finishQuizSession()` клиент дээр XP тооцож, баатар
 * нээж байсан нь Бүлэг 4.5-ын №1 anti-pattern («Клиент талд оноо бодох»).
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProfileResponse } from '@nomad/contracts';
import type { Locale } from '@/i18n';

interface GameState {
  hydrated: boolean;
  setHydrated: () => void;

  /** Auth token — SecureStore-д зөөх хүртэлх түр байршил */
  authToken: string | null;
  setAuthToken: (token: string | null) => void;

  /** Серверээс ирсэн профайлын кэш (эх сурвалж нь ҮРГЭЛЖ сервер) */
  profile: ProfileResponse | null;
  setProfile: (profile: ProfileResponse | null) => void;

  /** Онбординг дууссан эсэх — серверт бичигдэх хүртэлх локал тэмдэглэгээ */
  onboardingSeen: boolean;
  markOnboardingSeen: () => void;

  locale: Locale;
  setLocale: (locale: Locale) => void;

  /** Сүлжээний төлөв — офлайн горимын индикатор */
  isOffline: boolean;
  setOffline: (offline: boolean) => void;

  /** Sync хүлээж буй хариултын тоо */
  pendingSyncCount: number;
  setPendingSyncCount: (n: number) => void;

  signOut: () => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),

      authToken: null,
      setAuthToken: (authToken) => set({ authToken }),

      profile: null,
      setProfile: (profile) => set({ profile }),

      onboardingSeen: false,
      markOnboardingSeen: () => set({ onboardingSeen: true }),

      locale: 'mn',
      setLocale: (locale) => set({ locale }),

      isOffline: false,
      setOffline: (isOffline) => set({ isOffline }),

      pendingSyncCount: 0,
      setPendingSyncCount: (pendingSyncCount) => set({ pendingSyncCount }),

      signOut: () =>
        set({ authToken: null, profile: null, onboardingSeen: false }),
    }),
    {
      name: 'nomad-legacy-client',
      storage: createJSONStorage(() => AsyncStorage),
      // Профайлыг хадгалахгүй — ҮРГЭЛЖ серверээс шинээр татна
      partialize: (s) => ({
        authToken: s.authToken,
        onboardingSeen: s.onboardingSeen,
        locale: s.locale,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
