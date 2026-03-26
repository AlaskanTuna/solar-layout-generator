/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        solar: {
          baseline: '#ea580c',
          green: '#16a34a',
          cumulative: '#ca8a04',
          cyan: '#22d3ee',
          amber: 'rgba(255, 184, 0, 0.35)',
          navy: '#1e1b4b'
        }
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
