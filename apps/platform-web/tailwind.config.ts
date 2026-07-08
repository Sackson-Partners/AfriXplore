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
        "tin-primary": "#1E40AF",
        "tin-light": "#60A5FA",
        "nickel-primary": "#065F46",
        "nickel-light": "#34D399",
        "brand-primary": "#1D4ED8",
        "brand-hover": "#2563EB",
        "brand-active": "#1E40AF",
        "signal-critical": "#EF4444",
        "signal-high": "#F97316",
        "signal-medium": "#EAB308",
        "signal-low": "#22C55E",
        "signal-inactive": "#4B5563",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      boxShadow: {
        sm: "0 1px 3px 0 rgba(0,0,0,0.4)",
        md: "0 4px 12px 0 rgba(0,0,0,0.6)",
        lg: "0 8px 24px 0 rgba(0,0,0,0.8)",
        xl: "0 16px 48px 0 rgba(0,0,0,1.0)",
        "glow-copper": "0 0 16px 4px rgba(245,158,11,0.35)",
        "glow-gold": "0 0 16px 4px rgba(252,211,77,0.35)",
        "glow-signal": "0 0 20px 6px rgba(239,68,68,0.35)",
        "glow-brand": "0 0 12px 4px rgba(59,130,246,0.25)",
      },
      keyframes: {
        "pulse-ring": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.5)", opacity: "0" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.4s ease-out",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
