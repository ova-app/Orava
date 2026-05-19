import { Stack, useNavigationContainerRef } from 'expo-router'
import { PostHogProvider } from 'posthog-react-native'

export default function RootLayout() {
  const navigationRef = useNavigationContainerRef()

  return (
    <PostHogProvider
      apiKey={process.env.EXPO_PUBLIC_POSTHOG_KEY ?? ''}
      options={{ host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com' }}
      autocapture={{
        captureScreens: true,
        navigationRef,
      }}
    >
      <Stack screenOptions={{ headerShown: false }} />
    </PostHogProvider>
  )
}
