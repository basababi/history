/**
 * «Өдрийн тав»-ын навигаци — дэлгэц бүр вэб URL-тэй
 *
 *   /             Өнөөдөр (таб)
 *   /groups       Найзын бүлгүүд (таб)
 *   /me           Би (таб)
 *   /play/:day    Тоглох
 *   /result/:day  Дүн
 *   /c/:code      Найзын сорилт      ← Messenger-ээр ирэх линк
 *   /groups/:id   Бүлгийн самбар
 *   /g/:code      Бүлгийн урилга     ← Messenger-ээр ирэх линк
 *
 * Линкээр шууд орж ирсэн ч доор нь «Өнөөдөр» таб байна (`initialRouteName`)
 * — «буцах» дарахад хоосон дэлгэц биш нүүр рүү очно.
 */
import type { LinkingOptions, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

export type TabParamList = {
  Today: undefined;
  Groups: undefined;
  Me: undefined;
};

export type AppStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Play: { dayKey: string; challengeCode?: string };
  Result: { dayKey: string };
  Challenge: { code: string };
  GroupDetail: { id: number };
  GroupJoin: { code: string };
};

export type AppScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<AppStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<AppStackParamList>
>;

export function buildLinking(prefixes: string[]): LinkingOptions<AppStackParamList> {
  return {
    prefixes,
    config: {
      initialRouteName: 'Tabs',
      screens: {
        Tabs: {
          screens: {
            Today: '',
            Groups: 'groups',
            Me: 'me',
          },
        },
        Play: 'play/:dayKey',
        Result: 'result/:dayKey',
        Challenge: 'c/:code',
        GroupDetail: {
          path: 'groups/:id',
          parse: { id: (v: string) => Number(v) },
          stringify: { id: (v: number) => String(v) },
        },
        GroupJoin: 'g/:code',
      },
    },
  };
}

/** Хөтчийн табын гарчиг */
export const SCREEN_TITLES: Record<string, string> = {
  Today: 'Өдрийн тав',
  Groups: 'Найзын бүлэг',
  Me: 'Би',
  Play: 'Тоглож байна',
  Result: 'Дүн',
  Challenge: 'Сорилт',
  GroupDetail: 'Бүлэг',
  GroupJoin: 'Бүлэгт нэгдэх',
};
