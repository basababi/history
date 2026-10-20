/**
 * Сессийн төлөв — токен ба сэргээх код (zustand + AsyncStorage)
 *
 * Вэб: токен ЭНД БАЙХГҮЙ — сервер HttpOnly cookie тавина (Safari-ийн
 * 7 хоногийн цэвэрлэгээ, XSS). Апп: токен AsyncStorage-д.
 * Сэргээх код хоёуланд нь хадгалагдана — cookie дууссан эсвэл төхөөрөмж
 * солиход бүртгэлээ сэргээх цорын ганц арга.
 *
 * ⚠ БИЗНЕС ЛОГИК БАЙХГҮЙ: оноо, цуврал, цол БҮГД серверээс ирнэ (Бүлэг 6.1).
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COOKIE_AUTH } from '@/api/client';

interface SessionState {
  hydrated: boolean;
  /** Апп-ын Bearer токен. Вэб дээр үргэлж null. */
  token: string | null;
  userId: number | null;
  /**
   * Сэргээх код — session дууссан үед чимээгүй дахин нэвтрэх, өөр
   * төхөөрөмж дээр цувралаа сэргээх арга. null = энэ төхөөрөмж мэдэхгүй.
   */
  recoveryCode: string | null;
  /** Дуу/чичиргээний тохиргоо — төхөөрөмжид хадгалагдана */
  hapticsEnabled: boolean;

  /** Сервер шийдсэн session — `recoveryCode`-ийг ДАРЖ бичнэ (гэрээг үз) */
  setSession: (s: { token: string | null; userId: number; recoveryCode: string | null }) => void;
  setToken: (token: string | null) => void;
  setRecoveryCode: (code: string) => void;
  setHapticsEnabled: (enabled: boolean) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      hydrated: false,
      token: null,
      userId: null,
      recoveryCode: null,
      hapticsEnabled: true,

      setSession: ({ token, userId, recoveryCode }) => set({ token: COOKIE_AUTH ? null : token, userId, recoveryCode }),
      setToken: (token) => set({ token: COOKIE_AUTH ? null : token }),
      setRecoveryCode: (recoveryCode) => set({ recoveryCode }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
    }),
    {
      name: 'ertniiov.session.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        token: COOKIE_AUTH ? null : s.token,
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
