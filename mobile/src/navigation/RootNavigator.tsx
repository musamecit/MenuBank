import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { hasSeenOnboarding } from '../lib/onboarding';
import TabNavigator from './TabNavigator';
import OnboardingScreen from '../screens/OnboardingScreen';
import RestaurantDetailScreen from '../screens/RestaurantDetailScreen';
import SearchScreen from '../screens/SearchScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AuthScreen from '../screens/AuthScreen';
import UserListDetailScreen from '../screens/UserListDetailScreen';
import AddToListSearchScreen from '../screens/AddToListSearchScreen';
import NotFoundScreen from '../screens/NotFoundScreen';
import CityTrendScreen from '../screens/CityTrendScreen';
import OwnerDashboardScreen from '../screens/OwnerDashboardScreen';
import RestaurantSelectScreen from '../screens/RestaurantSelectScreen';
import AdminScreen from '../screens/AdminScreen';
import ListsExploreScreen from '../screens/ListsExploreScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import NotificationScreen from '../screens/NotificationScreen';
import CategoryListScreen from '../screens/CategoryListScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';

export type RootStackParamList = {
  Onboarding: undefined;
  Tabs: undefined;
  RestaurantDetail: { restaurantId: string };
  Search: undefined;
  Settings: undefined;
  Auth: undefined;
  UserListDetail: { listId: string; title: string; isUserList?: boolean };
  AddToListSearch: { listId: string };
  NotFound: undefined;
  CityTrend: { country: string; city: string };
  OwnerDashboard: { restaurantId: string };
  RestaurantSelect: undefined;
  Admin: undefined;
  ListsExplore: undefined;
  Favorites: { initialTab?: 'restaurants' | 'lists' };
  Notifications: undefined;
  CategoryList: { categorySlug: string; categoryName: string };
  BlockedUsers: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setShowOnboarding(false);
    }, 1500);
    hasSeenOnboarding()
      .then((seen) => {
        cancelled = true;
        setShowOnboarding(!seen);
      })
      .catch(() => {
        cancelled = true;
        setShowOnboarding(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  if (showOnboarding === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={showOnboarding ? 'Onboarding' : 'Tabs'}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        /* iOS: üst rota adı "Tabs" yerine Geri/Back etiketi */
        headerBackTitle: t('common.back'),
      }}
    >
      <Stack.Screen
        name="Onboarding"
        options={{ headerShown: false, gestureEnabled: false }}
      >
        {(props) => (
          <OnboardingScreen
            onDone={() => {
              setShowOnboarding(false);
              props.navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="RestaurantDetail" component={RestaurantDetailScreen} options={{ title: '', headerBackTitle: t('common.back') }} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: '', headerBackTitle: t('common.back') }} />
      <Stack.Screen name="Auth" component={AuthScreen} options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="UserListDetail" component={UserListDetailScreen} options={({ route }) => ({ title: route.params.title })} />
      <Stack.Screen name="AddToListSearch" component={AddToListSearchScreen} options={{ title: '' }} />
      <Stack.Screen name="NotFound" component={NotFoundScreen} options={{ title: '' }} />
      <Stack.Screen name="CityTrend" component={CityTrendScreen} options={{ title: '' }} />
      <Stack.Screen name="OwnerDashboard" component={OwnerDashboardScreen} options={{ title: '' }} />
      <Stack.Screen name="RestaurantSelect" component={RestaurantSelectScreen} options={{ title: t('profile.restaurantSelect') }} />
      <Stack.Screen
        name="Admin"
        component={AdminScreen}
        options={{ title: t('admin.title'), headerBackTitle: t('common.back') }}
      />
      <Stack.Screen name="ListsExplore" component={ListsExploreScreen} options={{ title: '' }} />
      <Stack.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ title: t('profile.myFavorites'), headerBackTitle: t('common.back') }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationScreen}
        options={{ title: t('settings.notifications'), headerBackTitle: t('common.back') }}
      />
      <Stack.Screen name="CategoryList" component={CategoryListScreen} options={({ route }) => ({ title: route.params.categoryName })} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ title: t('settings.blockedUsers', 'Engellenen Kullanıcılar') }} />
    </Stack.Navigator>
  );
}
