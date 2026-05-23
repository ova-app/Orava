import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Circle, Path } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/context/ThemeContext'
import { spacing, typography } from '@/constants/theme'

// ─── Logo SVG ────────────────────────────────────────────────────────────────

function LogoOrava(): React.JSX.Element {
  return (
    <Svg width={80} height={80} viewBox="0 0 80 80">
      <Circle
        cx={40}
        cy={40}
        r={34}
        stroke="#FFDD00"
        strokeWidth={12}
        fill="none"
      />
      <Path
        d="M 40,17.6 L 58,61.4 A 28 28 0 0 1 22,61.4 Z"
        fill="#FFDD00"
      />
    </Svg>
  )
}

// ─── Arc de chargement ────────────────────────────────────────────────────────

function LoadingArc({ color, trackColor }: { color: string; trackColor: string }): React.JSX.Element {
  const rotation = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    anim.start()
    return () => anim.stop()
  }, [rotation])

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <View style={arcStyles.container}>
      {/* Track */}
      <View
        style={[
          arcStyles.track,
          { borderColor: trackColor },
        ]}
      />
      {/* Arc animé */}
      <Animated.View
        style={[
          arcStyles.arcWrap,
          { transform: [{ rotate: spin }] },
        ]}
      >
        <Svg width={120} height={120} viewBox="0 0 120 120">
          <Path
            d="M 60,4 A 56,56 0 0 1 116,60"
            stroke={color}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
    </View>
  )
}

const arcStyles = StyleSheet.create({
  container: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 2,
  },
  arcWrap: {
    position: 'absolute',
    width: 120,
    height: 120,
  },
})

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function SplashScreen(): React.JSX.Element {
  const { colors } = useTheme()
  const router = useRouter()

  // ─── Guard auth — logique préservée ───────────────────────────────────────

  useEffect(() => {
    async function checkSession(): Promise<void> {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        router.replace('/(tabs)')
      } else {
        router.replace('/auth/login')
      }
    }

    void checkSession()
  }, [router])

  const s = buildStyles(colors)

  return (
    <View style={s.root}>
      {/* Arc de chargement centré — contient le logo */}
      <View style={s.logoContainer}>
        <LoadingArc
          color={colors.accent}
          trackColor={colors.backgroundSecondary}
        />
        {/* Logo centré sur l'arc */}
        <View style={s.logoOverlay}>
          <LogoOrava />
        </View>
      </View>

      {/* Wordmark */}
      <Text style={s.wordmark}>ORAVA</Text>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function buildStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoContainer: {
      width: 120,
      height: 120,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoOverlay: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    wordmark: {
      ...typography.title,
      color: colors.textPrimary,
      letterSpacing: 6,
      marginTop: spacing.s4,
    },
  })
}
