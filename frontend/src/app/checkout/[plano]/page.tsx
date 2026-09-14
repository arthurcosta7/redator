"use client";

/** Resume a oferta escolhida e delega a cobrança à sessão hospedada do Stripe. */
import { Suspense, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CreditCard, Loader2, Check, Shield } from "lucide-react";
import { api, getApiError } from "@/lib/api/client";
import { useUser } from "@/contexts/UserContext";

const PLAN_INFO = {
  standard: {
    label: "Standard",
    features: [
      "12 correções por mês",
      "Feedback, grifes e insights completos",
      "Evolução por competência e plano de melhoria",
      "3 simulados por mês",
      "Acumule até 4 créditos",
    ],
    price: "R$18,99/mês",
  },
  pro: {
    label: "Pro",
    features: [
      "30 correções por mês",
      "Tudo do Standard",
      "8 simulados por mês",
      "Comparação avançada e exercícios personalizados",
      "Prioridade de processamento e suporte",
      "Acumule até 10 créditos",
    ],
    price: "R$29,99/mês",
  },
  teacher_30: { label: "Professor 30", features: ["Até 30 alunos ativos no total", "Turmas ilimitadas", "Tarefas e geração com IA", "Relatórios por aluno, turma e competência"], price: "R$49,90/mês" },
  teacher_60: { label: "Professor 60", features: ["Até 60 alunos ativos no total", "Todos os recursos do Professor 30"], price: "R$89,90/mês" },
  teacher_100: { label: "Professor 100", features: ["Até 100 alunos ativos no total", "Todos os recursos anteriores", "Prioridade quando operacionalmente disponível"], price: "R$149,90/mês" },
} as const;

type PlanKey = keyof typeof PLAN_INFO;

function CheckoutContent() {
  const params = useParams<{ plano: string }>();
  const router = useRouter();
  const { user, isLoading } = useUser();

  const plano = (params.plano ?? "standard") as PlanKey;
  const periodo = "mensal" as const;

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
      // Dados de cartão não passam pelo frontend do Redator; o usuário conclui
      // o pagamento na URL de checkout criada e validada pelo backend.
      window.location.href = res.data.checkout_url;
    } catch (err: unknown) {
      const detail = getApiError(err).detail;
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
          href={plano.startsWith("teacher_") ? "/dashboard/professor/plano" : "/dashboard/aluno/plano"}
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
            {plan.price}
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
