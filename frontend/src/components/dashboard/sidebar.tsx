"use client";

import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FilePlus2,
  ScrollText,
  CreditCard,
  Settings,
  X,
  GraduationCap,
  Users,
  BarChart3,
  TrendingUp,
  Dumbbell,
  Lock,
} from "lucide-react";
import { clsx } from "clsx";
import { PLAN_LABELS, PLAN_COLORS } from "@/types/user";
import { useUser } from "@/contexts/UserContext";

// ─── Navegação por tipo de usuário ────────────────────────────────────────────

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  exact?: boolean;
  paid?: boolean;
};

const studentNav: NavItem[] = [
  { label: "Início",          href: "/dashboard/aluno",               icon: LayoutDashboard, exact: true },
  { label: "Nova Redação",    href: "/dashboard/aluno/nova-redacao",  icon: FilePlus2 },
  { label: "Histórico",       href: "/dashboard/aluno/historico",     icon: ScrollText },
  { label: "Minhas Turmas",   href: "/dashboard/aluno/turmas",        icon: Users },
  { label: "Insights",        href: "/dashboard/aluno/insights",      icon: TrendingUp,  paid: true },
  { label: "Simulados",       href: "/dashboard/aluno/simulados",     icon: Dumbbell },
];

const studentBottomNav: NavItem[] = [
  { label: "Meu Plano",       href: "/dashboard/aluno/plano",         icon: CreditCard },
  { label: "Configurações",   href: "/dashboard/aluno/configuracoes", icon: Settings },
];

const teacherNav: NavItem[] = [
  { label: "Início",          href: "/dashboard/professor",               icon: LayoutDashboard, exact: true },
  { label: "Nova Redação",    href: "/dashboard/professor/nova-redacao",  icon: FilePlus2 },
  { label: "Turmas",          href: "/dashboard/professor/turmas",        icon: Users },
  { label: "Histórico",       href: "/dashboard/professor/historico",     icon: ScrollText },
  { label: "Analytics",       href: "/dashboard/professor/analytics",     icon: BarChart3 },
];

const teacherBottomNav: NavItem[] = [
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

  const isTeacher = user?.user_type === "teacher" || pathname.startsWith("/dashboard/professor");
  const mainNav   = isTeacher ? teacherNav       : studentNav;
  const botNav    = isTeacher ? teacherBottomNav  : studentBottomNav;
  const isPaid    = user?.plan === "standard" || user?.plan === "pro";
  const teacherSlots = user?.teacher_student_slots ?? 0;
  const displayedPlan = isTeacher
    ? teacherSlots > 0
      ? `${teacherSlots} alunos`
      : "Professor grátis"
    : user
      ? PLAN_LABELS[user.plan]
      : "";
  const displayedPlanColor = isTeacher
    ? teacherSlots > 0
      ? "bg-accent-50 text-accent-deep"
      : "bg-slate-100 text-slate-600"
    : user
      ? PLAN_COLORS[user.plan]
      : "";

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
          "fixed top-0 left-0 z-30 h-full w-60 bg-paper/95 border-r border-ink-line backdrop-blur-xl",
          "flex flex-col transition-transform duration-500 [transition-timing-function:var(--ease-drawer)]",
          "lg:translate-x-0 lg:static lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-ink-line">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-display italic font-medium text-2xl text-ink tracking-tight">Redator</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">painel</span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded text-ink-muted hover:bg-paper-deep hover:text-ink transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Badge de tipo de conta */}
        {isTeacher && (
          <div className="px-4 py-3 border-b border-ink-line">
            <span className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-accent-deep">
              <GraduationCap className="w-3.5 h-3.5" />
              Área de turmas
            </span>
          </div>
        )}

        {/* Nav principal */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <p className="px-3 pt-1 pb-3 font-mono text-[10px] text-ink-muted uppercase tracking-[0.18em]">
            Navegação
          </p>
          {mainNav.map(({ label, href, icon: Icon, exact, paid }) => {
            const locked = paid && !isPaid;
            return locked ? (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium text-ink-muted/60 hover:bg-paper-deep transition-colors"
              >
                <Icon className="w-4.5 h-4.5 flex-shrink-0 text-slate-300" />
                <span className="flex-1">{label}</span>
                <Lock className="w-3 h-3 text-slate-300" />
              </Link>
            ) : (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors",
                  isActive(href, exact)
                    ? "bg-accent-50 text-accent-deep shadow-[inset_3px_0_0_var(--accent)]"
                    : "text-ink-soft hover:bg-paper-deep hover:text-ink"
                )}
              >
                <Icon className={clsx("w-4.5 h-4.5 flex-shrink-0", isActive(href, exact) ? "text-accent" : "text-ink-muted")} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Nav inferior */}
        <div className="p-3 border-t border-ink-line space-y-1">
          {botNav.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors",
                isActive(href)
                  ? "bg-accent-50 text-accent-deep shadow-[inset_3px_0_0_var(--accent)]"
                  : "text-ink-soft hover:bg-paper-deep hover:text-ink"
              )}
            >
              <Icon className={clsx("w-4.5 h-4.5 flex-shrink-0", isActive(href) ? "text-accent" : "text-ink-muted")} />
              {label}
            </Link>
          ))}

          {/* Info do usuário */}
          {user && (
            <div className="mt-3 border-t border-ink-line px-3 pt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500 font-medium truncate max-w-[100px]">
                  {user.full_name.split(" ")[0]}
                </span>
                <span className={clsx("text-xs font-semibold px-2 py-0.5 rounded-full", displayedPlanColor)}>
                  {displayedPlan}
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
