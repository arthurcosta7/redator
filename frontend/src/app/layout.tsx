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
    default: "Redator — Correção e inteligência pedagógica",
    template: "%s | Redator",
  },
  description:
    "Plataforma de correção e inteligência pedagógica que conecta alunos e professores e transforma cada redação em um plano de evolução.",
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
    title: "Redator — Correção e inteligência pedagógica",
    description:
      "Diagnóstico por competência, evolução histórica e próximos passos para alunos, professores e instituições.",
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
