/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          100: '#F9EDD1',
          200: '#EEE2C7',
          300: '#EADEC4',
          400: '#DDD3B5',
        },
        ink: {
          100: '#6B6B6B',
          200: '#383B3D',
          300: '#1a1a1a',
        },
        golden: '#FFD165',
        silver: '#E0E0E0',
        bronze: '#E7C679',
      },
      backgroundImage: {
        'paper-pattern': "url('/bg.svg')",
      },
      fontFamily: {
        pacifico: ['Pacifico', 'cursive'],
        shadows: ['"Shadows Into Light Two"', 'cursive'],
        hand: ['"Patrick Hand"', 'cursive'],
      },
      animation: {
        'bounce-in': 'bounceIn 0.5s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
