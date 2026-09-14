"use client";

import Link from "next/link";
import { XCircle } from "lucide-react";
import { useUser } from "@/contexts/UserContext";

export default function CheckoutCanceladoPage() {
  const { user } = useUser();
  const dashboard = user?.user_type === "teacher" ? "/dashboard/professor" : "/dashboard/aluno";
  const plans = `${dashboard}/plano`;
  return (
    <main id="conteudo-principal" className="app-canvas min-h-dvh flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 w-full max-w-md text-center">
        <XCircle className="w-14 h-14 text-slate-300 mx-auto mb-5" />
        <h1 className="font-display font-bold text-2xl text-slate-900 mb-2">
          Pagamento cancelado
        </h1>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          Nenhuma cobrança foi realizada. Você pode tentar novamente quando quiser.
        </p>
        <Link
          href={plans}
          className="block w-full bg-brand-700 hover:bg-brand-800 text-white
                     font-semibold py-3 rounded-xl transition-colors mb-3"
        >
          Ver planos
        </Link>
        <Link
          href={dashboard}
          className="block text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          Voltar ao dashboard
        </Link>
      </div>
    </main>
  );
}
