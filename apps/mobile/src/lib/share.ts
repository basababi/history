/**
 * Хуваалцах — вэб дээр Web Share API, утсан дээр системийн цонх
 *
 * Wordle-ийн өсөлтийн цорын ганц суваг нь хуваалцах товч байсан. Тиймээс
 * энэ файл ХЭЗЭЭ Ч эвдрэх ёсгүй: дэмжихгүй хөтөч дээр хуулах руу, хуулах
 * боломжгүй бол системийн цонх руу шат шатаар бууна.
 */
import { Linking, Platform, Share } from 'react-native';
import { getApiBaseUrl } from '@/api/client';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Хуваалцсан линкийн гарал — вэб дээр одоогийн сайт, утсан дээр тохиргоо */
export function webOrigin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  const configured = process.env.EXPO_PUBLIC_WEB_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // буруу тохиргоо — API-ийн гарлыг ашиглана
    }
  }
  try {
    return new URL(getApiBaseUrl()).origin;
  } catch {
    return 'https://ertniiov.mn';
  }
}

export const challengeUrl = (code: string) => `${webOrigin()}/c/${code}`;
export const groupUrl = (code: string) => `${webOrigin()}/g/${code}`;

/** Story-д зориулсан 1080×1920 зураг — API зурна */
export function storyImageUrl(code: string): string {
  const base = getApiBaseUrl() || webOrigin();
  return `${base}/api/og/challenge/${code}?format=story`;
}

interface WebNavigator {
  share?: (data: { title?: string; text?: string; url?: string; files?: File[] }) => Promise<void>;
  canShare?: (data: { files?: File[] }) => boolean;
  clipboard?: { writeText: (text: string) => Promise<void> };
}

function webNavigator(): WebNavigator | null {
  return typeof navigator !== 'undefined' ? (navigator as unknown as WebNavigator) : null;
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || /cancel/i.test(err.message));
}

/** Текст хуулах. Вэб дээр clipboard, утсан дээр системийн цонх */
export async function copyText(value: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const nav = webNavigator();
    try {
      if (nav?.clipboard) {
        await nav.clipboard.writeText(value);
        return true;
      }
    } catch {
      // HTTP (secure context биш) — доорх нөөц
    }
    try {
      const el = document.createElement('textarea');
      el.value = value;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
  try {
    await Share.share({ message: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Линк хуваалцах.
 *   вэб: Web Share (Messenger, Instagram, Telegram жагсаалт гарна) → хуулах
 *   утас: системийн хуваалцах цонх
 */
export async function shareLink(input: { title: string; text: string; url: string }): Promise<ShareOutcome> {
  const full = `${input.text}`.includes(input.url) ? input.text : `${input.text}\n${input.url}`;

  if (Platform.OS === 'web') {
    const nav = webNavigator();
    if (nav?.share) {
      try {
        // Зарим апп (Messenger) `url`-ийг, зарим нь `text`-ийг авдаг — давхардуулахгүй
        await nav.share({ title: input.title, text: input.text.replace(input.url, '').trim(), url: input.url });
        return 'shared';
      } catch (err) {
        if (isAbort(err)) return 'cancelled';
      }
    }
    return (await copyText(full)) ? 'copied' : 'failed';
  }

  try {
    const res = await Share.share({ title: input.title, message: full, url: input.url });
    return res.action === Share.dismissedAction ? 'cancelled' : 'shared';
  } catch {
    return 'failed';
  }
}

/**
 * Story зургийг УРЬДЧИЛЖ татна (вэб, файл хуваалцах боломжтой хөтөч дээр л).
 *
 * ⚠ ЯАГААД: хөтөч `navigator.share`-ийг зөвхөн дарсан АГШИНД зөвшөөрдөг.
 *   Дарсны дараа зураг татахыг хүлээвэл Safari «NotAllowedError» өгнө.
 *   Тиймээс дүнгийн дэлгэц нээгдэхэд зургийг бэлдэж, дарахад шууд илгээнэ.
 */
export async function prepareStoryFile(code: string): Promise<File | null> {
  if (Platform.OS !== 'web') return null;
  const nav = webNavigator();
  if (!nav?.share || !nav.canShare) return null;
  try {
    const res = await fetch(storyImageUrl(code));
    if (!res.ok) return null;
    const file = new File([await res.blob()], `ertniiov-${code}.png`, { type: 'image/png' });
    return nav.canShare({ files: [file] }) ? file : null;
  } catch {
    return null;
  }
}

/**
 * Story зураг хуваалцах (Instagram/Facebook story).
 *   вэб: бэлдсэн файлыг Web Share-ээр → дэмжихгүй бол шинэ табд нээнэ
 *   утас: кэшд татаж системийн цонхоор
 */
export async function shareStoryImage(
  code: string,
  prepared: File | null = null
): Promise<'shared' | 'opened' | 'cancelled' | 'failed'> {
  const url = storyImageUrl(code);

  if (Platform.OS === 'web') {
    const nav = webNavigator();
    if (prepared && nav?.share) {
      try {
        await nav.share({ files: [prepared], title: 'Эртний Өв' });
        return 'shared';
      } catch (err) {
        if (isAbort(err)) return 'cancelled';
      }
    }
    // Ширээний хөтөч — шинэ табд нээж, хадгалуулна
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener');
      return 'opened';
    }
    return 'failed';
  }

  try {
    const { File: FsFile, Paths } = await import('expo-file-system');
    const Sharing = await import('expo-sharing');
    const file = await FsFile.downloadFileAsync(url, Paths.cache, { idempotent: true });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: 'Эртний Өв' });
      return 'shared';
    }
  } catch {
    // доорх нөөц
  }
  try {
    await Linking.openURL(url);
    return 'opened';
  } catch {
    return 'failed';
  }
}
