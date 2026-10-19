/**
 * Эртний Өв · Өдрийн тав — орох цэг (вэб-д суурилсан, нэг код — вэб + апп)
 *
 * Давхарга: ErrorBoundary → QueryClient → SafeArea → Gate (сесс, фонт)
 *           → NavigationContainer (вэб URL холболттой) → таб + стек
 *
 * Бизнес логик БҮГД сервер дээр (Бүлэг 6.1). Клиент зөвхөн харуулна.
 */
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorState, Loading } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { useAppFonts } from '@/hooks/useAppFonts';
import { useGuestSession } from '@/hooks/useGuestSession';
import { buildLinking, SCREEN_TITLES, type AppStackParamList, type TabParamList } from '@/navigation/routes';
import { webOrigin } from '@/lib/share';
import { useSession } from '@/store/session';
import TodayScreen from '@/screens/TodayScreen';
import PlayScreen from '@/screens/PlayScreen';
import DayResultScreen from '@/screens/DayResultScreen';
import ChallengeScreen from '@/screens/ChallengeScreen';
import GroupsScreen from '@/screens/GroupsScreen';
import GroupDetailScreen from '@/screens/GroupDetailScreen';
import GroupJoinScreen from '@/screens/GroupJoinScreen';
import MeScreen from '@/screens/MeScreen';
import { colors, spacing } from '@/theme';

const Stack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, gcTime: 10 * 60_000 },
  },
});

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.bgCard,
    text: colors.text,
    primary: colors.primary,
    border: colors.border,
  },
};

const linking = buildLinking(
  Platform.OS === 'web' ? [webOrigin()] : ['ertniiov://', webOrigin()]
);

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <Icon
      name={name}
      size={24}
      color={focused ? colors.primary : colors.textMuted}
      strokeWidth={focused ? 2 : 1.7}
      filled={focused}
    />
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: 'rgba(221, 176, 88, 0.28)',
          borderTopWidth: 1.2,
          paddingTop: 6,
          height: Platform.OS === 'web' ? 62 : 66,
          paddingBottom: Platform.OS === 'web' ? 8 : spacing.sm,
        },
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3 },
      }}>
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{ title: 'Өнөөдөр', tabBarIcon: ({ focused }) => <TabIcon name="ger" focused={focused} /> }}
      />
      <Tab.Screen
        name="Groups"
        component={GroupsScreen}
        options={{ title: 'Бүлэг', tabBarIcon: ({ focused }) => <TabIcon name="users" focused={focused} /> }}
      />
      <Tab.Screen
        name="Me"
        component={MeScreen}
        options={{ title: 'Би', tabBarIcon: ({ focused }) => <TabIcon name="rider" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      {/* Тоглолтын үед ирмэгээс шудрах «буцах» нь санамсаргүй гаргана — хаалтын товчоор л */}
      <Stack.Screen name="Play" component={PlayScreen} options={{ gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="Result" component={DayResultScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Challenge" component={ChallengeScreen} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <Stack.Screen name="GroupJoin" component={GroupJoinScreen} />
    </Stack.Navigator>
  );
}

/** Сесс (зочин) ба фонт бэлэн болохоос өмнө дэлгэц харуулахгүй — 401-ийн урсгалаас сэргийлнэ */
function Gate() {
  const session = useGuestSession();
  const fonts = useAppFonts();

  if (session.error) {
    return (
      <View style={styles.gate}>
        <ErrorState
          icon="offline"
          title="Холбогдож чадсангүй"
          message={session.error}
          actionLabel="Дахин оролдох"
          onAction={session.retry}
        />
      </View>
    );
  }

  if (!session.ready || !fonts.ready) {
    return (
      <View style={styles.gate}>
        <Loading label="Ачаалж байна…" />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={navTheme}
      linking={linking}
      documentTitle={{
        formatter: (_options, route) => {
          const title = route?.name ? SCREEN_TITLES[route.name] : undefined;
          return title ? `${title} · Эртний Өв` : 'Эртний Өв · Өдрийн тав';
        },
      }}>
      <StatusBar style="light" />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const hydrated = useSession((s) => s.hydrated);

  if (!hydrated) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <Gate />
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
});
