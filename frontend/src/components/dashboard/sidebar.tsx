"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PenLine,
  LayoutDashboard,
  FilePlus2,
  ScrollText,
  CreditCard,
  Settings,
  X,
  GraduationCap,
  BookOpen,
  Users,
  BarChart3,
  Bell,
} from "lucide-react";
import { clsx } from "clsx";
import { PLAN_LABELS, PLAN_COLORS } from "@/types/user";
import { useUser } from "@/contexts/UserContext";

// ─── Navegação por tipo de usuário ────────────────────────────────────────────

const studentNav = [
  { label: "Início",          href: "/dashboard/aluno",               icon: LayoutDashboard, exact: true },
  { label: "Nova Redação",    href: "/dashboard/aluno/nova-redacao",  icon: FilePlus2 },
  { label: "Histórico",       href: "/dashboard/aluno/historico",     icon: ScrollText },
  { label: "Minhas Turmas",   href: "/dashboard/aluno/turmas",        icon: Users },
];

const studentBottomNav = [
  { label: "Meu Plano",       href: "/dashboard/aluno/plano",         icon: CreditCard },
  { label: "Configurações",   href: "/dashboard/aluno/configuracoes", icon: Settings },
];

const teacherNav = [
  { label: "Início",          href: "/dashboard/professor",               icon: LayoutDashboard, exact: true },
  { label: "Nova Redação",    href: "/dashboard/professor/nova-redacao",  icon: FilePlus2 },
  { label: "Turmas",          href: "/dashboard/professor/turmas",        icon: Users },
  { label: "Histórico",       href: "/dashboard/professor/historico",     icon: ScrollText },
  { label: "Analytics",       href: "/dashboard/professor/analytics",     icon: BarChart3 },
];

const teacherBottomNav = [
  { label: "Meu Plano",       href: "/dashboard/professor/plano",         icon: CreditCard },
  { label: "Configurações",   href: "/dashboard/professor/configuracoes", icon: Settings },
];

// ─── Componente ───────────────────────────────────────────────────────────────

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();

  const isTeacher = user?.user_type === "teacher";
  const mainNav   = isTeacher ? teacherNav       : studentNav;
  const botNav    = isTeacher ? teacherBottomNav  : studentBottomNav;

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={clsx(
          "fixed top-0 left-0 z-30 h-full w-64 bg-white border-r border-slate-100",
          "flex flex-col transition-transform duration-300 ease-in-out",
          "lg:translate-x-0 lg:static lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-slate-100">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-brand-700 rounded-lg flex items-center justify-center">
              <PenLine className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold text-lg text-slate-900">Redator</span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Badge de tipo de conta */}
        {isTeacher && (
          <div className="px-4 py-2.5 border-b border-slate-100">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full">
              <GraduationCap className="w-3.5 h-3.5" />
              Conta Professor
            </span>
          </div>
        )}

        {/* Nav principal */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <p className="px-3 pt-1 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Menu
          </p>
          {mainNav.map(({ label, href, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive(href, exact)
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className={clsx("w-4.5 h-4.5 flex-shrink-0", isActive(href, exact) ? "text-brand-600" : "text-slate-400")} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Nav inferior */}
        <div className="p-3 border-t border-slate-100 space-y-0.5">
          {botNav.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive(href)
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className={clsx("w-4.5 h-4.5 flex-shrink-0", isActive(href) ? "text-brand-600" : "text-slate-400")} />
              {label}
            </Link>
          ))}

          {/* Info do usuário */}
          {user && (
            <div className="mt-3 px-3 py-3 rounded-xl bg-slate-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500 font-medium truncate max-w-[100px]">
                  {user.full_name.split(" ")[0]}
                </span>
                <span className={clsx("text-xs font-semibold px-2 py-0.5 rounded-full", PLAN_COLORS[user.plan])}>
                  {PLAN_LABELS[user.plan]}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
