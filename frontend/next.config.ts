import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // ─── Headers de segurança ────────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...(!isDev
            ? [{
                key: "Strict-Transport-Security",
                value: "max-age=31536000; includeSubDomains; preload",
              }]
            : []),
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self)",
          },
        ],
      },
    ];
  },

  // ─── Configurações gerais ─────────────────────────────────────────────
  poweredByHeader: false,
  compress: true,
  output: "standalone",  // Necessário para build Docker com tamanho reduzido

  images: {
    // Next.js 15: remotePatterns em vez de domains (mais seguro)
    remotePatterns: [],
    formats: ["image/avif", "image/webp"],
  },

  // Variáveis de ambiente públicas
  env: {
    NEXT_PUBLIC_APP_NAME: "Redator",
  },
};

export default nextConfig;
