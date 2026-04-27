module.exports = {
  extends: ['@skyhub/eslint-config'],
  env: { browser: true, node: true },
  globals: { __DEV__: 'readonly' },
  ignorePatterns: ['.expo/', 'node_modules/', '*.config.js', '*.config.ts', 'nativewind-env.d.ts'],
}
