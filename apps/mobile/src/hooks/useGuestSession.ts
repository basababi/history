/**
 * Сесс эхлүүлэх — бүртгүүлэхгүйгээр шууд тоглох
 *
 *   токен бий         → шууд бэлэн
 *   сэргээх код бий   → түүгээр дахин нэвтэрнэ (токен алдагдсан)
 *   юу ч байхгүй      → сервер чимээгүй зочны бүртгэл үүсгэнэ
 *
 * Мөн токен хүчингүй болоход API клиент энэ hook-ийн өгсөн функцээр
 * ЧИМЭЭГҮЙ шинэчилнэ — хэрэглэгч алдаа харахгүй.
 */
import { useEffect, useRef, useState } from 'react';
import { ApiError, configureApi, setAuthRefresher } from '@/api/client';
import { createGuest, restoreSession } from '@/api/game';
import { setHapticsEnabled } from '@/feedback';
import { useSession } from '@/store/session';

export interface SessionStatus {
  ready: boolean;
  error: string | null;
  retry: () => void;
}

/** Сэргээх кодоор шинэ токен — кодгүй бол null (шинэ зочин үүсгэхгүй) */
async function refreshToken(): Promise<string | null> {
  const { recoveryCode, setToken } = useSession.getState();
  if (!recoveryCode) return null;
  try {
    const res = await restoreSession(recoveryCode);
    setToken(res.token);
    configureApi({ token: res.token });
    return res.token;
  } catch {
    return null;
  }
}

export function useGuestSession(): SessionStatus {
  const hydrated = useSession((s) => s.hydrated);
  const token = useSession((s) => s.token);
  const haptics = useSession((s) => s.hapticsEnabled);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const running = useRef(false);

  useEffect(() => {
    setHapticsEnabled(haptics);
  }, [haptics]);

  useEffect(() => {
    setAuthRefresher(refreshToken);
    return () => setAuthRefresher(null);
  }, []);

  useEffect(() => {
    if (!hydrated || running.current) return;

    if (token) {
      configureApi({ token });
      setReady(true);
      return;
    }

    running.current = true;
    setError(null);

    void (async () => {
      try {
        const { recoveryCode, setSession } = useSession.getState();
        if (recoveryCode) {
          try {
            const restored = await restoreSession(recoveryCode);
            configureApi({ token: restored.token });
            setSession({ token: restored.token, userId: restored.userId });
            setReady(true);
            return;
          } catch (err) {
            // Код хүчингүй (ӨС шинэчлэгдсэн г.м.) — шинэ зочин үүсгэнэ
            if (!(err instanceof ApiError) || err.status !== 404) throw err;
          }
        }
        const created = await createGuest();
        configureApi({ token: created.token });
        setSession({ token: created.token, userId: created.userId, recoveryCode: created.recoveryCode });
        setReady(true);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Сервертэй холбогдож чадсангүй. Интернэтээ шалгаад дахин оролдоно уу.'
        );
      } finally {
        running.current = false;
      }
    })();
  }, [hydrated, token, attempt]);

  return { ready, error, retry: () => setAttempt((n) => n + 1) };
}
