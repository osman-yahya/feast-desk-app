/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif']
      },
      colors: {
        brand: {
          DEFAULT: '#FF3131',
          hover: '#E02020',
          light: '#FF6B6B',
          pale: '#FFE8E8',
          glow: 'rgba(255,49,49,0.12)'
        },
        surface: {
          bg: '#FFFDF8',
          card: '#FFFFFF',
          dark: '#1C1917'
        },
        ink: {
          DEFAULT: '#1C1917',
          mid: '#44403C',
          muted: '#78716C'
        },
        border: {
          warm: '#E7E0D8'
        }
      },
      borderRadius: {
        card: '20px',
        pill: '9999px'
      },
      boxShadow: {
        card: '0 2px 16px rgba(0,0,0,0.07)',
        'card-hover': '0 4px 24px rgba(0,0,0,0.12)',
        dark: '0 2px 16px rgba(0,0,0,0.3)'
      }
    }
  },
  plugins: []
}
