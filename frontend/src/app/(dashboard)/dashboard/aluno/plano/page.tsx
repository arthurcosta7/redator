"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Check, CreditCard, Loader2, Settings } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { PLAN_LABELS } from "@/types/user";
import { api } from "@/lib/api/client";

const PLAN_ORDER: Record<string, number> = { free: 0, standard: 1, pro: 2 };

const plans = [
  {
    id: "free" as const,
    label: "Grátis",
    price: "R$ 0",
    period: "/mês",
    description: "Para quem está começando",
    features: [
      "1 correção por dia",
      "Análise básica por competência",
      "Feedback geral",
      "Sistema de correção padrão",
    ],
    highlight: false,
  },
  {
    id: "standard" as const,
    label: "Standard",
    price: "R$ 18,99",
    period: "/mês",
    description: "Para quem treina com frequência",
    features: [
      "3 correções por dia",
      "Sistema de correção aprimorado",
      "Grifes no texto",
      "Insights detalhados",
      "Análise avançada",
    ],
    highlight: true,
  },
  {
    id: "pro" as const,
    label: "Pro",
    price: "R$ 29,99",
    period: "/mês",
    description: "Para quem quer o máximo",
    features: [
      "10 correções por dia",
      "Sistema de correção aprimorado",
      "Grifes e insights",
      "Suporte prioritário",
      "Simulados ENEM",
    ],
    highlight: false,
  },
];

export default function PlanoPage() {
  const { user } = useUser();
  const router = useRouter();
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const currentOrder = PLAN_ORDER[user?.plan ?? "free"];

  const handleUpgrade = (planId: string) => {
    router.push(`/checkout/${planId}?periodo=mensal`);
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await api.post<{ portal_url: string }>("/checkout/portal");
      window.location.href = res.data.portal_url;
    } catch (err: unknown) {
      setPortalLoading(false);
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setPortalError(detail ?? "Não foi possível abrir o portal. Tente novamente.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl text-slate-900">
          Meu Plano
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          {user && (
            <>
              Você está no plano{" "}
              <span className="font-semibold text-slate-700">
                {PLAN_LABELS[user.plan]}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Cards dos planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrent = user?.plan === plan.id;
          const isUpgrade = PLAN_ORDER[plan.id] > currentOrder;

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl border p-6 shadow-card relative ${
                plan.highlight
                  ? "border-brand-200 ring-2 ring-brand-100"
                  : "border-slate-100"
              } ${isCurrent ? "border-green-200 ring-2 ring-green-100" : ""}`}
            >
              {plan.highlight && !isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-700 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Mais popular
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Plano atual
                </span>
              )}

              <div className="mb-4">
                <p className="font-display font-bold text-lg text-slate-900">
                  {plan.label}
                </p>
                <p className="text-xs text-slate-400">{plan.description}</p>
              </div>

              <div className="mb-5">
                <span className="text-3xl font-bold font-display text-slate-900">
                  {plan.price}
                </span>
                <span className="text-slate-400 text-sm">{plan.period}</span>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="space-y-2">
                  <button
                    disabled
                    className="w-full py-2.5 rounded-xl border-2 border-green-200 text-green-700 text-sm font-semibold bg-green-50 cursor-default"
                  >
                    Plano atual
                  </button>
                  {plan.id !== "free" && user?.has_stripe_subscription && (
                    <>
                      <button
                        onClick={handleManageSubscription}
                        disabled={portalLoading}
                        className="w-full py-2 rounded-xl border border-slate-200 text-slate-500 text-xs font-medium hover:border-slate-300 transition-colors flex items-center justify-center gap-1.5"
                      >
                        {portalLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Settings className="w-3.5 h-3.5" />
                        )}
                        Gerenciar assinatura
                      </button>
                      {portalError && (
                        <p className="text-xs text-red-500 text-center pt-1">
                          {portalError}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ) : isUpgrade ? (
                <button
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                    plan.highlight
                      ? "bg-brand-700 hover:bg-brand-800 text-white"
                      : "border-2 border-slate-200 hover:border-brand-300 text-slate-700 hover:text-brand-700"
                  }`}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  <CreditCard className="w-4 h-4" />
                  Fazer upgrade
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Info de segurança */}
      <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4 text-sm text-slate-500">
        <Zap className="w-4 h-4 text-brand-500 flex-shrink-0" />
        <p>
          Pagamentos seguros via Stripe. Cancele quando quiser, sem multas.
          Os dados do cartão nunca passam pelos nossos servidores.
        </p>
      </div>
    </div>
  );
}
