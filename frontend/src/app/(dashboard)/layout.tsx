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

  // Painel admin tem layout próprio — não envolve com sidebar/topbar do aluno
  if (pathname.startsWith("/dashboard/admin")) {
    return <>{children}</>;
  }

  // Redirect baseado em tipo de conta (só após carregar o usuário)
  useEffect(() => {
    if (isLoading || !user) return;

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

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
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
