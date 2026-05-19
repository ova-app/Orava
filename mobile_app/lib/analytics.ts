import PostHog from 'posthog-react-native'

export const posthog = new PostHog(process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '', {
  host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
})

export const Events = {
  // App lifecycle
  APP_OPENED: 'app_opened',
  ONBOARDING_COMPLETED: 'onboarding_completed',

  // Session
  SESSION_STARTED: 'session_started',
  SESSION_COMPLETED: 'session_completed',
  SESSION_DISCARDED: 'session_discarded',
  EXERCISE_ADDED: 'exercise_added',
  SET_LOGGED: 'set_logged',

  // PRs
  PR_ACHIEVED: 'pr_achieved',

  // Myo
  MYO_VIEWED: 'myo_viewed',
  MYO_SECTOR_TAPPED: 'myo_sector_tapped',

  // Summary
  SUMMARY_VIEWED: 'summary_viewed',
  WORKOUT_SHARED: 'workout_shared',
  WORKOUT_SAVED: 'workout_saved',

  // Ghost
  GHOST_BEATEN: 'ghost_beaten',

  // Social
  WORKOUT_LIKED: 'workout_liked',
  FEED_SCROLLED: 'feed_scrolled',

  // Navigation
  HISTORY_VIEWED: 'history_viewed',
  PROFILE_VIEWED: 'profile_viewed',
  LIBRARY_SEARCHED: 'library_searched',
  EXERCISE_VIEWED: 'exercise_viewed',

  // Monetisation
  PAYWALL_SHOWN: 'paywall_shown',
  PAYWALL_CONVERTED: 'paywall_converted',
} as const

export type EventName = (typeof Events)[keyof typeof Events]
