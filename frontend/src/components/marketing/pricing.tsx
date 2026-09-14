"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { api } from "@/lib/api/client";

type Audience = "student" | "teacher";
type Plan = { name: string; price: string; description: string; features: string[]; href: string; accent?: boolean };

const studentPlans: Plan[] = [
  { name: "Free", price: "R$ 0", description: "Experimente o ciclo de correção antes de decidir.", href: "/auth/register", features: ["4 correções por mês", "Primeira correção com experiência completa", "Demais com feedback essencial e grifes principais", "Nota por competência", "Histórico limitado", "1 simulado ou tema por mês", "Créditos gratuitos não acumulam"] },
  { name: "Standard", price: "R$ 18,99", description: "Treino frequente com diagnóstico e direção.", href: "/checkout/standard", accent: true, features: ["12 correções por mês", "Feedback, grifes e explicações completas", "Insights e histórico completos", "Evolução por competência", "Plano de melhoria", "3 simulados por mês", "Suporte prioritário", "Acumule até 4 créditos"] },
  { name: "Pro", price: "R$ 29,99", description: "Mais volume e comparação avançada.", href: "/checkout/pro", features: ["30 correções por mês", "Tudo do Standard", "8 simulados por mês", "Comparação avançada entre redações", "Exercícios personalizados", "Prioridade de processamento e suporte", "Contestação humana limitada, quando disponível", "Acumule até 10 créditos"] },
];

const teacherPlans: Plan[] = [
  { name: "Professor Free", price: "R$ 0", description: "Crie sua primeira turma sem compromisso.", href: "/auth/register?type=teacher", features: ["Até 3 alunos ativos no total", "Turmas ilimitadas", "Tarefas com tema e prazo", "Correções automáticas", "Relatórios essenciais"] },
  { name: "Professor 30", price: "R$ 49,90", description: "Para professores e turmas em atividade contínua.", href: "/checkout/teacher_30", accent: true, features: ["Até 30 alunos ativos no total", "Turmas ilimitadas", "Tarefas, convites e entregas", "Geração de tarefas com IA", "Relatórios por aluno, turma e competência", "Histórico, evolução e insights pedagógicos"] },
  { name: "Professor 60", price: "R$ 89,90", description: "Mais capacidade com a mesma visão pedagógica.", href: "/checkout/teacher_60", features: ["Até 60 alunos ativos no total", "Todos os recursos do Professor 30"] },
  { name: "Professor 100", price: "R$ 149,90", description: "Para operações docentes maiores.", href: "/checkout/teacher_100", features: ["Até 100 alunos ativos no total", "Todos os recursos anteriores", "Prioridade de suporte e processamento, quando disponível"] },
];

export function Pricing({ initialAudience = "student" }: { initialAudience?: Audience }) {
  const [audience, setAudience] = useState<Audience>(initialAudience);
  useEffect(() => { api.post("/users/events/public", { event: "plans_viewed" }).catch(() => undefined); }, []);
  const plans = audience === "student" ? studentPlans : teacherPlans;

  return (
    <section id="planos" className="section-padding scroll-mt-24 bg-paper-deep">
      <div className="container-site">
        <header className="max-w-3xl">
          <p className="eyebrow">Planos mensais transparentes</p>
          <h2 className="mt-5 font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl lg:text-6xl">Escolha a capacidade que acompanha sua rotina.</h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">Limites aplicados no servidor. Redações entregues em tarefas não consomem os créditos pessoais do aluno.</p>
        </header>

        <div className="mt-9 inline-flex border border-ink-line bg-paper p-1" role="group" aria-label="Tipo de plano">
          {(["student", "teacher"] as const).map((value) => (
            <button key={value} type="button" onClick={() => setAudience(value)} aria-pressed={audience === value} className={`min-h-11 px-5 text-sm font-semibold transition-colors ${audience === value ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"}`}>
              {value === "student" ? "Para alunos" : "Para professores"}
            </button>
          ))}
        </div>

        <div className={`mt-10 grid gap-px border border-ink-line bg-ink-line ${audience === "student" ? "lg:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4"}`}>
          {plans.map((plan) => (
            <article key={plan.name} className={`flex flex-col bg-paper p-6 lg:p-8 ${plan.accent ? "relative ring-2 ring-inset ring-accent" : ""}`}>
              <h3 className="font-mono text-xs uppercase tracking-[0.14em] text-ink-muted">{plan.name}</h3>
              <p className="mt-5 font-display text-4xl font-semibold text-ink">{plan.price}<span className="ml-1 font-sans text-sm font-normal text-ink-muted">/mês</span></p>
              <p className="mt-4 min-h-12 text-sm leading-relaxed text-ink-soft">{plan.description}</p>
              <ul className="mt-7 flex-1 space-y-3">
                {plan.features.map((feature) => <li key={feature} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft"><Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /><span>{feature}</span></li>)}
              </ul>
              <Link href={plan.href} className={`mt-8 inline-flex min-h-12 items-center justify-center px-5 text-sm font-semibold transition-colors ${plan.accent ? "bg-accent text-paper hover:bg-accent-deep" : "border border-ink text-ink hover:bg-ink hover:text-paper"}`}>
                {plan.price === "R$ 0" ? (audience === "student" ? "Começar grátis" : "Criar primeira turma grátis") : `Escolher ${plan.name}`}
              </Link>
            </article>
          ))}
        </div>

        {audience === "teacher" && <div className="mt-6 flex flex-col justify-between gap-4 border border-ink-line bg-paper p-6 sm:flex-row sm:items-center"><div><h3 className="font-display text-xl font-semibold text-ink">Escola — acima de 100 alunos</h3><p className="mt-1 text-sm text-ink-soft">Gestão de professores, relatórios institucionais, onboarding e correções em volume.</p></div><a href="mailto:suporte@redator.online?subject=Plano%20Escola" className="font-semibold text-accent link-underline">Falar sobre o plano Escola</a></div>}
        {audience === "teacher" && <p className="mt-5 text-sm leading-relaxed text-ink-muted">O mesmo aluno em duas turmas conta uma vez. Somente vínculos ativos ocupam vaga; remover um vínculo libera a vaga imediatamente. Alunos offline ocupam uma vaga por cadastro.</p>}
      </div>
    </section>
  );
}
