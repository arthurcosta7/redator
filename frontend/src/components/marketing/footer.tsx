import Link from "next/link";
import { PenLine } from "lucide-react";

const links = {
  Produto: [
    { label: "Funcionalidades", href: "#funcionalidades" },
    { label: "Planos e Preços", href: "#planos" },
    { label: "Para Professores", href: "#professores" },
    { label: "Como funciona", href: "#como-funciona" },
  ],
  Suporte: [
    { label: "Central de ajuda", href: "/help" },
    { label: "Contato", href: "/contact" },
    { label: "Status do sistema", href: "/status" },
  ],
  Legal: [
    { label: "Termos de uso", href: "/terms" },
    { label: "Privacidade", href: "/privacy" },
    { label: "Cookies", href: "/cookies" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400">
      <div className="container-site py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 mb-12">

          {/* Brand */}
          <div className="col-span-2 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4 group w-fit">
              <div className="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center">
                <PenLine className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-display font-bold text-xl text-white">Redator</span>
            </Link>
            <p className="text-sm leading-relaxed max-w-xs">
              Correção de redações para ENEM e vestibular — com feedback detalhado,
              grifes no texto e histórico de evolução.
            </p>
          </div>

          {/* Links */}
          {Object.entries(links).map(([category, categoryLinks]) => (
            <div key={category}>
              <h4 className="font-semibold text-white text-sm mb-4">{category}</h4>
              <ul className="space-y-3">
                {categoryLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm hover:text-white transition-colors duration-150"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Rodapé */}
        <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row
                        items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Redator. Todos os direitos reservados.
          </p>
          <p className="text-xs text-slate-600">
            Feito com carinho no Brasil 🇧🇷
          </p>
        </div>
      </div>
    </footer>
  );
}
