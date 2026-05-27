"use client";

import { useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CreditCard, Loader2, Check, Shield } from "lucide-react";
import { api } from "@/lib/api/client";

const PLAN_INFO = {
  standard: {
    label: "Standard",
    features: ["3 correções por dia", "Grifes no texto", "Insights detalhados", "Histórico de evolução"],
    prices: { mensal: "R$19,90/mês", trimestral: "R$53,70 a cada 3 meses (R$17,90/mês)" },
  },
  pro: {
    label: "Pro",
    features: ["Correções ilimitadas", "Grifes e insights avançados", "Suporte prioritário", "Histórico de evolução"],
    prices: { mensal: "R$39,90/mês", trimestral: "R$107,70 a cada 3 meses (R$35,90/mês)" },
  },
} as const;

type PlanKey = keyof typeof PLAN_INFO;
type PeriodKey = "mensal" | "trimestral";

export default function CheckoutPage() {
  const params = useParams<{ plano: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const plano = (params.plano ?? "standard") as PlanKey;
  const periodo = (searchParams.get("periodo") ?? "mensal") as PeriodKey;

  const plan = PLAN_INFO[plano] ?? PLAN_INFO.standard;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ checkout_url: string }>("/checkout/session", {
        plan: plano,
        period: periodo,
      });
      window.location.href = res.data.checkout_url;
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string" ? detail : "Erro ao iniciar pagamento. Tente novamente."
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          href="/dashboard/aluno/plano"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar aos planos
        </Link>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-8">
          <h1 className="font-display font-bold text-2xl text-slate-900 mb-1">
            Assinar {plan.label}
          </h1>
          <p className="text-sm text-slate-400 mb-6">
            {plan.prices[periodo]}
          </p>

          <ul className="space-y-2.5 mb-8">
            {plan.features.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-slate-700">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" strokeWidth={2.5} />
                {f}
              </li>
            ))}
          </ul>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full bg-brand-700 hover:bg-brand-800 disabled:opacity-60
                       text-white font-semibold py-3.5 rounded-xl transition-colors
                       flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Redirecionando…
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                Ir para o pagamento
              </>
            )}
          </button>

          <div className="flex items-center gap-2 mt-4 text-xs text-slate-400 justify-center">
            <Shield className="w-3.5 h-3.5 text-green-500" />
            Pagamento seguro via Stripe. Cancele quando quiser.
          </div>
        </div>
      </div>
    </div>
  );
}
