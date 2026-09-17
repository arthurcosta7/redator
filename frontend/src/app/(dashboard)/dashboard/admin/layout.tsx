"use client";

/**
 * layout.tsx — Layout do painel administrativo
 *
 * Verifica autenticação admin no client-side antes de renderizar.
 * O backend valida a role a cada requisição (segurança real).
 * Este check é apenas UX — redireciona não-admins rapidamente.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart3,
  Shield,
  LogOut,
  ChevronRight,
  Menu,
  X,
  AlertTriangle,
  Scale,
  Link2,
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { ADMIN_ROLE_LABELS, ADMIN_ROLE_COLORS, canManageTeam, canViewAnalytics } from "@/types/admin";
import type { AdminRole } from "@/types/user";

// ─── Itens da sidebar ────────────────────────────────────────────────────────

function getNavItems(role: AdminRole) {
  const items = [
    {
      href: "/dashboard/admin",
      label: "Visão Geral",
      icon: LayoutDashboard,
      exact: true,
      visible: role !== "licensed_teacher",
    },
    {
      href: "/dashboard/admin/usuarios",
      label: "Usuários",
      icon: Users,
      exact: false,
      visible: ["superadmin", "admin", "support"].includes(role),
    },
    {
      href: "/dashboard/admin/redacoes",
      label: "Redações",
      icon: FileText,
      exact: false,
      visible: role !== "licensed_teacher",
    },
    {
      href: "/dashboard/admin/contestacoes",
      label: "Contestações",
      icon: Scale,
      exact: false,
      visible: ["superadmin", "licensed_teacher"].includes(role),
    },
    {
      href: "/dashboard/admin/analytics",
      label: "Analytics",
      icon: BarChart3,
      exact: false,
      visible: canViewAnalytics(role),
    },
    {
      href: "/dashboard/admin/indicacoes",
      label: "Indicações",
      icon: Link2,
      exact: false,
      visible: ["superadmin", "admin"].includes(role),
    },
    {
      href: "/dashboard/admin/equipe",
      label: "Equipe",
      icon: Shield,
      exact: false,
      visible: canManageTeam(role),
    },
  ];
  return items.filter((i) => i.visible);
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function AdminSidebar({
  role,
  onClose,
}: {
  role: AdminRole;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const navItems = getNavItems(role);

  return (
    <aside className="flex flex-col h-full bg-slate-900 text-white w-64">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <div>
          <p className="font-display font-bold text-white text-lg leading-none">
            Redator
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Painel Admin</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white lg:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nível de acesso badge */}
      <div className="px-4 py-3 border-b border-slate-700">
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${ADMIN_ROLE_COLORS[role]}`}
        >
          <Shield className="w-3 h-3" />
          {ADMIN_ROLE_LABELS[role]}
        </span>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
              {isActive && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer — link de volta */}
      <div className="px-3 py-4 border-t border-slate-700 space-y-1">
        <Link
          href="/dashboard/aluno"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Voltar ao Dashboard
        </Link>
      </div>
    </aside>
  );
}

// ─── Layout principal ────────────────────────────────────────────────────────

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Proteção client-side: redireciona não-admins
  useEffect(() => {
    if (!isLoading && (!user || !user.admin_role)) {
      router.replace("/dashboard/aluno");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (
      !isLoading &&
      user?.admin_role === "licensed_teacher" &&
      !pathname.startsWith("/dashboard/admin/contestacoes")
    ) {
      router.replace("/dashboard/admin/contestacoes");
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user?.admin_role) {
    return null; // Redirecionando...
  }

  const role = user.admin_role;

  return (
    <div className="app-canvas min-h-dvh flex">
      {/* Sidebar — desktop */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <AdminSidebar role={role} />
      </div>

      {/* Sidebar — mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10">
            <AdminSidebar role={role} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar mobile */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-700">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white p-1"
          >
            <Menu className="w-5 h-5" />
          </button>
          <p className="font-display font-bold text-white text-base">
            Painel Admin
          </p>
        </header>

        {/* Aviso de ambiente admin */}
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-800 font-medium">
            Área administrativa restrita — todas as ações são registradas.
          </p>
        </div>

        {/* Conteúdo da página */}
        <main id="conteudo-principal" className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div key={pathname} className="page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
