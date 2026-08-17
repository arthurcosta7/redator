"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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

const plans: Plan[] = [
  {
    name: "Free",
    price: { monthly: 0, quarterly: 0 },
    quarterlyTotal: 0,
    description: "Para conhecer e começar a praticar.",
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
    description: "Para quem estuda sério para ENEM ou vestibular.",
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
    description: "Para quem quer mais volume e velocidade no treino.",
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
  {
    name: "Escola",
    price: { monthly: null, quarterly: null },
    quarterlyTotal: null,
    description: "Para escolas, cursinhos e coordenações que querem escalar correção em massa.",
    audience: "Institucional",
    features: [
      { text: "Gestão de turmas e acessos por professor", included: true },
      { text: "Relatórios agregados por competência e evolução", included: true },
      { text: "Banco de temas compartilhado", included: true },
      { text: "Correções em volume por turma", included: true },
      { text: "Acompanhamento de desempenho por aluno", included: true },
      { text: "Atendimento e onboarding customizado", included: true },
    ],
    cta: "Falar com vendas",
    highlighted: false,
    consultation: true,
  },
];

export function Pricing() {
  const [isQuarterly, setIsQuarterly] = useState(false);

  return (
    <section id="planos" className="section-padding bg-paper border-t border-ink-line">
      <div className="container-site">

        {/* Cabeçalho centralizado */}
        <header className="text-center max-w-2xl mx-auto mb-16 lg:mb-20">
          <p className="eyebrow mb-5">§ VI — Planos</p>
          <h2 className="font-display font-medium text-4xl sm:text-5xl lg:text-6xl text-ink leading-[1.05] tracking-[-0.01em] mb-5 text-balance">
            Comece grátis. Sem cartão.
          </h2>
          <p className="text-lg text-ink-soft mb-10">
            Pague só quando precisar de mais.
          </p>

          {/* Toggle — links com underline animado, não botões em pill */}
          <div className="inline-flex items-center gap-6 font-mono text-[13px] uppercase tracking-[0.15em]">
            <button
              onClick={() => setIsQuarterly(false)}
              className={cn(
                "link-underline transition-colors",
                !isQuarterly ? "text-ink" : "text-ink-muted hover:text-ink-soft"
              )}
            >
              Mensal
            </button>
            <span className="text-ink-line">·</span>
            <button
              onClick={() => setIsQuarterly(true)}
              className={cn(
                "link-underline transition-colors flex items-center gap-2",
                isQuarterly ? "text-ink" : "text-ink-muted hover:text-ink-soft"
              )}
            >
              Trimestral
              <span className="bg-accent-light text-accent-deep px-2 py-0.5 rounded text-[10px] font-semibold">
                −10%
              </span>
            </button>
          </div>
        </header>

        {/* Cards de plano — sem rounded-2xl, com borda accent lateral no destaque */}
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-0 border border-ink-line">

          {plans.map((plan, idx) => (
            <motion.article
              key={plan.name}
              initial={{ opacity: 0, transform: "translateY(16px)" }}
              whileInView={{ opacity: 1, transform: "translateY(0)" }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: idx * 0.08, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }}
              whileHover={plan.highlighted ? { backgroundColor: "#FAF7F2" } : undefined}
              className={cn(
                "relative p-8 lg:p-10 flex flex-col bg-paper transition-colors duration-300",
                idx > 0 && "border-t md:border-t-0 md:border-l border-ink-line",
                plan.highlighted && "bg-paper-deep"
              )}
            >
              {/* Borda accent vertical no plano destacado — com pulse sutil */}
              {plan.highlighted && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-accent pulse-accent" />
              )}

              {/* Header do plano */}
              <header className="mb-8">
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <h3 className={cn(
                    "font-display font-medium text-2xl text-ink"
                  )}>
                    {plan.name}
                  </h3>
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-muted whitespace-nowrap">
                    {plan.audience}
                  </span>
                </div>
                <p className="text-ink-soft text-[15px] leading-relaxed">
                  {plan.description}
                </p>
              </header>

              {/* Preço */}
              <div className="mb-8 pb-8 border-b border-ink-line">
                {plan.consultation ? (
                  <div>
                    <p className="font-display italic font-medium text-4xl text-ink leading-none">
                      Sob consulta
                    </p>
                    <p className="font-mono text-xs text-ink-muted uppercase tracking-[0.12em] mt-2">
                      Personalizado
                    </p>
                  </div>
                ) : plan.price.monthly === 0 ? (
                  <div>
                    <p className="font-display italic font-medium text-5xl text-ink leading-none">
                      Grátis
                    </p>
                    <p className="font-mono text-xs text-ink-muted uppercase tracking-[0.12em] mt-2">
                      Para sempre
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-xs text-ink-muted uppercase tracking-[0.1em]">
                        R$
                      </span>
                      <span className="font-display font-medium text-6xl text-ink leading-[0.95] tracking-[-0.02em]">
                        {(isQuarterly
                          ? plan.price.quarterly
                          : plan.price.monthly
                        )?.toFixed(2).replace(".", ",")}
                      </span>
                      <span className="font-mono text-xs text-ink-muted uppercase tracking-[0.1em] ml-1">
                        /mês
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-ink-muted uppercase tracking-[0.1em] mt-3 leading-relaxed">
                      {isQuarterly ? (
                        <>R$ {plan.quarterlyTotal?.toFixed(2).replace(".", ",")} cobrado a cada 3 meses</>
                      ) : (
                        <>ou R$ {plan.price.quarterly?.toFixed(2).replace(".", ",")} no trimestral −10%</>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* CTA */}
              <Link
                href={plan.consultation
                  ? "mailto:vendas@redator.app?subject=Solicita%C3%A7%C3%A3o%20de%20plano%20institucional"
                  : plan.price.monthly === 0
                    ? "/auth/register"
                    : `/auth/login?redirect=${encodeURIComponent(`/checkout/${plan.name.toLowerCase()}?periodo=${isQuarterly ? "trimestral" : "mensal"}`)}`
                }
                className={cn(
                  "w-full text-center font-semibold py-3.5 mb-8 transition-colors block",
                  plan.highlighted
                    ? "bg-accent hover:bg-accent-deep text-paper"
                    : "bg-ink hover:bg-ink-soft text-paper"
                )}
              >
                {plan.cta}
              </Link>

              {/* Lista de features */}
              <ul className="space-y-3.5 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature.text} className="flex items-start gap-3 text-[14px]">
                    <span className={cn(
                      "font-mono text-xs mt-1 shrink-0 w-4",
                      feature.included ? "text-accent" : "text-ink-muted/40"
                    )}>
                      {feature.included ? "+" : "−"}
                    </span>
                    <span className={cn(
                      "leading-snug",
                      feature.included ? "text-ink" : "text-ink-muted line-through decoration-1 decoration-ink-muted/30"
                    )}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.article>
          ))}
        </div>

        {/* Rodapé */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4
                        max-w-3xl mx-auto text-sm text-ink-muted">
          <p className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.1em]">
            7 dias de garantia &nbsp;·&nbsp; cancelamento sem complicação
          </p>
          <Link
            href="/auth/register?type=teacher"
            className="text-accent hover:text-accent-deep font-medium link-underline text-[14px]"
          >
            É professor? Acesso gratuito →
          </Link>
        </div>

      </div>
    </section>
  );
}
