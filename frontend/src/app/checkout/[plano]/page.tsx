"use client";

import { Suspense, useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CreditCard, Loader2, Check, Shield } from "lucide-react";
import { api } from "@/lib/api/client";
import { useUser } from "@/contexts/UserContext";

const PLAN_INFO = {
  standard: {
    label: "Standard",
    features: [
      "3 correções por dia",
      "Grifes no texto",
      "Sistema de correção aprimorado",
      "Insights dos últimos 30 dias",
      "Simulados com IA",
      "Histórico de evolução",
    ],
    prices: { mensal: "R$18,99/mês", trimestral: "R$47,99 a cada 3 meses (R$15,99/mês)" },
  },
  pro: {
    label: "Pro",
    features: [
      "10 correções por dia",
      "Grifes e insights avançados",
      "Sistema de correção aprimorado",
      "Insights dos últimos 30 dias",
      "Simulados com IA",
      "Suporte prioritário",
      "Histórico de evolução",
    ],
    prices: { mensal: "R$29,99/mês", trimestral: "R$74,99 a cada 3 meses (R$24,99/mês)" },
  },
} as const;

type PlanKey = keyof typeof PLAN_INFO;
type PeriodKey = "mensal" | "trimestral";

function CheckoutContent() {
  const params = useParams<{ plano: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading } = useUser();

  const plano = (params.plano ?? "standard") as PlanKey;
  const periodo = (searchParams.get("periodo") ?? "mensal") as PeriodKey;

  const plan = PLAN_INFO[plano] ?? PLAN_INFO.standard;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redireciona para login se não estiver autenticado
  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      const returnUrl = `/checkout/${plano}?periodo=${periodo}`;
      router.replace(`/auth/login?redirect=${encodeURIComponent(returnUrl)}`);
    }
  }, [user, isLoading, plano, periodo, router]);

  if (isLoading || !user) {
    return (
      <div className="app-canvas min-h-dvh flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-700" />
      </div>
    );
  }

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
    <main id="conteudo-principal" className="app-canvas min-h-dvh flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          href="/dashboard/aluno/plano"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar aos planos
        </Link>

        <div className="product-surface rounded-2xl border p-8">
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
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="app-canvas min-h-dvh flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
