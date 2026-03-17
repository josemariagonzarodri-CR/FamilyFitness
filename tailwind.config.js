/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        titanium: {
          900: '#0A1128',
          800: '#003F88',
          accent: '#00F2FE',
        },
        glass: 'rgba(255, 255, 255, 0.05)',
      }
    },
  },
  plugins: [],
}