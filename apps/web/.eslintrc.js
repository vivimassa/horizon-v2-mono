module.exports = {
  extends: ['@skyhub/eslint-config'],
  env: { browser: true, node: true },
  ignorePatterns: ['.next/', 'node_modules/', 'out/', '*.config.js', '*.config.ts', 'next-env.d.ts'],
}
