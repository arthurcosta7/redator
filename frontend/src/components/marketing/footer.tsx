import Link from "next/link";

const links = {
  Produto: [
    { label: "Funcionalidades", href: "#funcionalidades" },
    { label: "Planos e preços", href: "#planos" },
    { label: "Para professores", href: "#professores" },
    { label: "Como funciona", href: "#como-funciona" },
  ],
  Suporte: [
    { label: "Central de ajuda", href: "/help" },
    { label: "Contato", href: "mailto:contato@redator.com.br" },
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
    <footer className="bg-ink text-paper">
      <div className="container-site py-20 lg:py-24">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 mb-16">

          {/* Brand */}
          <div className="col-span-2 lg:col-span-2">
            <Link href="/" className="flex items-baseline mb-5 group w-fit">
              <span className="font-display italic font-medium text-3xl text-paper tracking-tight">
                Redator
              </span>
            </Link>
            <p className="text-[15px] leading-[1.65] max-w-xs text-paper/70">
              Correção de redações para ENEM e vestibular — com grife, nota por competência e histórico de evolução. Em menos de um minuto.
            </p>
          </div>

          {/* Links */}
          {Object.entries(links).map(([category, categoryLinks]) => (
            <div key={category}>
              <h4 className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper/50 mb-5">
                {category}
              </h4>
              <ul className="space-y-3">
                {categoryLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[15px] text-paper/80 hover:text-paper link-underline transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Régua inferior */}
        <div className="border-t border-paper/15 pt-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-paper/50">
            © Redator · todos os direitos reservados
          </p>
        </div>
      </div>
    </footer>
  );
}
