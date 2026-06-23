module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-native', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'react-native/no-unused-styles': 'off',
    'react-native/no-inline-styles': 'warn',
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'warn',
    'no-empty': 'warn',
    // Les boucles `while (true) { … break }` (adapter SecureStore par chunks) sont légitimes.
    'no-constant-condition': ['warn', { checkLoops: false }],
  },
  env: {
    'react-native/react-native': true,
  },
  overrides: [
    {
      // Outillage hors app (config Jest, scripts Node) — pas de typage RN strict
      files: ['jest.setup.js', 'scripts/**/*.js', '*.config.js', '.eslintrc.js'],
      env: { node: true, jest: true },
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
        'no-undef': 'off',
      },
    },
  ],
  ignorePatterns: ['node_modules/', '.expo/', 'dist/'],
}
