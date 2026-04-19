/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0a0a0b",
          900: "#111113",
          800: "#1a1a1d",
          700: "#27272a",
          600: "#3f3f46",
          500: "#71717a",
          400: "#a1a1aa",
          300: "#d4d4d8",
          100: "#fafafa",
        },
        heat: {
          0: "#1a1a1d",
          1: "#14432a",
          2: "#1d6b3b",
          3: "#2ea043",
          4: "#56d364",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
