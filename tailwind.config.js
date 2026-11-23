/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // "rose" = escala roxa da marca; "nude" = neutros lilás. (nomes mantidos para não quebrar as telas existentes)
        rose: { 50: '#f7f0fa', 100: '#eddcf4', 200: '#d9b9e8', 400: '#a35fbd', 500: '#7a3394', 600: '#5a2470', 700: '#481c5b' },
        nude: { 50: '#faf6f3', 100: '#f1e8f3', 200: '#e2d2e8', 700: '#6b4a7a', 900: '#3d1f4a' },
        ouro: { DEFAULT: '#c6a26b', 2: '#e7cf9f' },
        lilas: '#c8a2dc',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Jost', 'system-ui', 'sans-serif'],
        script: ['"Great Vibes"', 'cursive'],
      },
      boxShadow: {
        glass: '0 10px 30px -12px rgba(90,36,112,.28)',
        lift: '0 18px 40px -14px rgba(90,36,112,.4)',
      },
      keyframes: {
        fadeUp: { from: { opacity: 0, transform: 'translateY(18px)' }, to: { opacity: 1, transform: 'none' } },
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(40px) scale(.98)' }, to: { opacity: 1, transform: 'none' } },
        float: { '0%,100%': { transform: 'translateY(0) rotate(-3deg)' }, '50%': { transform: 'translateY(-8px) rotate(3deg)' } },
        twinkle: { '0%,100%': { opacity: 0.35, transform: 'scale(.9)' }, '50%': { opacity: 1, transform: 'scale(1.15)' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
        pop: { '0%': { transform: 'scale(0)' }, '70%': { transform: 'scale(1.15)' }, '100%': { transform: 'scale(1)' } },
        draw: { to: { strokeDashoffset: 0 } },
        sweep: { '0%': { transform: 'translateX(-120%) skewX(-20deg)' }, '60%,100%': { transform: 'translateX(220%) skewX(-20deg)' } },
        drift: { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '50%': { transform: 'translate(40px,30px) scale(1.12)' } },
        drift2: { '0%,100%': { transform: 'translate(0,0) scale(1.05)' }, '50%': { transform: 'translate(-50px,-20px) scale(.95)' } },
        slideX: { from: { opacity: 0, transform: 'translateX(36px)' }, to: { opacity: 1, transform: 'none' } },
        skeleton: { '0%,100%': { opacity: 0.55 }, '50%': { opacity: 1 } },
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgba(122,51,148,.45)' }, '100%': { boxShadow: '0 0 0 14px rgba(122,51,148,0)' } },
      },
      animation: {
        drift: 'drift 18s ease-in-out infinite', drift2: 'drift2 22s ease-in-out infinite', slideX: 'slideX .5s cubic-bezier(.2,.8,.2,1) both', skeleton: 'skeleton 1.4s ease-in-out infinite',
        fadeUp: 'fadeUp .7s cubic-bezier(.2,.7,.2,1) both', fadeIn: 'fadeIn .4s ease both', slideUp: 'slideUp .45s cubic-bezier(.2,.8,.2,1) both',
        float: 'float 5s ease-in-out infinite', twinkle: 'twinkle 3s ease-in-out infinite', shimmer: 'shimmer 4s linear infinite',
        pop: 'pop .5s cubic-bezier(.3,1.4,.5,1) both', draw: 'draw .6s .25s ease forwards', sweep: 'sweep 3.6s ease-in-out infinite', pulseRing: 'pulseRing 1.8s ease-out infinite',
      },
    },
  },
  plugins: [],
};
