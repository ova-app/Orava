import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Tabs } from 'expo-router'
import { Home, Plus, BookOpen, User } from 'lucide-react-native'
import { dark, spacing, radius } from '@/constants/theme'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 4,
        },
        tabBarActiveTintColor: dark.accent,
        tabBarInactiveTintColor: dark.textSecondary,
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => (
            <Home size={24} color={color} strokeWidth={1.5} />
          ),
        }}
      />

      <Tabs.Screen
        name="start"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={styles.fabContainer}>
              <Plus size={32} color={dark.background} strokeWidth={2.5} />
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
          title: 'Library',
          tabBarIcon: ({ color }) => (
            <BookOpen size={24} color={color} strokeWidth={1.5} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <User size={24} color={color} strokeWidth={1.5} />
          ),
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: dark.backgroundSecondary,
    borderTopColor: dark.separator,
    borderTopWidth: 1,
    height: 64,
    paddingBottom: spacing.s2,
  },
  fabContainer: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    backgroundColor: dark.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.s3,
    shadowColor: dark.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
})
