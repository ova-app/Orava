// Mock global AsyncStorage — lib/storage.ts l'importe au top-level et il est tiré
// transitivement par WorkoutContext (réhydratation draft ORA-006). Sans ce mock, tout
// test chargeant ces modules échouait au require du module natif.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

// Stub minimal expo-sqlite — db.ts est tiré transitivement par WorkoutContext.
// Les suites qui testent réellement db.ts (db.test.ts) déclarent leur propre jest.mock
// qui prime sur celui-ci dans leur fichier.
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockResolvedValue({
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({}),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
    withTransactionAsync: jest.fn(async (cb) => { await cb() }),
  }),
}))
