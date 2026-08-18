"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { UserProvider } from "@/contexts/UserContext";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { useUser } from "@/contexts/UserContext";

// ─── Shell com redirect de tipo de conta ─────────────────────────────────────

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect baseado em tipo de conta (só após carregar o usuário)
  useEffect(() => {
    if (pathname.startsWith("/dashboard/admin")) return;
    if (isLoading || !user) return;

    if (pathname === "/dashboard" && user.admin_role === "licensed_teacher") {
      router.replace("/dashboard/admin/contestacoes");
      return;
    }

    const isTeacher = user.user_type === "teacher";

    // /dashboard sem sub-rota → redireciona para o dashboard correto
    if (pathname === "/dashboard") {
      router.replace(isTeacher ? "/dashboard/professor" : "/dashboard/aluno");
      return;
    }

    // Professor tentando acessar rotas de aluno → redireciona para professor
    if (isTeacher && pathname.startsWith("/dashboard/aluno")) {
      router.replace("/dashboard/professor");
      return;
    }

    // Aluno tentando acessar rotas de professor → redireciona para aluno
    if (!isTeacher && pathname.startsWith("/dashboard/professor")) {
      router.replace("/dashboard/aluno");
      return;
    }
  }, [user, isLoading, pathname, router]);

  // Painel admin tem layout próprio — não envolve com sidebar/topbar do aluno.
  // Mantido depois dos hooks para preservar a ordem de execução do React.
  if (pathname.startsWith("/dashboard/admin")) {
    return <>{children}</>;
  }

  return (
    <div className="app-canvas flex min-h-dvh h-dvh overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main id="conteudo-principal" className="flex-1 overflow-y-auto px-4 py-6 sm:px-7 sm:py-8 lg:px-10">
          <div key={pathname} className="page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <DashboardShell>{children}</DashboardShell>
    </UserProvider>
  );
}
