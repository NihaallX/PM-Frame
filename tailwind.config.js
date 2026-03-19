/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        swiss: {
          red: "#E41E26",
          black: "#0A0A0A",
          paper: "#F4F1EA",
          cloud: "#E6E1D7",
        },
      },
      fontFamily: {
        sans: ["Space Grotesk", "Avenir Next", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["IBM Plex Mono", "Menlo", "Consolas", "monospace"],
      },
      letterSpacing: {
        tighterest: "-0.08em",
      },
      boxShadow: {
        panel: "10px 10px 0 0 #0A0A0A",
        soft: "6px 6px 0 0 #E41E26",
      },
    },
  },
  plugins: [],
}
