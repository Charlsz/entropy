/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        entropy: {
          background: '#212121',
          text: '#F4F4FF',
          panel: '#262626',
          panelSoft: '#2B2B2B',
          border: 'rgba(244, 244, 255, 0.08)',
          borderStrong: 'rgba(244, 244, 255, 0.14)',
          muted: 'rgba(244, 244, 255, 0.7)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        subtle: '0 1px 0 rgba(244, 244, 255, 0.04)'
      }
    }
  },
  plugins: []
};