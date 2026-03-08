import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { DistrictProvider } from '@/lib/DistrictContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  // Track whether the first mount has completed (so we don't redirect before
  // the navigator is ready).
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;

    // ── Listen to auth state changes ──────────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted.current) return;

        if (event === 'SIGNED_IN' && session) {
          // Redirect to main feed after a successful login
          const inAuthScreen = (segments as string[]).includes('auth');
          if (inAuthScreen) {
            router.replace('/(tabs)');
          }
        }
        // SIGNED_OUT → stay in tabs (guest mode is allowed)
      }
    );

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, [router, segments]);

  return (
    <DistrictProvider>
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)"        options={{ headerShown: false }} />
        <Stack.Screen name="auth"          options={{ headerShown: false }} />
        <Stack.Screen name="profile"       options={{ headerShown: false }} />
        <Stack.Screen name="search"        options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="user/[username]" options={{ headerShown: false }} />
        <Stack.Screen name="modal"         options={{ presentation: 'modal', title: 'Pencere' }} />
        <Stack.Screen name="create-post"   options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="create-story"  options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="post/[id]"     options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
    </DistrictProvider>
  );
}
