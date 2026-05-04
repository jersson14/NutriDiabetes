/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta MINSA / ESSALUD
        primary: {
          50: '#E6F0FA',
          100: '#CCE1F5',
          200: '#99C3EB',
          300: '#66A5E0',
          400: '#3387D6',
          500: '#005BAC', // Azul salud principal
          600: '#00498A',
          700: '#003767',
          800: '#002445',
          900: '#001222',
        },
        secondary: {
          50: '#E6F7EE',
          100: '#CCEFDD',
          200: '#99DFBB',
          300: '#66CF99',
          400: '#33BF77',
          500: '#00A859', // Verde salud
          600: '#008647',
          700: '#006535',
          800: '#004323',
          900: '#002212',
        },
        background: '#F5F7FA',
        surface: '#FFFFFF',
        text: {
          primary: '#1A1A1A',
          secondary: '#6B7280',
          muted: '#9CA3AF',
        },
        danger: '#E53935',
        warning: '#FFB300',
        success: '#00A859',
        info: '#005BAC',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 4px 16px rgba(0, 91, 172, 0.15)',
        'float': '0 8px 32px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
}
