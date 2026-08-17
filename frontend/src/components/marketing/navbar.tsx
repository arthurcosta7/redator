"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Funcionalidades", href: "#funcionalidades" },
  { label: "Planos", href: "#planos" },
  { label: "Para professores", href: "#professores" },
];

export function Navbar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-paper/85 backdrop-blur-md border-b border-ink-line">
      <div className="container-site">
        <nav className="flex items-center justify-between h-16 lg:h-20">

          {/* Logo — serif italic, sem caixinha colorida */}
          <Link href="/" className="flex items-baseline gap-2 group">
            <span className="font-display italic font-medium text-2xl text-ink tracking-tight">
              Redator
            </span>
            <span className="hidden sm:inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
              ed. 2026
            </span>
          </Link>

          {/* Links desktop */}
          <div className="hidden lg:flex items-center gap-10">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-[15px] font-medium text-ink-soft hover:text-ink link-underline transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTAs desktop */}
          <div className="hidden lg:flex items-center gap-5">
            <Link
              href="/auth/login"
              className="text-[15px] font-medium text-ink-soft hover:text-ink link-underline transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/auth/register"
              className="text-[15px] font-semibold text-paper bg-ink hover:bg-ink-soft
                         px-5 py-2.5 rounded transition-colors"
            >
              Criar conta
            </Link>
          </div>

          {/* Botão mobile */}
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="lg:hidden p-2 -mr-2 text-ink hover:bg-paper-deep rounded transition-colors"
            aria-label={isMobileOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={isMobileOpen}
            aria-controls="menu-principal-mobile"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>

        {/* Menu mobile */}
        {isMobileOpen && (
          <div id="menu-principal-mobile" className="mobile-menu-enter lg:hidden pb-6 border-t border-ink-line">
            <div className="pt-4 space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setIsMobileOpen(false)}
                  className="block px-2 py-2.5 text-base font-medium text-ink-soft
                             hover:text-ink rounded transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-4 mt-3 border-t border-ink-line flex flex-col gap-2">
                <Link
                  href="/auth/login"
                  className="w-full text-center text-base font-medium text-ink
                             border border-ink px-4 py-2.5 rounded"
                >
                  Entrar
                </Link>
                <Link
                  href="/auth/register"
                  className="w-full text-center text-base font-semibold text-paper
                             bg-ink px-4 py-2.5 rounded"
                >
                  Criar conta
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
