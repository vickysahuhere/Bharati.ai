/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        comic: {
          yellow: '#FFE600',
          pink: '#FF4B91',
          green: '#00E676',
          cyan: '#00D2FF',
          orange: '#FF7B00',
          purple: '#A855F7',
          dark: '#111827',
          cream: '#FFF9E6',
        },
        primary: {
          50: '#fefce8',
          100: '#fef9c3',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
        }
      },
      fontFamily: {
        bangers: ['"Bangers"', 'cursive', 'sans-serif'],
        comic: ['"Comic Neue"', 'cursive', 'sans-serif'],
        fredoka: ['"Fredoka"', 'sans-serif'],
        kalam: ['"Kalam"', 'cursive', 'sans-serif'],
      },
      boxShadow: {
        'comic': '4px 4px 0px #000000',
        'comic-sm': '2px 2px 0px #000000',
        'comic-md': '6px 6px 0px #000000',
        'comic-lg': '8px 8px 0px #000000',
        'comic-xl': '12px 12px 0px #000000',
      }
    },
  },
  plugins: [],
}
