/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./app/**/*.{js,ts,jsx,tsx}",
      "./src/**/*.{js,ts,jsx,tsx}"
    ],
    theme: {
      extend: {
        colors: {
          primary: {
            50: '#eff6ff',
            100: '#dbeafe',
            200: '#bfdbfe',
            300: '#93c5fd',
            400: '#60a5fa',
            500: '#3b82f6',
            600: '#2563eb',
            700: '#1d4ed8',
            800: '#1e40af',
            900: '#1e3a8a',
          },
          secondary: {
            50: '#ecfdf5',
            100: '#d1fae5',
            200: '#a7f3d0',
            300: '#6ee7b7',
            400: '#34d399',
            500: '#10b981',
            600: '#059669',
            700: '#047857',
            800: '#065f46',
            900: '#064e3b',
          },
          gray: {
            750: '#333a47',
            850: '#1a2030',
          },
        },
        fontFamily: {
          sans: ['Inter', 'system-ui', 'sans-serif'],
          mono: ['Fira Code', 'monospace'],
        },
        boxShadow: {
          'glow': '0 0 15px rgba(59, 130, 246, 0.5)',
          'glow-green': '0 0 15px rgba(16, 185, 129, 0.5)',
        },
        animation: {
          'bounce-slow': 'bounce 1.5s infinite',
        },
        height: {
          '128': '32rem',
        },
        maxHeight: {
          '128': '32rem',
        },
        minHeight: {
          '128': '32rem',
        },
      },
    },
    plugins: [],
  }
  