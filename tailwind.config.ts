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
        display: ["Outfit", "sans-serif"],
        sans: ["Outfit", "sans-serif"], // Making it the default for everything for maximum friendliness
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      letterSpacing: {
        tighter: "-0.04em",
        tight: "-0.02em",
        normal: "0",
        wide: "0.02em",
      },
    },
  },
  plugins: [],
};
export default config;
