import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "geo-obsidian": "#0A0E14",
        "geo-slate": "#111827",
        "geo-graphite": "#1F2937",
        "geo-steel": "#374151",
        "geo-mist": "#6B7280",
        "geo-cloud": "#D1D5DB",
        "geo-white": "#F9FAFB",
        "copper-primary": "#B45309",
        "copper-light": "#F59E0B",
        "gold-primary": "#92400E",
        "gold-light": "#FCD34D",
        "brand-primary": "#1D4ED8",
        "brand-hover": "#2563EB",
        "signal-critical": "#EF4444",
        "signal-high": "#F97316",
        "signal-medium": "#EAB308",
        "signal-low": "#22C55E",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
