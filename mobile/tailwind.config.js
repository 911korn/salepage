/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: NativeWind v4 requires Tailwind v3 (v4 PostCSS plugin not yet supported)
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Mirror src/app/globals.css :root brand palette
        bg: "#ffffff",
        fg: "#09090b",
        muted: "#71717a",
        soft: "#fafafa",
        border: "#e4e4e7",
        brand: {
          50: "#fff1f2",
          100: "#ffe4e6",
          200: "#fecdd3",
          300: "#fda4af",
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c",
          800: "#9f1239",
          900: "#881337",
        },
      },
      fontFamily: {
        // Loaded via expo-font in app/_layout.tsx (Kanit Thai+Latin)
        sans: ["Kanit", "system-ui"],
        display: ["Kanit", "system-ui"],
      },
    },
  },
  plugins: [],
};
