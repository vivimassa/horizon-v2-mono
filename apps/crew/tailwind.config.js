/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        accent: '#1e40af',
        'accent-on': '#FFFFFF',
        page: { light: '#FAFAFC', dark: '#0E0E14' },
        card: { light: '#FFFFFF', dark: '#191921' },
      },
    },
  },
  plugins: [],
}
