module.exports = {
  content: [
    './views/**/*.ejs',
    './public/js/**/*.js'
  ],
  theme: {
    extend: {
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
        'cinzel': ['Cinzel', 'serif']
      },
      colors: {
        'accent': 'var(--accent-color)',
        'accent-hover': 'var(--accent-color-hover)',
        'accent-light': 'var(--accent-color-light)',
        'accent-dark': 'var(--accent-color-dark)',
      }
    }
  },
  plugins: []
}