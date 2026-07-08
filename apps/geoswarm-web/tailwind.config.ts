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
        "brand-primary": "#1D4ED8",
        "brand-hover": "#2563EB",
        "brand-active": "#1E40AF",
        "drone-primary": "#0EA5E9",
        "drone-dark": "#0369A1",
        "scan-green": "#22C55E",
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
        "glow-drone": "0 0 12px 4px rgba(14,165,233,0.25)",
        "glow-scan": "0 0 16px 4px rgba(34,197,94,0.35)",
        "glow-signal": "0 0 20px 6px rgba(239,68,68,0.35)",
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
        "drone-fly": {
          "0%": { offsetDistance: "0%" },
          "100%": { offsetDistance: "100%" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)", opacity: "0.8" },
          "100%": { transform: "translateY(100vh)", opacity: "0" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.4s ease-out",
        shimmer: "shimmer 2s linear infinite",
        "scan-line": "scan-line 3s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
