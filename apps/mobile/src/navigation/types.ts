/**
 * Навигацийн төрлүүд — дэлгэц хоорондын параметрийн гэрээ
 */
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { QuizMode } from '@nomad/contracts';

export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: undefined;
  Quiz: { mode?: QuizMode; eraId?: number } | undefined;
  Result: {
    token: string | null;
    offline: boolean;
    localXp: number;
    localCorrect: number;
    total: number;
  };
  Mentor: undefined;
  VoiceBattle: undefined;
  Battle: undefined;
  Paywall: undefined;
  Contribution: undefined;
  Classroom: undefined;
  Story: undefined;
  /** «Миний гэр»-ийн бодит цагийн 3D харагдац — тойрон харах, дотор орох */
  Ger3D: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- React Navigation-ий албан ёсны бичлэг
    interface RootParamList extends RootStackParamList {}
  }
}
