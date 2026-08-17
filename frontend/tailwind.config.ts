import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ─── Paleta editorial ─────────────────────────────────────
      // Substitui o azul genérico de SaaS. Base off-white (papel),
      // tinta preta, accent burnt sienna (caneta hidrocor de correção).
      colors: {
        paper: {
          DEFAULT: "#FAF7F2",
          deep: "#F1ECE2",
        },
        ink: {
          DEFAULT: "#0F0E0C",
          soft: "#3A3735",
          muted: "#6B6660",
          line: "rgba(15, 14, 12, 0.15)",
        },
        accent: {
          50: "#FBF0E9",
          100: "#F3DED1",
          200: "#E8C9B5",
          300: "#DDA785",
          400: "#CA7950",
          500: "#B5451B",
          600: "#9E3A15",
          700: "#8C330F",
          800: "#712A12",
          900: "#5E2513",
          DEFAULT: "#B5451B",
          deep: "#8C330F",
          light: "#E8C9B5",
        },
        // Compatibilidade com as telas do produto. O antigo azul de marca
        // passa a apontar para a mesma tinta terracota da landing page.
        brand: {
          50: "#FBF0E9",
          100: "#F3DED1",
          200: "#E8C9B5",
          300: "#DDA785",
          400: "#CA7950",
          500: "#B5451B",
          600: "#9E3A15",
          700: "#8C330F",
          800: "#712A12",
          900: "#5E2513",
        },
        purple: {
          50: "#FBF0E9",
          100: "#F3DED1",
          200: "#E8C9B5",
          300: "#DDA785",
          400: "#CA7950",
          500: "#B5451B",
          600: "#9E3A15",
          700: "#8C330F",
          800: "#712A12",
          900: "#5E2513",
        },
        violet: {
          50: "#FBF0E9",
          100: "#F3DED1",
          200: "#E8C9B5",
          300: "#DDA785",
          400: "#CA7950",
          500: "#B5451B",
          600: "#9E3A15",
          700: "#8C330F",
          800: "#712A12",
          900: "#5E2513",
        },
        // Neutros quentes: mantém as classes existentes e elimina a ruptura
        // entre a landing editorial e a aplicação interna.
        slate: {
          50: "#FAF7F2",
          100: "#F1ECE2",
          200: "#E2DACE",
          300: "#C9BFB2",
          400: "#918980",
          500: "#6B6660",
          600: "#514C47",
          700: "#3A3735",
          800: "#262320",
          900: "#0F0E0C",
          950: "#090806",
        },
        transparent: "transparent",
        current: "currentColor",
      },

      // ─── Tipografia ────────────────────────────────────────────
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
        hand: ["var(--font-kalam)", "cursive"],
      },

      // ─── Sombras neutras (sem tom de cor) ──────────────────────
      boxShadow: {
        "card": "0 1px 2px 0 rgba(15, 14, 12, 0.04), 0 0 0 1px rgba(15, 14, 12, 0.06)",
        "card-hover": "0 2px 8px 0 rgba(15, 14, 12, 0.06), 0 0 0 1px rgba(15, 14, 12, 0.08)",
      },
      borderRadius: {
        lg: "0.375rem",
        xl: "0.5rem",
        "2xl": "0.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
