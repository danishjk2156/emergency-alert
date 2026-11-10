/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Fire-safety red + charcoal, tuned so white text on brand passes WCAG AA
        brand: { DEFAULT: '#D7191F', dark: '#B0141A', deep: '#8F1015', soft: '#FDECEC', ring: '#F7C4C6' },
        charcoal: { DEFAULT: '#2F2F2F', dark: '#232323', light: '#3D3D3D', line: '#4A4A4A' },
        ink: { DEFAULT: '#1C1C1C', 2: '#3A3A3A', 3: '#575757' },
        field: '#767676', // input border: 4.5:1 on white
        paper: '#F4F4F4',
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', '-apple-system', 'Segoe UI', 'Arial', 'sans-serif'],
        mono: ['"Roboto Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.06), 0 4px 14px -6px rgb(0 0 0 / 0.12)',
        lift: '0 2px 4px rgb(0 0 0 / 0.06), 0 14px 32px -12px rgb(0 0 0 / 0.25)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'none' } },
        'slide-down': { from: { opacity: '0', transform: 'translateY(-6px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in-right': { from: { opacity: '0', transform: 'translateX(24px)' }, to: { opacity: '1', transform: 'none' } },
        'grow-x': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
      },
      animation: {
        'fade-up': 'fade-up 0.55s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        'fade-in': 'fade-in 0.35s ease-out both',
        'scale-in': 'scale-in 0.22s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        'slide-down': 'slide-down 0.18s ease-out both',
        'slide-in-right': 'slide-in-right 0.3s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        'grow-x': 'grow-x 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) 0.15s both',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};
