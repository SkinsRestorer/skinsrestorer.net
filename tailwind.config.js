/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './assets/**/*.{css}',
    './theme.config.tsx'
  ],
  theme: {
    extend: {}
  },
  plugins: [],
  darkMode: 'class'
}
