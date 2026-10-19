/**
 * Нэвтрэлт — токен байхгүй үед автоматаар авна.
 *
 * ⚠ Одоогоор хөгжүүлэлтийн нэвтрэлт (`/api/auth/dev-login`) ашиглана.
 * Auth.js OAuth (Google/Facebook) холбогдоход энэ hook-ийн интерфэйс
 * өөрчлөгдөхгүй — зөвхөн доторх дуудлага солигдоно.
 *
 * `deviceId` нь AsyncStorage-д хадгалагдана: апп дахин нээхэд ижил
 * хэрэглэгч рүү нэвтэрч, ахиц алдагдахгүй.
 */
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, configureApi, getApiBaseUrl } from '@/api/client';
import { devLogin } from '@/api/endpoints';
import { useGameStore } from '@/store/useGameStore';

const DEVICE_ID_KEY = 'nomad.deviceId';

function makeDeviceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getDeviceId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored) return stored;
    const fresh = makeDeviceId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
    return fresh;
  } catch {
    // Хадгалалт боломжгүй — сессийн хугацаанд ажиллах ID
    return makeDeviceId();
  }
}

export interface AuthState {
  ready: boolean;
  error: string | null;
  retry: () => void;
}

export function useAuth(): AuthState {
  const authToken = useGameStore((s) => s.authToken);
  const setAuthToken = useGameStore((s) => s.setAuthToken);
  const hydrated = useGameStore((s) => s.hydrated);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const running = useRef(false);

  useEffect(() => {
    if (!hydrated || running.current) return;

    // Токен аль хэдийн байвал шууд бэлэн
    if (authToken) {
      configureApi({ token: authToken });
      setReady(true);
      return;
    }

    running.current = true;
    setError(null);

    // Аль хаяг руу хандаж байгааг Metro консолд харуулна — буруу хаяг
    // бол энэ мөр шууд илчилнэ
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console -- оношилгооны зориудын гаралт
      console.log(`[api] хаяг: ${getApiBaseUrl()}`);
    }

    void (async () => {
      try {
        const deviceId = await getDeviceId();
        const res = await devLogin({ deviceId });
        configureApi({ token: res.token });
        setAuthToken(res.token);
        setReady(true);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Нэвтэрч чадсангүй. Сервер ажиллаж байгаа эсэхийг шалгана уу.'
        );
      } finally {
        running.current = false;
      }
    })();
  }, [hydrated, authToken, setAuthToken, attempt]);

  return {
    ready,
    error,
    retry: () => setAttempt((n) => n + 1),
  };
}
