"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Funcionalidades", href: "#funcionalidades" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Planos", href: "#planos" },
  { label: "Para Professores", href: "#professores" },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Detecta scroll para mudar aparência da navbar
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm"
          : "bg-transparent"
      )}
    >
      <div className="container-site">
        <nav className="flex items-center justify-between h-16 lg:h-18">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center
                            group-hover:bg-brand-800 transition-colors">
              <PenLine className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold text-xl text-slate-900 tracking-tight">
              Redator
            </span>
          </Link>

          {/* Links desktop */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-slate-600 hover:text-brand-700
                           transition-colors duration-150"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTAs desktop */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-slate-700 hover:text-brand-700
                         px-4 py-2 rounded-lg hover:bg-brand-50 transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/auth/register"
              className="text-sm font-semibold text-white bg-brand-700 hover:bg-brand-800
                         px-5 py-2.5 rounded-lg transition-colors shadow-brand
                         hover:shadow-brand-lg"
            >
              Criar conta grátis
            </Link>
          </div>

          {/* Botão mobile */}
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label={isMobileOpen ? "Fechar menu" : "Abrir menu"}
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>

        {/* Menu mobile */}
        {isMobileOpen && (
          <div className="lg:hidden pb-4 border-t border-slate-100 bg-white">
            <div className="pt-4 space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center px-3 py-2.5 text-sm font-medium text-slate-700
                             hover:bg-slate-50 hover:text-brand-700 rounded-lg transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-3 flex flex-col gap-2">
                <Link
                  href="/auth/login"
                  className="w-full text-center text-sm font-medium text-slate-700
                             border border-slate-200 px-4 py-2.5 rounded-lg
                             hover:bg-slate-50 transition-colors"
                >
                  Entrar
                </Link>
                <Link
                  href="/auth/register"
                  className="w-full text-center text-sm font-semibold text-white
                             bg-brand-700 hover:bg-brand-800 px-4 py-2.5 rounded-lg
                             transition-colors"
                >
                  Criar conta grátis
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
