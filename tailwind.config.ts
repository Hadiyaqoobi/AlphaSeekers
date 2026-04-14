import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter Variable", "Inter", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Outfit", "Inter", "-apple-system", "sans-serif"],
        arabic: [
          "Noto Sans Arabic",
          "Noto Naskh Arabic",
          "Tahoma",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        background: "var(--bg-base)",
        foreground: "var(--ink-main)",
        brand: {
          50: "#F0FAF7",
          100: "#E8F5F1",
          200: "#B2DFDB",
          300: "#6DB8B0",
          400: "#2E9E93",
          500: "#0E7C6B",
          600: "#0A5F53",
          700: "#084A42",
          800: "#063833",
          900: "#042824",
          DEFAULT: "#0E7C6B",
        },
        accent: {
          50: "#FFF9F0",
          100: "#FFF5EB",
          200: "#FFE4C8",
          300: "#F2C49A",
          400: "#E8985A",
          500: "#D4854A",
          600: "#C0733D",
          700: "#9A5E32",
          800: "#7C4B28",
          900: "#5E381A",
          DEFAULT: "#E8985A",
        },
        highlight: {
          50: "#F5F3FF",
          100: "#F0EDF8",
          200: "#DDD6FE",
          300: "#B4A5D4",
          400: "#9686C0",
          500: "#7B61C4",
          600: "#6558A0",
          700: "#504388",
          800: "#3D3270",
          900: "#2A2258",
          DEFAULT: "#7B61C4",
        },
        ink: {
          main: "#1A2332",
          soft: "#5A6A7E",
          faint: "#94A3B8",
        },
        surface: {
          base: "#FAFAF7",
          strong: "#F5F3EF",
          warm: "#FFF5EB",
        },
        line: {
          DEFAULT: "#E5DFD6",
          soft: "#F0EBE3",
        },
        // Landing page cinematic palette
        land: {
          green: {
            50:  '#EDFDF5',
            100: '#D3F9E5',
            200: '#A7F3CC',
            300: '#6DE8A8',
            400: '#34D07E',
            500: '#1DB964',
            600: '#14A756',
            700: '#0E8A45',
            800: '#0A6B36',
            900: '#064D27',
            950: '#032B16',
          },
          dark: {
            DEFAULT: '#0A0F0D',
            50:  '#0D1410',
            100: '#111A15',
            200: '#15211B',
            300: '#1A2B23',
            400: '#1F362C',
          },
          amber: {
            DEFAULT: '#E8913A',
            light:  '#F5B870',
            dark:   '#C4721E',
          },
          cream:  '#F8F6F0',
          sage:   '#E8EDE9',
        },
      },
      letterSpacing: {
        tighter: "-0.04em",
        tight: "-0.02em",
        normal: "0",
        wide: "0.02em",
        wider: "0.06em",
        widest: "0.1em",
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "26": "6.5rem",
        "30": "7.5rem",
        "34": "8.5rem",
        "38": "9.5rem",
      },
      maxWidth: {
        container: "1400px",
      },
      borderRadius: {
        panel: "1rem",
        btn: "0.75rem",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(26, 35, 50, 0.03)",
        soft: "0 1px 3px rgba(26, 35, 50, 0.04), 0 1px 2px rgba(26, 35, 50, 0.02)",
        mid: "0 4px 12px rgba(26, 35, 50, 0.06), 0 1px 3px rgba(26, 35, 50, 0.03)",
        deep: "0 8px 28px rgba(26, 35, 50, 0.08), 0 2px 6px rgba(26, 35, 50, 0.03)",
        xl: "0 16px 48px rgba(26, 35, 50, 0.10), 0 4px 12px rgba(26, 35, 50, 0.04)",
        brand: "0 4px 14px rgba(14, 124, 107, 0.25)",
        accent: "0 4px 14px rgba(232, 152, 90, 0.25)",
      },
      backgroundImage: {
        "gradient-brand":
          "linear-gradient(135deg, #0E7C6B 0%, #0A5F53 100%)",
        "gradient-accent":
          "linear-gradient(135deg, #E8985A 0%, #D4854A 100%)",
        "gradient-highlight":
          "linear-gradient(135deg, #7B61C4 0%, #6558A0 100%)",
        "gradient-warm":
          "linear-gradient(135deg, #FAFAF7 0%, #FFF5EB 50%, #FAFAF7 100%)",
        "pattern-dots":
          "radial-gradient(circle, #E5DFD6 1px, transparent 1px)",
        "pattern-grid":
          "linear-gradient(#F0EBE3 1px, transparent 1px), linear-gradient(90deg, #F0EBE3 1px, transparent 1px)",
      },
      animation: {
        "fade-in-up": "fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in-down": "fade-in-down 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 2s infinite",
        "float-slow": "float-slow 20s ease-in-out infinite",
        "float-gentle": "float-gentle 4s ease-in-out infinite",
        "draw-underline": "draw-underline 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) 1s forwards",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
      keyframes: {
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-down": {
          from: { opacity: "0", transform: "translateY(-16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.92)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "33%": { transform: "translate(12px, -10px)" },
          "66%": { transform: "translate(-8px, 6px)" },
        },
        "float-gentle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "draw-underline": {
          from: { "stroke-dashoffset": "200" },
          to: { "stroke-dashoffset": "0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
