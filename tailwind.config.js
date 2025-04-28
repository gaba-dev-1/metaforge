const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}', 
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        brown: '#26110D',
        'brown-light': '#3D231C',
        cream: '#F5EBD3',
        'cream-dark': '#E5D9BC',
        'gold': '#B68D40',
        'gold-light': '#D4B76A',
      },
      backgroundImage: { 
        'main-bg': "url('/assets/bg.jpg')"
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      zIndex: { 
        '60': '60', 
        '70': '70' 
      },
      minWidth: { 
        '24': '6rem' 
      },
      maxWidth: { 
        '28': '7rem', 
        '32': '8rem' 
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
  safelist: [
    'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'min-w-24',
    'animate-pulse', 'opacity-50', 'blur-sm',
    'touch-manipulation', 'touch-pan-y',
    'bg-brown', 'bg-brown-light', 'text-cream', 'text-gold',
    'border-gold', 'border-gold/30', 'border-gold/50'
  ]
}
