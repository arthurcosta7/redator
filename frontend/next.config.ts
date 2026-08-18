import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // ─── Headers de segurança ────────────────────────────────────────────
  async headers() {
    // Em desenvolvimento: libera localhost:8000 no connect-src
    // Em produção: só permite a URL real da API
    const apiOrigin = isDev
      ? "http://localhost:8000"
      : process.env.NEXT_PUBLIC_API_URL || "";

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
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              `connect-src 'self' ${apiOrigin} https://api.stripe.com`,
              "frame-src https://js.stripe.com https://hooks.stripe.com",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "manifest-src 'self'",
              ...(!isDev ? ["upgrade-insecure-requests"] : []),
            ].join("; "),
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
