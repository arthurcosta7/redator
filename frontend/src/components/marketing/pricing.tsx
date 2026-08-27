"use client";

/**
 * Tabela comercial da landing page.
 * Alunos usam assinaturas por período; professores compram capacidade de turma.
 * Os dois catálogos são separados de propósito para não misturar benefícios.
 */
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Minus, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydratedReducedMotion } from "@/hooks/use-hydrated-reduced-motion";

type Plan = {
  name: string;
  price: { monthly: number | null; quarterly: number | null };
  quarterlyTotal: number | null;
  description: string;
  audience: string;
  features: { text: string; included: boolean }[];
  cta: string;
  highlighted: boolean;
  consultation?: boolean;
};

type PricingAudience = "student" | "teacher";

type TeacherOffer = {
  name: string;
  audience: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
};

// Fonte de apresentação dos planos. Valores cobrados continuam sendo validados
// pelo backend/Stripe; nunca use estes objetos como autorização de cobrança.
const studentPlans: Plan[] = [
  {
    name: "Free",
    price: { monthly: 0, quarterly: 0 },
    quarterlyTotal: 0,
    description: "Para conhecer a plataforma e criar uma rotina de prática.",
    audience: "Estudante casual",
    features: [
      { text: "1 correção por dia", included: true },
      { text: "Foto para texto (OCR)", included: true },
      { text: "Análise por competências", included: true },
      { text: "Feedback básico", included: true },
      { text: "Modelos ENEM e Vestibular", included: true },
      { text: "Sistema de correção aprimorado", included: false },
      { text: "Grife no texto (bom/ruim)", included: false },
      { text: "Insights avançados de melhoria", included: false },
      { text: "Histórico completo de evolução", included: false },
      { text: "Suporte prioritário", included: false },
    ],
    cta: "Começar grátis",
    highlighted: false,
  },
  {
    name: "Standard",
    price: { monthly: 18.99, quarterly: 14.99 },
    quarterlyTotal: 47.99,
    description: "Para quem estuda com constância para ENEM ou vestibular.",
    audience: "ENEM & Vestibular",
    features: [
      { text: "3 correções por dia", included: true },
      { text: "Foto para texto (OCR)", included: true },
      { text: "Análise por competências", included: true },
      { text: "Feedback avançado e detalhado", included: true },
      { text: "Modelos ENEM e Vestibular", included: true },
      { text: "Sistema de correção aprimorado", included: true },
      { text: "Grife no texto (bom/ruim)", included: true },
      { text: "Insights avançados de melhoria", included: true },
      { text: "Histórico completo de evolução", included: true },
      { text: "Suporte prioritário", included: false },
    ],
    cta: "Assinar Standard",
    highlighted: true,
  },
  {
    name: "Pro",
    price: { monthly: 29.99, quarterly: 24.99 },
    quarterlyTotal: 74.99,
    description: "Para quem precisa de mais volume e velocidade no treino.",
    audience: "Alta performance",
    features: [
      { text: "10 correções por dia", included: true },
      { text: "Foto para texto (OCR)", included: true },
      { text: "Análise por competências", included: true },
      { text: "Feedback avançado e detalhado", included: true },
      { text: "Modelos ENEM e Vestibular", included: true },
      { text: "Sistema de correção aprimorado", included: true },
      { text: "Grife no texto (bom/ruim)", included: true },
      { text: "Insights avançados de melhoria", included: true },
      { text: "Histórico completo de evolução", included: true },
      { text: "Suporte prioritário", included: true },
    ],
    cta: "Assinar Pro",
    highlighted: false,
  },
];

const teacherOffers: TeacherOffer[] = [
  {
    name: "Professor Free",
    audience: "Para começar",
    price: "Grátis",
    period: "para sempre",
    description: "Para organizar turmas menores e experimentar toda a rotina do professor.",
    features: [
      "Até 3 alunos ativos por turma",
      "Turmas ilimitadas",
      "Tarefas com tema e prazo",
      "Geração de temas por IA",
      "Correção automática das entregas",
      "Analytics geral por turma e aluno",
    ],
    cta: "Criar conta de professor",
    highlighted: false,
  },
  {
    name: "Pacote de alunos",
    audience: "Para turmas em crescimento",
    price: "R$ 11,99",
    period: "/mês por pacote",
    description: "Cada pacote adiciona 10 vagas que você distribui livremente entre suas turmas.",
    features: [
      "10 alunos extras por pacote",
      "Pacotes acumuláveis",
      "Alunos distribuídos entre todas as turmas",
      "Entregas sem consumir o limite diário do aluno",
      "Correções com o modelo mais avançado",
      "Insights e ranking por tarefa",
    ],
    cta: "Começar como professor",
    highlighted: true,
  },
];

const schoolPlan: Plan = {
  name: "Escola",
  price: { monthly: null, quarterly: null },
  quarterlyTotal: null,
  description: "Para escolas, cursinhos e coordenações que querem escalar a correção sem perder a visão de cada aluno.",
  audience: "Institucional",
  features: [
    { text: "Gestão de turmas e professores", included: true },
    { text: "Relatórios por competência e evolução", included: true },
    { text: "Banco de temas compartilhado", included: true },
    { text: "Correções em volume por turma", included: true },
    { text: "Acompanhamento individual", included: true },
    { text: "Onboarding personalizado", included: true },
  ],
  cta: "Falar com vendas",
  highlighted: false,
  consultation: true,
};

function formatPrice(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function PlanPrice({ plan, isQuarterly }: { plan: Plan; isQuarterly: boolean }) {
  if (plan.price.monthly === 0) {
    return (
      <div className="min-h-[5.25rem]">
        <p className="font-display text-5xl font-semibold leading-none text-ink">Grátis</p>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">para sempre</p>
      </div>
    );
  }

  const price = isQuarterly ? plan.price.quarterly : plan.price.monthly;

  return (
    <div className="min-h-[5.25rem]">
      <div className="flex items-end gap-1">
        <span className="mb-2 font-mono text-xs uppercase tracking-[0.1em] text-ink-muted">R$</span>
        <span className="relative block h-[3.75rem] min-w-[9.75rem] overflow-hidden font-display text-6xl font-semibold leading-none tracking-[-0.03em] text-ink">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              // Trocar a key recria apenas o número e permite animar a mudança
              // de período sem remontar o card nem perder foco nos controles.
              key={`${plan.name}-${isQuarterly}`}
              initial={{ opacity: 0, y: isQuarterly ? 18 : -18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: isQuarterly ? -18 : 18 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="absolute inset-0 tabular-nums"
            >
              {price ? formatPrice(price) : "—"}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="mb-2 font-mono text-xs uppercase tracking-[0.1em] text-ink-muted">/mês</span>
      </div>
      <p className="mt-3 font-mono text-[11px] uppercase leading-relaxed tracking-[0.08em] text-ink-muted">
        {isQuarterly
          ? `R$ ${formatPrice(plan.quarterlyTotal ?? 0)} cobrados a cada 3 meses`
          : `R$ ${formatPrice(plan.price.quarterly ?? 0)}/mês no trimestral`}
      </p>
    </div>
  );
}

function PlanCard({
  plan,
  index,
  isQuarterly,
  reduceMotion,
}: {
  plan: Plan;
  index: number;
  isQuarterly: boolean;
  reduceMotion: boolean;
}) {
  const href = plan.price.monthly === 0
    ? "/auth/register"
    : `/auth/login?redirect=${encodeURIComponent(`/checkout/${plan.name.toLowerCase()}?periodo=${isQuarterly ? "trimestral" : "mensal"}`)}`;

  return (
    <motion.article
      initial={reduceMotion ? false : { y: 20 }}
      whileInView={reduceMotion ? undefined : { y: plan.highlighted ? -16 : 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ type: "spring", stiffness: 105, damping: 22, delay: index * 0.08 }}
      className={cn(
        "relative flex min-w-0 flex-col border border-ink-line bg-paper p-6 sm:p-8 lg:min-h-[43rem]",
        plan.highlighted
          ? "z-10 border-accent bg-[#fffdf9] shadow-card lg:pb-10"
          : "lg:mt-5 lg:scale-[0.97]"
      )}
    >
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", plan.highlighted ? "bg-accent" : "bg-ink-line")} />

      {plan.highlighted && (
        <div className="absolute right-0 top-0 flex items-center gap-1.5 bg-accent px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-paper">
          <Star className="size-3.5 fill-current" aria-hidden />
          Mais escolhido
        </div>
      )}

      <header className="border-b border-dashed border-ink-line pb-7 pt-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">{plan.audience}</p>
        <h3 className="mt-3 font-display text-3xl font-semibold text-ink">{plan.name}</h3>
        <p className="mt-3 min-h-[3rem] text-[15px] leading-relaxed text-ink-soft">{plan.description}</p>
      </header>

      <div className="py-7">
        <PlanPrice plan={plan} isQuarterly={isQuarterly} />
      </div>

      <Link
        href={href}
        className={cn(
          "mb-8 inline-flex min-h-12 w-full items-center justify-center px-5 text-center font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
          plan.highlighted
            ? "bg-accent text-paper hover:bg-accent-deep"
            : "bg-ink text-paper hover:bg-ink-soft"
        )}
      >
        {plan.cta}
      </Link>

      <ul className="mt-auto space-y-3.5" aria-label={`Recursos do plano ${plan.name}`}>
        {plan.features.map((feature) => (
          <li key={feature.text} className="flex items-start gap-3 text-sm">
            {feature.included ? (
              <Check className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2.25} aria-hidden />
            ) : (
              <Minus className="mt-0.5 size-4 shrink-0 text-ink-muted/50" aria-hidden />
            )}
            <span className={cn("leading-snug", feature.included ? "text-ink-soft" : "text-ink-muted line-through decoration-ink-line")}>
              {feature.text}
            </span>
          </li>
        ))}
      </ul>
    </motion.article>
  );
}

function TeacherOfferCard({ offer }: { offer: TeacherOffer }) {
  return (
    <article
      className={cn(
        "relative flex min-w-0 flex-col border bg-paper p-6 sm:p-8 lg:min-h-[35rem]",
        offer.highlighted
          ? "border-accent bg-[#fffdf9] shadow-card"
          : "border-ink-line",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          offer.highlighted ? "bg-accent" : "bg-ink-line",
        )}
      />

      {offer.highlighted && (
        <div className="absolute right-0 top-0 flex items-center gap-1.5 bg-accent px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-paper">
          <Star className="size-3.5 fill-current" aria-hidden />
          Expanda quando precisar
        </div>
      )}

      <header className="border-b border-dashed border-ink-line pb-7 pt-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
          {offer.audience}
        </p>
        <h3 className="mt-3 font-display text-3xl font-semibold text-ink">
          {offer.name}
        </h3>
        <p className="mt-3 min-h-[3rem] text-[15px] leading-relaxed text-ink-soft">
          {offer.description}
        </p>
      </header>

      <div className="py-7">
        <p className="font-display text-5xl font-semibold leading-none tracking-[-0.03em] text-ink">
          {offer.price}
        </p>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">
          {offer.period}
        </p>
      </div>

      <Link
        href="/auth/register?type=teacher"
        className={cn(
          "mb-8 inline-flex min-h-12 w-full items-center justify-center px-5 text-center font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
          offer.highlighted
            ? "bg-accent text-paper hover:bg-accent-deep"
            : "bg-ink text-paper hover:bg-ink-soft",
        )}
      >
        {offer.cta}
      </Link>

      <ul className="mt-auto space-y-3.5" aria-label={`Recursos do ${offer.name}`}>
        {offer.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-ink-soft">
            <Check
              className="mt-0.5 size-4 shrink-0 text-accent"
              strokeWidth={2.25}
              aria-hidden
            />
            <span className="leading-snug">{feature}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function Pricing() {
  const [audience, setAudience] = useState<PricingAudience>("student");
  const [isQuarterly, setIsQuarterly] = useState(false);
  const reduceMotion = useHydratedReducedMotion();

  return (
    <section id="planos" className="section-padding border-t border-ink-line bg-paper">
      <div className="container-site">
        <header className="mx-auto mb-14 max-w-3xl text-center lg:mb-20">
          <p className="eyebrow mb-5">§ VI — Planos</p>
          <h2 className="text-balance font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-ink sm:text-5xl lg:text-6xl">
            {audience === "student"
              ? "Escolha o ritmo da sua evolução."
              : "Escolha o espaço que suas turmas precisam."}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
            {audience === "student"
              ? "Comece grátis e aumente o volume quando a sua rotina pedir. Sem cartão no plano Free."
              : "Comece gratuitamente com turmas menores e adicione pacotes de alunos conforme sua operação crescer."}
          </p>

          <div
            className="mt-9 inline-grid grid-cols-2 border border-ink bg-paper p-1"
            role="group"
            aria-label="Planos para"
          >
            <button
              type="button"
              onClick={() => setAudience("student")}
              aria-pressed={audience === "student"}
              className={cn(
                "min-h-11 whitespace-nowrap px-3 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:px-5 sm:text-xs sm:tracking-[0.12em]",
                audience === "student" ? "bg-ink text-paper" : "text-ink-muted hover:text-ink",
              )}
            >
              Para alunos
            </button>
            <button
              type="button"
              onClick={() => setAudience("teacher")}
              aria-pressed={audience === "teacher"}
              className={cn(
                "min-h-11 whitespace-nowrap px-3 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:px-5 sm:text-xs sm:tracking-[0.12em]",
                audience === "teacher" ? "bg-ink text-paper" : "text-ink-muted hover:text-ink",
              )}
            >
              Para professores
            </button>
          </div>

          {audience === "student" && (
            <div
              className="mt-4 inline-grid grid-cols-2 border border-ink-line bg-paper-deep p-1"
              role="group"
              aria-label="Período de cobrança"
            >
              <button
                type="button"
                onClick={() => setIsQuarterly(false)}
                aria-pressed={!isQuarterly}
                className={cn(
                  "min-h-10 px-5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  !isQuarterly ? "bg-ink text-paper" : "text-ink-muted hover:text-ink",
                )}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setIsQuarterly(true)}
                aria-pressed={isQuarterly}
                className={cn(
                  "min-h-10 px-5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  isQuarterly ? "bg-ink text-paper" : "text-ink-muted hover:text-ink",
                )}
              >
                Trimestral
              </button>
            </div>
          )}
        </header>

        <div aria-live="polite">
          {audience === "student" ? (
            <div className="grid gap-4 lg:grid-cols-3 lg:gap-0 lg:px-5 lg:pt-4">
              {studentPlans.map((plan, index) => (
                <PlanCard
                  key={plan.name}
                  plan={plan}
                  index={index}
                  isQuarterly={isQuarterly}
                  reduceMotion={reduceMotion}
                />
              ))}
            </div>
          ) : (
            <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2">
              {teacherOffers.map((offer) => (
                <TeacherOfferCard key={offer.name} offer={offer} />
              ))}
            </div>
          )}
        </div>

        {audience === "teacher" && (
          <motion.article
            initial={reduceMotion ? false : { transform: "translateY(14px)" }}
            whileInView={reduceMotion ? undefined : { transform: "translateY(0)" }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="mt-8 grid gap-8 border border-ink-line bg-paper-deep p-7 sm:p-9 lg:grid-cols-[1.1fr_1.4fr_auto] lg:items-center lg:gap-12"
          >
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{schoolPlan.audience}</p>
              <h3 className="mt-2 font-display text-3xl font-semibold text-ink">{schoolPlan.name}</h3>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-soft">{schoolPlan.description}</p>
            </div>
            <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2" aria-label="Recursos do plano Escola">
              {schoolPlan.features.map((feature) => (
                <li key={feature.text} className="flex items-start gap-2.5 text-sm text-ink-soft">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2.25} aria-hidden />
                  <span>{feature.text}</span>
                </li>
              ))}
            </ul>
            <div className="lg:text-right">
              <p className="mb-4 font-display text-2xl font-semibold text-ink">Sob consulta</p>
              <Link
                href="mailto:vendas@redator.app?subject=Solicita%C3%A7%C3%A3o%20de%20plano%20institucional"
                className="inline-flex min-h-12 items-center justify-center bg-ink px-6 font-semibold text-paper transition-colors hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                {schoolPlan.cta}
              </Link>
            </div>
          </motion.article>
        )}

        <footer className="mx-auto mt-10 flex max-w-4xl flex-col items-center justify-between gap-4 text-sm text-ink-muted sm:flex-row">
          <p className="font-mono text-[11px] uppercase tracking-[0.09em]">
            {audience === "student"
              ? "7 dias de garantia · cancelamento sem complicação"
              : "Pacotes acumuláveis · cancele quando quiser"}
          </p>
          <button
            type="button"
            onClick={() => setAudience(audience === "student" ? "teacher" : "student")}
            className="link-underline font-medium text-accent hover:text-accent-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {audience === "student"
              ? "É professor? Veja seus planos →"
              : "É aluno? Veja seus planos →"}
          </button>
        </footer>
      </div>
    </section>
  );
}
