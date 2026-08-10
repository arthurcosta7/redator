"use client";

import { Loader2 } from "lucide-react";

// Esta página nunca chega a ser vista — o DashboardShell no layout.tsx
// redireciona /dashboard → /dashboard/aluno ou /dashboard/professor
// assim que o usuário for carregado. O spinner cobre o flash de tela vazia.
export default function DashboardRootPage() {
  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
    </div>
  );
}
