// Déclarations de modules pour les assets statiques importés en ESM.
// Metro résout ces imports en référence d'asset (number) — typé ImageSourcePropType.
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native'
  const content: ImageSourcePropType
  export default content
}
