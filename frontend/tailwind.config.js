/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#0A0E14",
        panel: "#121821",
        raised: "#1B2330",
        hairline: "#26303F",
        ink: "#E8EDF4",
        "ink-dim": "#8D9BB0",
        cyan: { DEFAULT: "#2DD9C8", dim: "#1B8377" },
        amber: { DEFAULT: "#F2A93B", dim: "#8A5F1D" },
        red: { DEFAULT: "#FF5D5D", dim: "#8A2E2E" },
        blue: { DEFAULT: "#4E8FFF", dim: "#2A4E8F" },
        green: { DEFAULT: "#3DDC84", dim: "#1E7A46" },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px -6px rgba(45, 217, 200, 0.45)",
      },
      keyframes: {
        sweep: { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } },
        pulseDot: { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.35 } },
        ticker: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        fadeIn: { "0%": { opacity: "0", transform: "translateY(-6px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        sweep: "sweep 3s linear infinite",
        pulseDot: "pulseDot 1.6s ease-in-out infinite",
        ticker: "ticker 40s linear infinite",
      },
    },
  },
  plugins: [],
}
