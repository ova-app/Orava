import React, { useRef, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated'
import { spacing, typography, font } from '@/constants/theme'

interface Colors {
  accent: string
  textTertiary: string
  textSecondary: string
  background: string
  backgroundSecondary: string
}

interface RulerPickerProps {
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (value: number) => void
  colors: Colors
}

const ITEM_HEIGHT = 40
const VISIBLE_ITEMS = 6
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS

export default function RulerPicker({
  value,
  min,
  max,
  step,
  unit,
  onChange,
  colors,
}: RulerPickerProps) {
  const scrollViewRef = useRef<ScrollView>(null)
  const scrollOffset = useSharedValue(0)
  const screenWidth = Dimensions.get('window').width

  // Generate items array
  const items = useMemo(() => {
    const arr: number[] = []
    for (let i = min; i <= max; i += step) {
      arr.push(Math.round(i * 10) / 10) // Avoid floating point issues
    }
    return arr
  }, [min, max, step])

  // Find closest item to current value
  const selectedIndex = useMemo(() => {
    return items.findIndex(item => Math.abs(item - value) < step / 2)
  }, [items, value, step])

  // Snap to index on mount or value change
  useEffect(() => {
    if (selectedIndex !== -1 && scrollViewRef.current) {
      const offset = selectedIndex * ITEM_HEIGHT - (PICKER_HEIGHT / 2 - ITEM_HEIGHT / 2)
      scrollViewRef.current.scrollTo({ y: offset, animated: true })
    }
  }, [selectedIndex])

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y
    scrollOffset.value = offsetY

    // Snap to nearest item on scroll end
    const centerIndex = Math.round(offsetY / ITEM_HEIGHT)
    const snappedIndex = Math.max(0, Math.min(centerIndex, items.length - 1))
    const newValue = items[snappedIndex]
    if (newValue !== value) {
      onChange(newValue)
    }
  }

  const animatedValueStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollOffset.value,
      [-ITEM_HEIGHT, 0, ITEM_HEIGHT],
      [0.5, 1, 0.5],
      Extrapolate.CLAMP
    )
    return { opacity }
  })

  return (
    <View style={styles.container}>
      <View style={styles.main}>
        {/* Ruler/Scroll area */}
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          contentContainerStyle={{
            paddingVertical: PICKER_HEIGHT / 2,
          }}
          style={{ height: PICKER_HEIGHT }}
        >
          {items.map((item, idx) => (
            <View key={idx} style={{ height: ITEM_HEIGHT, justifyContent: 'center' }}>
              <Text style={[typography.body, { color: colors.textTertiary, fontSize: 13 }]}>
                {item.toFixed(step < 1 ? 1 : 0)}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Cursor highlight */}
        <View
          style={[
            styles.cursor,
            {
              borderColor: colors.accent,
              backgroundColor: `${colors.accent}08`,
            },
          ]}
        />
      </View>

      {/* Value display */}
      <View style={styles.valueContainer}>
        <Animated.Text
          style={[
            typography.display,
            {
              color: colors.accent,
              fontFamily: font.extraBold,
            },
            animatedValueStyle,
          ]}
        >
          {value.toFixed(step < 1 ? 1 : 0)}
        </Animated.Text>
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          {unit}
        </Text>
      </View>

      {/* Glow effect (iOS style) */}
      <View
        style={[
          styles.glow,
          {
            shadowColor: colors.accent,
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.s4,
  },
  main: {
    width: '100%',
    position: 'relative',
  },
  cursor: {
    position: 'absolute',
    top: PICKER_HEIGHT / 2 - ITEM_HEIGHT / 2,
    left: spacing.s5,
    right: spacing.s5,
    height: ITEM_HEIGHT,
    borderWidth: 1,
    borderRadius: 8,
    zIndex: 10,
  },
  valueContainer: {
    alignItems: 'center',
    gap: spacing.s1,
  },
  glow: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    top: PICKER_HEIGHT / 2 - 24,
    right: spacing.s5,
    zIndex: -1,
  },
})
