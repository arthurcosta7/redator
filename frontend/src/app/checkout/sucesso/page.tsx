"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function CheckoutSucessoPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 w-full max-w-md text-center">
        <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-5" />
        <h1 className="font-display font-bold text-2xl text-slate-900 mb-2">
          Assinatura ativada!
        </h1>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          Seu plano já está ativo. Pode começar a corrigir suas redações com todos os recursos desbloqueados.
        </p>
        <Link
          href="/dashboard/aluno"
          className="block w-full bg-brand-700 hover:bg-brand-800 text-white
                     font-semibold py-3 rounded-xl transition-colors"
        >
          Ir para o dashboard →
        </Link>
      </div>
    </div>
  );
}
