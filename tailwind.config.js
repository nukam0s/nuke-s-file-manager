/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#1e1e1e',
        panelAlt: '#252526',
        panelHi: '#2d2d30',
      },
    },
  },
  plugins: [],
}
