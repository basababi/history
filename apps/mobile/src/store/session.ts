/**
 * Сессийн төлөв — токен ба сэргээх код (zustand + AsyncStorage)
 *
 * Вэб дээр AsyncStorage нь `localStorage` тул хөтөч хаагдсан ч зочин
 * ижил бүртгэлээрээ эргэж ирнэ.
 *
 * ⚠ БИЗНЕС ЛОГИК БАЙХГҮЙ: оноо, цуврал, цол БҮГД серверээс ирнэ (Бүлэг 6.1).
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SessionState {
  hydrated: boolean;
  token: string | null;
  userId: number | null;
  /**
   * Сэргээх код — токен хугацаа дуусахад чимээгүй дахин нэвтрэх, өөр
   * төхөөрөмж дээр цувралаа сэргээх цорын ганц арга.
   */
  recoveryCode: string | null;
  /** Дуу/чичиргээний тохиргоо — төхөөрөмжид хадгалагдана */
  hapticsEnabled: boolean;

  setSession: (s: { token: string; userId: number; recoveryCode?: string | null }) => void;
  setToken: (token: string | null) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  /** Өөр бүртгэл рүү шилжих — сэргээх кодоор */
  switchAccount: (s: { token: string; userId: number; recoveryCode: string }) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      hydrated: false,
      token: null,
      userId: null,
      recoveryCode: null,
      hapticsEnabled: true,

      setSession: ({ token, userId, recoveryCode }) =>
        set((s) => ({ token, userId, recoveryCode: recoveryCode ?? s.recoveryCode })),
      setToken: (token) => set({ token }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      switchAccount: ({ token, userId, recoveryCode }) => set({ token, userId, recoveryCode }),
    }),
    {
      name: 'ertniiov.session.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        token: s.token,
        userId: s.userId,
        recoveryCode: s.recoveryCode,
        hapticsEnabled: s.hapticsEnabled,
      }),
      onRehydrateStorage: () => () => {
        useSession.setState({ hydrated: true });
      },
    }
  )
);
