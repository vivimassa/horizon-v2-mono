module.exports = {
  extends: ['@skyhub/eslint-config'],
  env: { browser: true, node: true },
  globals: { __DEV__: 'readonly' },
  ignorePatterns: ['dist/', 'node_modules/', '*.config.js'],
}
