import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import CrashScreen from './src/components/CrashScreen';
import RootNavigator from './src/navigation/RootNavigator';
import { trackActiveDate } from './src/lib/analytics';
import { registerPushToken, setupNotificationChannels } from './src/lib/notifications';
import { queryClient } from './src/lib/queryClient';
import { subscribeCrash } from './src/utils/crashHandler';
import { setupPurchases } from './src/lib/purchases';
import { initializeAds } from './src/lib/ads';
import './src/lib/i18n';

function AppContent() {
  const { isDark, colors } = useTheme();
  const { user } = useAuth();

  useEffect(() => {
    trackActiveDate();
  }, []);

  useEffect(() => {
    if (user) {
      registerPushToken(user.id).catch(() => {});
    }
  }, [user]);

  const navTheme = isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.background, card: colors.surface, text: colors.text, border: colors.border, primary: colors.accent } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, card: colors.surface, text: colors.text, border: colors.border, primary: colors.accent } };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const [globalError, setGlobalError] = useState<Error | null>(null);

  useEffect(() => {
    void initializeAds();
    setupPurchases(); // Initialize purchases
    void setupNotificationChannels();
    return subscribeCrash((err) => setGlobalError(err));
  }, []);

  if (globalError) {
    return (
      <SafeAreaProvider>
        <CrashScreen error={globalError} />
      </SafeAreaProvider>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
