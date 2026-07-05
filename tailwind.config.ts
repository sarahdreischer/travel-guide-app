import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // Mobile-first breakpoints: base styles at 375px, then override upward
    screens: {
      // Default (base) styles apply from 375px (small mobile) — no min-width needed
      // Breakpoints below are min-width overrides
      xs: "375px",   // small mobile base (explicit named breakpoint)
      sm: "600px",   // 2-column card grid breakpoint (Requirement 5.2)
      md: "768px",   // tablet portrait
      lg: "1024px",  // tablet landscape / small laptop
      xl: "1280px",  // desktop
      "2xl": "1920px", // wide desktop
    },
    extend: {
      // Minimum touch target size per Requirement 10.5 (44×44px)
      minHeight: {
        touch: "44px",
      },
      minWidth: {
        touch: "44px",
      },
    },
  },
  plugins: [],
};

export default config;
