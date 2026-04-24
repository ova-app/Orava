/**
 * ORAVA — Session 06
 * app/(tabs)/_layout.tsx
 * Navigation tabs + FAB orange centré
 */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Tabs, router } from 'expo-router'
import { useWorkout } from '../../context/WorkoutContext'

// ─── FAB ─────────────────────────────────────────────────────────────────────

function FABButton() {
  const workout = useWorkout()

  function handlePress() {
    if (workout.status === 'active') {
      // Reprendre la séance en cours
      router.push('/workout/session')
    } else {
      router.push('/workout/session')
    }
  }

  return (
    <TouchableOpacity style={styles.fabWrapper} onPress={handlePress} activeOpacity={0.85}>
      <View style={styles.fab}>
        <Text style={styles.fabIcon}>+</Text>
        {workout.status === 'active' && <View style={styles.activeDot} />}
      </View>
    </TouchableOpacity>
  )
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#D85A30',
        tabBarInactiveTintColor: '#666',
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarLabel: 'Feed',
          tabBarIcon: ({ color }) => <TabIcon label="◎" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historique',
          tabBarLabel: 'Historique',
          tabBarIcon: ({ color }) => <TabIcon label="◷" color={color} />,
        }}
      />
      <Tabs.Screen
        name="start"
        options={{
          title: '',
          tabBarLabel: () => null,
          tabBarButton: () => <FABButton />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Bibliothèque',
          tabBarLabel: 'Biblio.',
          tabBarIcon: ({ color }) => <TabIcon label="☰" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color }) => <TabIcon label="◯" color={color} />,
        }}
      />
    </Tabs>
  )
}

function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={{ color, fontSize: 18 }}>{label}</Text>
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0F0F0F',
    borderTopColor: '#1C1C1C',
    height: 80,
    paddingBottom: 16,
  },
  tabLabel: {
    fontSize: 10,
  },
  fabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#D85A30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D85A30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '300',
    lineHeight: 34,
    marginTop: -2,
  },
  activeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FAC775',
    borderWidth: 2,
    borderColor: '#0F0F0F',
  },
})
