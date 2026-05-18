import { View, StyleSheet } from 'react-native'
import MyoOrb from './workout/myo-orb'

export default function Preview() {
  return (
    <View style={styles.root}>
      <MyoOrb />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080808',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
