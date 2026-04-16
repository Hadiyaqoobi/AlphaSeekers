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

        // ─── ELECTRIC WAVE: NEW PRIMARY TOKENS ───────────────────────

        // Dark surfaces (background system)
        dark: {
          DEFAULT: "#070B0E",
          50:  "#0A1014",
          100: "#0D1419",
          200: "#111B22",
          300: "#15222C",
          400: "#1A2B37",
          500: "#1F3444",
          600: "#2A4358",
          700: "#3D5A72",
          800: "#5A7A94",
          900: "#8AA4B8",
        },

        // Electric green — primary glow
        neon: {
          50:  "#E8FFF3",
          100: "#B8FFD9",
          200: "#7AFFB8",
          300: "#3DFFA0",
          400: "#00FF88",
          500: "#00E676",
          600: "#00C853",
          700: "#00A844",
          800: "#008836",
          900: "#006828",
          DEFAULT: "#00E676",
        },

        // Electric cyan — transition
        cyan: {
          50:  "#E0FFFE",
          100: "#B3FFFA",
          200: "#73FFF2",
          300: "#33FFE8",
          400: "#00F5D4",
          500: "#00E5FF",
          600: "#00B8D4",
          700: "#0097A7",
          800: "#00798C",
          900: "#005B6E",
          DEFAULT: "#00E5FF",
        },

        // Electric blue — info / cool end
        electric: {
          50:  "#E3F2FD",
          100: "#BBDEFB",
          200: "#90CAF9",
          300: "#64B5F6",
          400: "#42A5F5",
          500: "#2979FF",
          600: "#2962FF",
          700: "#1E4FCC",
          800: "#1A3FA0",
          900: "#132F73",
          DEFAULT: "#2979FF",
        },

        // ─── LEGACY TOKENS REMAPPED TO ELECTRIC WAVE ────────────────
        // Existing components reference these names. Remap their VALUES
        // to the dark palette so the entire codebase rebrands automatically.

        brand: {
          50:  "#E8FFF3",
          100: "#B8FFD9",
          200: "#7AFFB8",
          300: "#3DFFA0",
          400: "#00FF88",
          500: "#00E676",
          600: "#00C853",
          700: "#00A844",
          800: "#008836",
          900: "#006828",
          DEFAULT: "#00E676",
        },
        accent: {
          50:  "#FFF8E1",
          100: "#FFECB3",
          200: "#FFD54F",
          300: "#FFCA28",
          400: "#FFC107",
          500: "#FFB300",
          600: "#FFA000",
          700: "#FF8F00",
          800: "#E65100",
          900: "#BF360C",
          DEFAULT: "#FFB300",
        },
        highlight: {
          50:  "#E0FFFE",
          100: "#B3FFFA",
          200: "#73FFF2",
          300: "#33FFE8",
          400: "#00F5D4",
          500: "#00E5FF",
          600: "#00B8D4",
          700: "#0097A7",
          800: "#00798C",
          900: "#005B6E",
          DEFAULT: "#00E5FF",
        },
        amber: {
          50:  "#FFF8E1",
          100: "#FFECB3",
          200: "#FFD54F",
          300: "#FFCA28",
          400: "#FFC107",
          500: "#FFB300",
          600: "#FFA000",
          700: "#FF8F00",
          800: "#E65100",
          900: "#BF360C",
          DEFAULT: "#FFB300",
        },
        danger: {
          50:  "#FEE2E2",
          100: "#FECACA",
          200: "#FCA5A5",
          300: "#F87171",
          400: "#EF4444",
          500: "#DC2626",
          600: "#B91C1C",
          700: "#991B1B",
          DEFAULT: "#EF4444",
        },
        ink: {
          main: "#E8EEF2",
          soft: "#8AA4B8",
          faint: "#5A7A94",
          white: "#FFFFFF",
        },
        surface: {
          base: "#070B0E",
          strong: "#0D1419",
          warm: "#0D1419",
          card: "#0D1419",
          elevated: "#111B22",
        },
        line: {
          DEFAULT: "rgba(0, 230, 118, 0.12)",
          soft: "rgba(0, 230, 118, 0.06)",
          strong: "rgba(0, 230, 118, 0.25)",
          blue: "rgba(41, 121, 255, 0.15)",
        },

        // Landing palette — remapped to new electric system
        land: {
          green: {
            50:  "#E8FFF3",
            100: "#B8FFD9",
            200: "#7AFFB8",
            300: "#3DFFA0",
            400: "#00FF88",
            500: "#00E676",
            600: "#00C853",
            700: "#00A844",
            800: "#008836",
            900: "#006828",
            950: "#003F18",
          },
          dark: {
            DEFAULT: "#070B0E",
            50:  "#0A1014",
            100: "#0D1419",
            200: "#111B22",
            300: "#15222C",
            400: "#1A2B37",
          },
          amber: {
            DEFAULT: "#FFB300",
            light:  "#FFCA28",
            dark:   "#FF8F00",
          },
          cream:  "#0D1419",
          sage:   "#111B22",
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
        xs: "0 1px 3px rgba(0, 0, 0, 0.3)",
        soft: "0 2px 6px rgba(0, 0, 0, 0.3), 0 0 1px rgba(0, 230, 118, 0.1)",
        mid: "0 4px 16px rgba(0, 0, 0, 0.4), 0 0 2px rgba(0, 230, 118, 0.08)",
        deep: "0 8px 32px rgba(0, 0, 0, 0.5), 0 0 4px rgba(0, 230, 118, 0.06)",
        xl: "0 16px 48px rgba(0, 0, 0, 0.6), 0 0 8px rgba(0, 230, 118, 0.04)",
        brand: "0 0 20px rgba(0, 230, 118, 0.3), 0 0 4px rgba(0, 230, 118, 0.5)",
        accent: "0 0 20px rgba(255, 179, 0, 0.3), 0 0 4px rgba(255, 179, 0, 0.5)",
        glow: "0 0 20px rgba(0, 230, 118, 0.3), 0 0 4px rgba(0, 230, 118, 0.5)",
        "glow-cyan": "0 0 20px rgba(0, 229, 255, 0.3), 0 0 4px rgba(0, 229, 255, 0.5)",
        "glow-blue": "0 0 20px rgba(41, 121, 255, 0.3), 0 0 4px rgba(41, 121, 255, 0.5)",
        "glow-sm": "0 0 8px rgba(0, 230, 118, 0.2)",
      },
      backgroundImage: {
        "gradient-brand":
          "linear-gradient(135deg, #00E676 0%, #00E5FF 100%)",
        "gradient-electric":
          "linear-gradient(135deg, #00E5FF 0%, #2979FF 100%)",
        "gradient-full":
          "linear-gradient(135deg, #00E676 0%, #00E5FF 50%, #2979FF 100%)",
        "gradient-accent":
          "linear-gradient(135deg, #FFB300 0%, #FF8F00 100%)",
        "gradient-highlight":
          "linear-gradient(135deg, #00E5FF 0%, #00B8D4 100%)",
        "gradient-warm":
          "linear-gradient(135deg, #0A1014 0%, #070B0E 100%)",
        "gradient-surface":
          "linear-gradient(180deg, #0A1014 0%, #070B0E 100%)",
        "gradient-glow":
          "radial-gradient(ellipse at 50% 0%, rgba(0, 230, 118, 0.15) 0%, transparent 70%)",
        "gradient-card":
          "linear-gradient(180deg, rgba(0, 230, 118, 0.04) 0%, transparent 100%)",
        "wave-pattern":
          "url('/images/brand-wave.jpg')",
        "pattern-dots":
          "radial-gradient(circle, rgba(0, 230, 118, 0.08) 1px, transparent 1px)",
        "pattern-grid":
          "linear-gradient(rgba(0, 230, 118, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 230, 118, 0.04) 1px, transparent 1px)",
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
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
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
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 10px rgba(0, 230, 118, 0.2)" },
          "50%": { boxShadow: "0 0 25px rgba(0, 230, 118, 0.4), 0 0 6px rgba(0, 230, 118, 0.6)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
