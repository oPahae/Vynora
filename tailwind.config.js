// Design system "Papier" : plat, sans degrade.
// Idee : la clarte d'une eau calme. Une seule couleur d'action (le "lagon", un bleu-vert
// profond et apaisant), une chaleur peche reservee a la presence (stories, en ligne,
// nouveautes) et un rose corail reserve aux emotions et aux alertes. Les neutres sont
// legerement teintes bleu-vert pour un confort de lecture maximal.
// Les neutres (slate), les teintes de marque claires et les surfaces sont pilotes par
// des variables CSS (voir styles/globals.css) : le mode sombre est donc gere par les
// memes classes utilitaires, sans surcharge dark: dans les composants.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}'
  ],
  theme: {
    screens: {
      'max-xs': { max: '419px' },
      xs: '420px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px'
    },
    extend: {
      colors: {
        // "cobalt" : bleu net. 500 (fixe) porte le texte blanc des boutons ; 600/700 suivent le theme pour le texte.
        brand: {
          50: v('brand-50'), 100: v('brand-100'), 200: v('brand-200'), 300: '#8FA9F7', 400: '#5F82F0',
          500: '#3D63E8', 600: v('brand-600'), 700: v('brand-700'), 800: '#233A9A', 900: '#19296F'
        },
        // "coral" : emotions, alertes, suppression. (nom historique conserve : ember)
        ember: {
          50: '#FFF1F3', 100: '#FFE0E5', 200: '#FFC2CC', 300: '#FF9AAA', 400: '#FF7489',
          500: '#EF4F6B', 600: '#CC2F4A', 700: '#A3243A', 800: '#7E1C2D', 900: '#5E1522'
        },
        // "lumen" : la chaleur douce (peche / ambre). Presence, stories, nouveautes.
        lumen: {
          50: '#FFF8EB', 100: '#FFEFCC', 200: '#FFDF99', 300: '#FFCC66', 400: '#FFB547',
          500: '#F59E0B', 600: '#C77A06', 700: '#975A06'
        },
        slate: {
          50: v('slate-50'), 100: v('slate-100'), 200: v('slate-200'), 300: v('slate-300'),
          400: v('slate-400'), 500: v('slate-500'), 600: v('slate-600'), 700: v('slate-700'),
          800: v('slate-800'), 900: v('slate-900')
        },
        ink: '#050B10',
        surface: {
          DEFAULT: v('surface'),
          raised: v('surface-raised'),
          muted: v('canvas'),
          light: '#FFFFFF',
          dark: '#0D151C',
          darkMuted: '#070C11'
        }
      },
      fontFamily: {
        sans: ['Geist', 'Inter', '"Noto Sans Arabic"', 'system-ui', '"Hiragino Sans"', '"Noto Sans JP"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Geist', '"Noto Sans Arabic"', 'system-ui', '"Hiragino Sans"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif']
      },
      boxShadow: {
        // Design plat : des ombres rares et tres discretes.
        soft: '0 1px 2px rgb(var(--shadow) / 0.06)',
        card: '0 1px 3px rgb(var(--shadow) / 0.08)',
        pop: '0 0 0 1px rgb(var(--slate-200)), 0 24px 56px -16px rgb(var(--shadow) / 0.32)',
        glow: '0 1px 2px rgb(var(--shadow) / 0.12)',
        emberGlow: '0 1px 2px rgb(var(--shadow) / 0.12)',
        lumenGlow: '0 0 0 2px rgb(245 158 11 / 0.35)',
        ring: '0 0 0 4px rgb(61 99 232 / 0.16)'
      },
      borderRadius: { xl2: '0.875rem', xl3: '1.25rem', xl4: '1.75rem' },
      transitionTimingFunction: { 'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)', 'spring-soft': 'cubic-bezier(0.34, 1.4, 0.5, 1)' },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': { from: { opacity: '0', transform: 'scale(.95) translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        'ring-spin': { to: { transform: 'rotate(360deg)' } },
        'bell-ring': { '0%,100%': { transform: 'rotate(0)' }, '15%': { transform: 'rotate(14deg)' }, '30%': { transform: 'rotate(-12deg)' }, '45%': { transform: 'rotate(8deg)' }, '60%': { transform: 'rotate(-5deg)' }, '75%': { transform: 'rotate(2deg)' } },
        'pop-heart': { '0%': { transform: 'scale(.6)' }, '45%': { transform: 'scale(1.3)' }, '70%': { transform: 'scale(.94)' }, '100%': { transform: 'scale(1)' } },
        'badge-pop': { '0%': { transform: 'scale(0)' }, '60%': { transform: 'scale(1.25)' }, '100%': { transform: 'scale(1)' } },
        'drift-a': { '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' }, '50%': { transform: 'translate3d(6vw,4vh,0) scale(1.12)' } },
        'drift-b': { '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' }, '50%': { transform: 'translate3d(-7vw,-5vh,0) scale(1.08)' } },
        'drift-c': { '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' }, '50%': { transform: 'translate3d(-4vw,6vh,0) scale(0.92)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        'pulse-ring': { '0%': { transform: 'scale(.9)', opacity: '.7' }, '100%': { transform: 'scale(1.9)', opacity: '0' } }
      },
      animation: {
        shimmer: 'shimmer 1.8s linear infinite',
        'fade-in': 'fade-in .25s ease-out both',
        'pop-in': 'pop-in .28s cubic-bezier(0.16,1,0.3,1) both',
        'sheet-up': 'sheet-up .36s cubic-bezier(0.16,1,0.3,1) both',
        'ring-spin': 'ring-spin 6s linear infinite',
        'pop-heart': 'pop-heart .5s cubic-bezier(0.34,1.4,0.5,1) both',
        'badge-pop': 'badge-pop .35s cubic-bezier(0.34,1.56,0.5,1) both',
        'drift-a': 'drift-a 34s ease-in-out infinite',
        'drift-b': 'drift-b 42s ease-in-out infinite',
        'drift-c': 'drift-c 50s ease-in-out infinite',
        float: 'float 7s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2.2s cubic-bezier(0.16,1,0.3,1) infinite'
      }
    }
  },
  darkMode: 'class',
  plugins: []
};
