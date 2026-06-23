import { StyleSheet } from 'react-native'

/**
 * Primitives de layout partagées (ORA-093).
 * Sort les styles inline triviaux et répétés (`{ flex: 1 }`, rangées, centrage)
 * vers un StyleSheet unique → zéro `react-native/no-inline-styles`, rendu identique.
 * Pour un style spécifique à un écran, garder un StyleSheet local.
 */
export const L = StyleSheet.create({
  flex1: { flex: 1 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBaseline: { flexDirection: 'row', alignItems: 'baseline' },
  center: { justifyContent: 'center', alignItems: 'center' },
})
