module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'only-warn'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/ban-types': 'warn',
    '@typescript-eslint/no-empty-interface': 'warn',
    '@typescript-eslint/no-empty-function': 'warn',
    '@typescript-eslint/no-var-requires': 'warn',
    'no-empty': 'warn',
    'no-empty-pattern': 'warn',
    'no-useless-escape': 'warn',
    'no-prototype-builtins': 'warn',
    'no-case-declarations': 'warn',
    'no-undef': 'warn',
    'react/no-unescaped-entities': 'warn',
    'react/display-name': 'warn',
    'react/jsx-key': 'warn',
    'react/no-children-prop': 'warn',
    // NOTE: The following rules are set to "warn" (not "error") for the initial
    // rollout of linting. Existing code has many violations; tightening to "error"
    // is a follow-up task once the codebase is clean. See Sprint 1 in the
    // infrastructure hardening plan.
    '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'warn',
    'no-var': 'warn',
  },
  settings: {
    react: { version: 'detect' },
  },
  ignorePatterns: ['node_modules/', 'dist/', '.next/', '.expo/', '.turbo/', '*.config.js', '*.config.ts'],
}
