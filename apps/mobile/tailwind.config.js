const gluestackPlugin = require('@gluestack-ui/nativewind-utils/tailwind-plugin')

module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
    '../../packages/constants/src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: { extend: {} },
  plugins: [gluestackPlugin],
}
