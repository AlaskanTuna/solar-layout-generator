/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        heading: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Work Sans', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        solar: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
          baseline: '#ea580c',
          green: '#16a34a',
          cumulative: '#ca8a04',
          cyan: '#22d3ee',
          amber: 'rgba(255, 184, 0, 0.35)',
          navy: '#1e1b4b'
        }
      },
      transitionDuration: {
        DEFAULT: '200ms'
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
