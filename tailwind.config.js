/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        pokemon: {
          normal: '#A8A77A',
          fire: '#EE8130',
          water: '#6390F0',
          electric: '#F7D02C',
          grass: '#7AC74C',
          ice: '#96D9D6',
          fighting: '#C22E28',
          poison: '#A33EA1',
          ground: '#E2BF65',
          flying: '#A98FF3',
          psychic: '#F95587',
          bug: '#A6B91A',
          rock: '#B6A136',
          ghost: '#735797',
          dragon: '#6F35FC',
          dark: '#705746',
          steel: '#B7B7CE',
          fairy: '#D685AD',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
