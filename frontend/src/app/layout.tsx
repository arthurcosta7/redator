import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Fontes carregadas de forma otimizada (Next.js elimina FOUT)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Redator — Corrija sua redação com IA",
    template: "%s | Redator",
  },
  description:
    "Corrija suas redações no modelo ENEM e Vestibular com feedback preciso, " +
    "detalhado e fiel ao corretor humano. Análise por competências, grifes no texto e mais.",
  keywords: [
    "correção de redação",
    "redação ENEM",
    "vestibular",
    "inteligência artificial",
    "feedback de redação",
    "análise de redação",
  ],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    title: "Redator — Corrija sua redação com IA",
    description:
      "Feedback preciso e detalhado para suas redações. Modelo ENEM e Vestibular.",
    siteName: "Redator",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${plusJakarta.variable}`}>
      <body className="font-sans antialiased bg-white text-slate-900">
        {children}
      </body>
    </html>
  );
}
