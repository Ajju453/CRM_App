/** @type {import('tailwindcss').Config} */
// Balaji Group theme: red brand colours with maroon-tinted neutrals.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF7F5',
          100: '#FBE7E3',
          200: '#F5CBC4',
          300: '#EDA79C',
          400: '#E36F61',
          500: '#D7261E',
          600: '#B42318',
          700: '#8F1D16',
          800: '#6B1612',
          900: '#3D1A16',
        },
        // Neutrals remapped to warm maroon tints so existing slate-* classes follow the theme.
        slate: {
          50: '#FFF7F5',
          100: '#FBEFEC',
          200: '#F1D5CF',
          300: '#E3B8B0',
          400: '#C49891',
          500: '#8C6E69',
          600: '#6E5450',
          700: '#523D3A',
          800: '#3D2A27',
          900: '#2A1A17',
        },
      },
    },
  },
  plugins: [],
};
