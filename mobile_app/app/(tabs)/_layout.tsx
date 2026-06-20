import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Tabs } from 'expo-router'
import { Dumbbell, BookOpen, Zap } from 'lucide-react-native'
import { dark, radius } from '@/constants/theme'

// Ancre le groupe sur le feed — sinon le boot/reload dev peut ancrer sur `start`,
// dont le useEffect redirige aussitôt vers /workout/session (lancement de séance).
export const unstable_settings = { initialRouteName: 'feed' }

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: dark.accent,
        tabBarInactiveTintColor: dark.textSecondary,
        tabBarBackground: () => null,
        tabBarActiveBackgroundColor: 'transparent',
        tabBarInactiveBackgroundColor: 'transparent',
        tabBarItemStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: '',
          tabBarIcon: ({ color }) => (
            <View style={styles.sideIcon}>
              <Zap size={22} color={color} strokeWidth={1.5} />
            </View>
          ),
          tabBarLabel: () => null,
          tabBarItemStyle: {
            backgroundColor: 'transparent',
            alignItems: 'flex-end',
            paddingRight: 8,
          },
        }}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            const state = navigation.getState()
            const isOnFeed = state.routes[state.index]?.name === route.name
            if (isOnFeed) return
            e.preventDefault()
            navigation.navigate('feed')
          },
        })}
      />

      <Tabs.Screen
        name="start"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={styles.fab}>
              <Dumbbell size={26} color={dark.background} strokeWidth={2} />
            </View>
          ),
          tabBarLabel: () => null,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault()
            navigation.navigate('workout/session')
          },
        })}
      />

      <Tabs.Screen
        name="library"
        options={{
          title: '',
          tabBarIcon: ({ color }) => (
            <View style={styles.sideIcon}>
              <BookOpen size={22} color={color} strokeWidth={1.5} />
            </View>
          ),
          tabBarLabel: () => null,
          tabBarItemStyle: {
            backgroundColor: 'transparent',
            alignItems: 'flex-start',
            paddingLeft: 8,
          },
        }}
      />

      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 28,
    left: 32,
    right: 32,
    height: 68,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  sideIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: dark.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: dark.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 14,
  },
})
