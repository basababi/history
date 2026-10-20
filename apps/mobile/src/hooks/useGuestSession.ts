/**
 * Сесс эхлүүлэх — бүртгүүлэхгүйгээр шууд тоглох
 *
 *   апп + токен бий  → шууд бэлэн (сүлжээгүй ч)
 *   бусад            → `POST /api/auth/session` НЭГ дуудлага; сервер
 *                      cookie → сэргээх код → шинэ зочин дарааллаар шийднэ
 *
 * Вэб дээр токен JS-д хадгалагдахгүй — cookie. Safari localStorage-ийг
 * цэвэрлэсэн ч cookie үлдэх тул хэрэглэгч ижил бүртгэлээрээ орно.
 *
 * Session хүчингүй болоход API клиент энэ hook-ийн өгсөн функцээр
 * ЧИМЭЭГҮЙ сэргээнэ — хэрэглэгч алдаа харахгүй.
 */
import { useEffect, useRef, useState } from 'react';
import { ApiError, COOKIE_AUTH, configureApi, setAuthRefresher } from '@/api/client';
import { restoreSession, startSession } from '@/api/game';
import { setHapticsEnabled } from '@/feedback';
import { useSession } from '@/store/session';

export interface SessionStatus {
  ready: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Сэргээх кодоор дахин нэвтрэх. Кодгүй бол false — дэлгэцийн дунд шинэ
 * зочин үүсгэж хэрэглэгчийг өөр бүртгэл рүү чимээгүй шилжүүлэхгүй.
 */
async function refreshSession(): Promise<boolean> {
  const { recoveryCode, setToken } = useSession.getState();
  if (!recoveryCode) return false;
  try {
    const res = await restoreSession(recoveryCode);
    if (!COOKIE_AUTH) {
      setToken(res.token);
      configureApi({ token: res.token });
    }
    return true;
  } catch {
    return false;
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
    setAuthRefresher(refreshSession);
    return () => setAuthRefresher(null);
  }, []);

  useEffect(() => {
    if (!hydrated || running.current || ready) return;

    if (!COOKIE_AUTH && token) {
      configureApi({ token });
      setReady(true);
      return;
    }

    running.current = true;
    setError(null);

    void (async () => {
      try {
        const { recoveryCode, setSession } = useSession.getState();
        const res = await startSession(recoveryCode);
        configureApi({ token: COOKIE_AUTH ? null : res.token });
        setSession({ token: res.token, userId: res.userId, recoveryCode: res.recoveryCode });
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
  }, [hydrated, token, attempt, ready]);

  return { ready, error, retry: () => setAttempt((n) => n + 1) };
}
