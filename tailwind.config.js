/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#829ab1',
          400: '#627d98',
          500: '#486581',
          600: '#334e68',
          700: '#243b53',
          800: '#102a43',
          900: '#0a2540',
        },
        deadline: {
          warning: '#d97706',
          'warning-bg': '#fffbeb',
          urgent: '#dc2626',
          'urgent-bg': '#fef2f2',
          safe: '#059669',
          'safe-bg': '#ecfdf5',
        },
      },
    },
  },
  plugins: [],
}
