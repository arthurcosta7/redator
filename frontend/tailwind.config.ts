import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ─── Sistema de cores do Redator ────────────────────────────
      colors: {
        brand: {
          50:  "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",   // Cor primária
          800: "#1E40AF",
          900: "#1E3A8A",   // Cor escura
          950: "#172554",
        },
        accent: {
          400: "#FBBF24",
          500: "#F59E0B",   // Âmbar — usado em destaques
          600: "#D97706",
        },
        success: {
          500: "#10B981",
          100: "#D1FAE5",
        },
        warning: {
          500: "#F59E0B",
          100: "#FEF3C7",
        },
        danger: {
          500: "#EF4444",
          100: "#FEE2E2",
        },
      },

      // ─── Tipografia ───────────────────────────────────────────────
      fontFamily: {
        // Usamos Next/font para carregar essas fontes de forma otimizada
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-plus-jakarta)", "var(--font-inter)", "sans-serif"],
      },

      // ─── Spacing extra (para classes como w-4.5, h-18 etc.) ──────
      spacing: {
        "4.5": "1.125rem",   // 18px — para ícones médios
        "18": "4.5rem",      // 72px — altura da navbar desktop
      },

      // ─── Sombras customizadas ─────────────────────────────────────
      boxShadow: {
        "card": "0 1px 3px 0 rgba(0,0,0,.06), 0 1px 2px -1px rgba(0,0,0,.04)",
        "card-hover": "0 10px 25px -3px rgba(0,0,0,.08), 0 4px 6px -4px rgba(0,0,0,.05)",
        "brand": "0 4px 14px 0 rgba(29, 78, 216, 0.25)",
        "brand-lg": "0 10px 30px -3px rgba(29, 78, 216, 0.3)",
        "inner-brand": "inset 0 2px 4px 0 rgba(29, 78, 216, 0.1)",
      },

      // ─── Animações ────────────────────────────────────────────────
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.4s ease-out",
        "float": "float 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },

      // ─── Gradientes customizados ──────────────────────────────────
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #1D4ED8 0%, #1E3A8A 100%)",
        "brand-gradient-light": "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
        "hero-pattern": "radial-gradient(circle at 20% 50%, rgba(29, 78, 216, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.05) 0%, transparent 50%)",
      },
    },
  },
  plugins: [],
};

export default config;
