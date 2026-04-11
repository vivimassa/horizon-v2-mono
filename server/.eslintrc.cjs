module.exports = {
  extends: ['@skyhub/eslint-config'],
  env: { node: true },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'no-console': 'off',
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.config.js', '*.config.ts'],
}
