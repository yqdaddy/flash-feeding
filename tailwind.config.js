/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFF9F0',
        creamdark: '#F6EDE1',
        ink: '#4A3F35',
        inksoft: '#7A6C5D',
        line: '#EFE4D6',
        brand: '#D2603A',
        branddark: '#B04E2C',
      },
    },
  },
  plugins: [],
};