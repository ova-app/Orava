/**
 * ORAVA — Session 06
 * app/(tabs)/start.tsx
 * Placeholder du FAB central — jamais affiché directement
 */

import { Redirect } from 'expo-router'

export default function StartScreen() {
  return <Redirect href="/workout/session" />
}
