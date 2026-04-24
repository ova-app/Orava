/**
 * ORAVA — Session 06
 * app/workout/_layout.tsx
 */

import { Stack } from 'expo-router'

export default function WorkoutLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="session" />
      <Stack.Screen name="summary" />
      <Stack.Screen
        name="timer"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
    </Stack>
  )
}
