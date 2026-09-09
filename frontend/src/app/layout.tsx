import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono, Kalam } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

// Fontes carregadas de forma otimizada (Next.js elimina FOUT)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "500"],
});

const kalam = Kalam({
  subsets: ["latin"],
  variable: "--font-kalam",
  display: "swap",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Redator — Corrija sua redação em menos de um minuto",
    template: "%s | Redator",
  },
  description:
    "Correção de redações ENEM e vestibular com grife, nota por competência e motivo de cada nota. " +
    "Sem esperar duas semanas o cursinho devolver.",
  keywords: [
    "correção de redação",
    "redação ENEM",
    "vestibular",
    "feedback de redação",
    "análise de redação",
  ],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    title: "Redator — Corrija sua redação em menos de um minuto",
    description:
      "Grife, nota por competência e motivo de cada nota. Resultado em ~30 segundos.",
    siteName: "Redator",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // O acesso aos headers força renderização por requisição, necessária para que
  // os scripts internos do Next recebam o mesmo nonce gerado pelo middleware.
  await headers();

  return (
    <html lang="pt-BR" className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable} ${kalam.variable}`}>
      <body className="font-sans antialiased bg-paper text-ink">
        <a
          href="#conteudo-principal"
          className="fixed left-4 top-4 z-[60] -translate-y-24 bg-ink px-4 py-2 text-sm font-semibold text-paper transition-transform focus:translate-y-0"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
