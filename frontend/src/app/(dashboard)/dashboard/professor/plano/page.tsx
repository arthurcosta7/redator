"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Settings, Users } from "lucide-react";
import { api } from "@/lib/api/client";
import { useUser } from "@/contexts/UserContext";

type SlotInfo = { slots_total: number; slots_used: number; plan_name: string; is_paid: boolean };
const plans = [
  { id: "teacher_30", name: "Professor 30", price: "R$ 49,90", seats: 30, features: ["Geração de tarefas com IA", "Relatórios completos", "Histórico e insights pedagógicos"] },
  { id: "teacher_60", name: "Professor 60", price: "R$ 89,90", seats: 60, features: ["Tudo do Professor 30", "Capacidade para até 60 alunos únicos"] },
  { id: "teacher_100", name: "Professor 100", price: "R$ 149,90", seats: 100, features: ["Tudo dos planos anteriores", "Prioridade quando operacionalmente disponível"] },
] as const;

export default function ProfessorPlanoPage() {
  const { user } = useUser();
  const [slots, setSlots] = useState<SlotInfo | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  useEffect(() => {
    Promise.all([
      api.get<SlotInfo>("/professor/slots").then((response) => setSlots(response.data)),
      api.post("/users/events", { event: "plans_viewed" }).catch(() => undefined),
    ]).catch(() => undefined);
  }, []);

  const total = slots?.slots_total ?? 3;
  const used = slots?.slots_used ?? 0;
  const percentage = Math.min(100, Math.round((used / total) * 100));

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const response = await api.post<{ portal_url: string }>("/checkout/portal");
      window.location.href = response.data.portal_url;
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header><p className="font-mono text-xs uppercase tracking-wider text-brand-700">Capacidade da conta</p><h1 className="mt-2 font-display text-3xl font-semibold text-slate-900">Planos para professores</h1><p className="mt-2 text-sm text-slate-500">O limite considera alunos ativos únicos em todas as turmas. Turmas são ilimitadas.</p></header>

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
        {!slots ? <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" />Carregando capacidade…</div> : <><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-brand-50"><Users className="size-5 text-brand-700" /></span><div><h2 className="font-display text-xl font-semibold text-slate-900">{slots.plan_name}</h2><p className="text-sm text-slate-500">{used} de {total} alunos ativos</p></div></div>{slots.is_paid && user?.has_stripe_subscription && <button onClick={openPortal} disabled={portalLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"><Settings className="size-4" />Gerenciar assinatura</button>}</div><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full origin-left rounded-full bg-brand-600 transition-transform" style={{ transform: `scaleX(${percentage / 100})` }} /></div><p className="mt-3 text-xs leading-5 text-slate-500">O mesmo usuário em duas turmas conta uma vez. Alunos offline ocupam uma vaga por cadastro. Remover um vínculo ativo libera a vaga imediatamente.</p></>}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const current = slots?.slots_total === plan.seats && slots.is_paid;
          return <article key={plan.id} className={`flex flex-col rounded-2xl border bg-white p-6 shadow-card ${plan.seats === 30 ? "border-brand-200 ring-2 ring-brand-50" : "border-slate-100"}`}><p className="font-display text-xl font-semibold text-slate-900">{plan.name}</p><p className="mt-3 font-display text-3xl font-semibold text-slate-900">{plan.price}<span className="font-sans text-xs font-normal text-slate-400">/mês</span></p><p className="mt-2 text-sm text-slate-500">Até {plan.seats} alunos ativos no total.</p><ul className="mt-6 flex-1 space-y-2">{plan.features.map((feature) => <li key={feature} className="flex gap-2 text-sm text-slate-600"><Check className="mt-0.5 size-4 shrink-0 text-green-600" />{feature}</li>)}</ul>{current ? <span className="mt-7 rounded-xl bg-green-50 py-3 text-center text-sm font-semibold text-green-700">Plano atual</span> : <Link href={`/checkout/${plan.id}`} className="mt-7 rounded-xl bg-brand-700 py-3 text-center text-sm font-semibold text-white hover:bg-brand-800">Escolher {plan.name}</Link>}</article>;
        })}
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white p-6 text-sm text-slate-600"><h2 className="font-display text-lg font-semibold text-slate-900">Professor Free</h2><p className="mt-2">Até 3 alunos ativos no total, turmas ilimitadas, tarefas com tema e prazo, correções automáticas e relatórios essenciais. A geração de tarefas com IA e os relatórios completos começam no Professor 30.</p></section>
    </div>
  );
}
