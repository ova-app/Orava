import { Stack, useNavigationContainerRef } from 'expo-router'
import { PostHogProvider } from 'posthog-react-native'
import * as SplashScreen from 'expo-splash-screen'
import { Component, useEffect, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { hydrateStorage } from '@/lib/storage'
import { initDB, backfillLocalFromSupabase } from '@/lib/db'
import { ThemeProvider } from '@/context/ThemeContext'
import { WorkoutProvider } from '@/context/WorkoutContext'
import { dark, radius, spacing, typography } from '@/constants/theme'
import { useFonts } from 'expo-font'
import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_700Bold,
  Barlow_800ExtraBold,
  Barlow_900Black,
} from '@expo-google-fonts/barlow'
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed'
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono'

SplashScreen.preventAutoHideAsync()

// ─── Error Boundary racine ─────────────────────────────────────────────────────
// Au-dessus de ThemeProvider → palette statique `dark` (app dark-only Phases 0-2).
// Capture toute exception de rendu (cast faux, WebGL…) → écran de repli au lieu
// d'un écran blanc muet. Log console (pas de Sentry à ce stade).
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <View style={ebStyles.container}>
        <Text style={ebStyles.title}>Une erreur est survenue</Text>
        <Text style={ebStyles.body}>
          L&apos;app a rencontré un problème inattendu. Tes données enregistrées sont intactes.
        </Text>
        <Pressable
          style={ebStyles.button}
          onPress={() => this.setState({ hasError: false })}
          accessibilityRole="button"
          accessibilityLabel="Réessayer"
        >
          <Text style={ebStyles.buttonLabel}>Réessayer</Text>
        </Pressable>
      </View>
    )
  }
}

const ebStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.s8,
    gap: spacing.s5,
  },
  title: { ...typography.title, color: dark.textPrimary, textAlign: 'center' },
  body: { ...typography.body, color: dark.textSecondary, textAlign: 'center' },
  button: {
    marginTop: spacing.s4,
    paddingVertical: spacing.s4,
    paddingHorizontal: spacing.s8,
    borderRadius: radius.full,
    backgroundColor: dark.accent,
  },
  buttonLabel: { ...typography.subtitle, color: dark.background },
})

export default function RootLayout() {
  const navigationRef = useNavigationContainerRef()

  const [fontsLoaded, fontError] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_700Bold,
    Barlow_800ExtraBold,
    Barlow_900Black,
    BarlowCondensed_700Bold,
    JetBrainsMono_500Medium,
  })

  const [hydrated, setHydrated] = useState(false)

  // ORA-006 — hydrater le cache storage AVANT de monter WorkoutProvider (await),
  // sinon la réhydratation du draft lit un cache vide → crash-safe factice.
  useEffect(() => {
    void (async () => {
      try {
        await hydrateStorage()
        await initDB()
        void backfillLocalFromSupabase() // ORA-024 — réamorce SQLite si vide (non bloquant)
      } catch (e) {
        console.error('[_layout] init', e)
      } finally {
        setHydrated(true)
      }
    })()
  }, [])

  useEffect(() => {
    if ((fontsLoaded || fontError) && hydrated) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, fontError, hydrated])

  if ((!fontsLoaded && !fontError) || !hydrated) return null

  return (
    <ErrorBoundary>
      <PostHogProvider
        apiKey={process.env.EXPO_PUBLIC_POSTHOG_KEY ?? ''}
        options={{ host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com' }}
        autocapture={{
          captureScreens: true,
          navigationRef,
        }}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ThemeProvider>
            <WorkoutProvider>
              <Stack
                screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0F' } }}
              >
                <Stack.Screen
                  name="workout/session"
                  options={{ animation: 'none', gestureEnabled: false }}
                />
                <Stack.Screen
                  name="workout/timer"
                  options={{ animation: 'none', gestureEnabled: false }}
                />
              </Stack>
            </WorkoutProvider>
          </ThemeProvider>
        </GestureHandlerRootView>
      </PostHogProvider>
    </ErrorBoundary>
  )
}
