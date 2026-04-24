/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0A0A0F',
          surface: '#141419',
          hover: '#1E1E26',
        },
        gold: {
          DEFAULT: '#D4AF37',
          hover: '#C9A227',
          light: '#E8C84A',
          muted: 'rgba(212,175,55,0.12)',
          border: 'rgba(212,175,55,0.25)',
        },
        arc: {
          text: '#FFFFFF',
          secondary: '#9CA3AF',
          muted: '#6B7280',
          error: '#EF4444',
          success: '#22C55E',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 24px rgba(212,175,55,0.18)',
        'gold-sm': '0 0 12px rgba(212,175,55,0.12)',
        'gold-lg': '0 0 48px rgba(212,175,55,0.22)',
        'gold-inner': 'inset 0 1px 0 rgba(212,175,55,0.15)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)',
        'gold-subtle': 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.05) 100%)',
        'surface-gradient': 'linear-gradient(180deg, #141419 0%, #0A0A0F 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease forwards',
        'slide-up': 'slideUp 0.6s ease forwards',
        pulse: 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        slideUp: {
          from: { opacity: 0, transform: 'translateY(20px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
