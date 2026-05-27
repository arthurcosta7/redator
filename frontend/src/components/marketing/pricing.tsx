"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X, Star, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

type Plan = {
  name: string;
  price: { monthly: number; quarterly: number };
  quarterlyTotal: number;
  description: string;
  badge?: string;
  features: { text: string; included: boolean }[];
  cta: string;
  highlighted: boolean;
  audience: string;
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
      { text: "Foto → Texto (OCR)", included: true },
      { text: "Análise por competências", included: true },
      { text: "Feedback básico", included: true },
      { text: "Modelos ENEM e Vestibular", included: true },
      { text: "Sistema de correção aprimorado", included: false },
      { text: "Grifes no texto (bom/ruim)", included: false },
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
    badge: "Mais popular",
    audience: "ENEM & Vestibular",
    features: [
      { text: "3 correções por dia", included: true },
      { text: "Foto → Texto (OCR)", included: true },
      { text: "Análise por competências", included: true },
      { text: "Feedback avançado e detalhado", included: true },
      { text: "Modelos ENEM e Vestibular", included: true },
      { text: "Sistema de correção aprimorado", included: true },
      { text: "Grifes no texto (bom/ruim)", included: true },
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
    description: "Para quem não pode perder tempo. Correções sem limite.",
    audience: "Alta performance",
    features: [
      { text: "10 correções por dia", included: true },
      { text: "Foto → Texto (OCR)", included: true },
      { text: "Análise por competências", included: true },
      { text: "Feedback avançado e detalhado", included: true },
      { text: "Modelos ENEM e Vestibular", included: true },
      { text: "Sistema de correção aprimorado", included: true },
      { text: "Grifes no texto (bom/ruim)", included: true },
      { text: "Insights avançados de melhoria", included: true },
      { text: "Histórico completo de evolução", included: true },
      { text: "Suporte prioritário", included: true },
    ],
    cta: "Assinar Pro",
    highlighted: false,
  },
];

export function Pricing() {
  const [isQuarterly, setIsQuarterly] = useState(false);

  return (
    <section id="planos" className="section-padding bg-white">
      <div className="container-site">

        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-12">
          <h2 className="font-display font-bold text-4xl lg:text-5xl text-slate-900 mb-4">
            Planos
          </h2>
          <p className="text-lg text-slate-500 mb-8">
            Comece grátis. Sem cartão de crédito.
          </p>

          {/* Toggle mensal/trimestral */}
          <div className="inline-flex items-center gap-3 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setIsQuarterly(false)}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-medium transition-all",
                !isQuarterly
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Mensal
            </button>
            <button
              onClick={() => setIsQuarterly(true)}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                isQuarterly
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Trimestral
              <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                −10%
              </span>
            </button>
          </div>
        </div>

        {/* Cards de plano */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative rounded-2xl border p-8 flex flex-col transition-all duration-300",
                plan.highlighted
                  ? "bg-brand-700 border-brand-700 shadow-brand-lg scale-[1.02]"
                  : "bg-white border-slate-200 shadow-card hover:shadow-card-hover"
              )}
            >
              {/* Badge "Mais popular" */}
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1.5 bg-amber-400 text-slate-900
                                  text-xs font-bold px-4 py-1.5 rounded-full shadow-sm">
                    <Star className="w-3 h-3 fill-slate-900" />
                    {plan.badge}
                  </div>
                </div>
              )}

              {/* Header do plano */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className={cn(
                    "font-display font-bold text-lg",
                    plan.highlighted ? "text-white" : "text-slate-900"
                  )}>
                    {plan.name}
                  </h3>
                  <span className={cn(
                    "text-xs font-medium px-2.5 py-1 rounded-full",
                    plan.highlighted
                      ? "bg-brand-600 text-brand-200"
                      : "bg-slate-100 text-slate-500"
                  )}>
                    {plan.audience}
                  </span>
                </div>
                <p className={cn(
                  "text-sm",
                  plan.highlighted ? "text-brand-200" : "text-slate-500"
                )}>
                  {plan.description}
                </p>
              </div>

              {/* Preço */}
              <div className="mb-8">
                {plan.price.monthly === 0 ? (
                  <div>
                    <span className={cn(
                      "font-display font-bold text-4xl",
                      plan.highlighted ? "text-white" : "text-slate-900"
                    )}>
                      Grátis
                    </span>
                    <p className={cn(
                      "text-sm mt-1",
                      plan.highlighted ? "text-brand-200" : "text-slate-400"
                    )}>
                      Para sempre
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-end gap-1">
                      <span className={cn(
                        "text-sm font-medium",
                        plan.highlighted ? "text-brand-200" : "text-slate-400"
                      )}>
                        R$
                      </span>
                      <span className={cn(
                        "font-display font-bold text-4xl leading-none",
                        plan.highlighted ? "text-white" : "text-slate-900"
                      )}>
                        {(isQuarterly
                          ? plan.price.quarterly
                          : plan.price.monthly
                        ).toFixed(2).replace(".", ",")}
                      </span>
                      <span className={cn(
                        "text-sm mb-1",
                        plan.highlighted ? "text-brand-200" : "text-slate-400"
                      )}>
                        /mês
                      </span>
                    </div>
                    {isQuarterly ? (
                      <p className={cn(
                        "text-xs mt-1.5",
                        plan.highlighted ? "text-brand-300" : "text-slate-400"
                      )}>
                        R$ {plan.quarterlyTotal.toFixed(2).replace(".", ",")} cobrado a cada 3 meses
                      </p>
                    ) : (
                      <p className={cn(
                        "text-xs mt-1.5",
                        plan.highlighted ? "text-brand-300" : "text-slate-400"
                      )}>
                        ou R$ {plan.price.quarterly.toFixed(2).replace(".", ",")}
                        <span className="text-green-500 font-semibold"> −10%</span> no trimestral
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* CTA */}
              <Link
                href={plan.price.monthly === 0 ? "/auth/register" : `/checkout/${plan.name.toLowerCase()}?periodo=${isQuarterly ? "trimestral" : "mensal"}`}
                className={cn(
                  "w-full text-center font-semibold py-3 rounded-xl mb-8 transition-all duration-200 block",
                  plan.highlighted
                    ? "bg-white text-brand-700 hover:bg-brand-50 shadow-sm"
                    : "bg-brand-700 text-white hover:bg-brand-800 shadow-brand hover:shadow-brand-lg"
                )}
              >
                {plan.cta}
              </Link>

              {/* Divisor */}
              <div className={cn(
                "border-t mb-6",
                plan.highlighted ? "border-brand-600" : "border-slate-100"
              )} />

              {/* Features */}
              <ul className="space-y-3 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature.text} className="flex items-start gap-3">
                    {feature.included ? (
                      <Check className={cn(
                        "w-4 h-4 shrink-0 mt-0.5",
                        plan.highlighted ? "text-brand-300" : "text-brand-600"
                      )} strokeWidth={2.5} />
                    ) : (
                      <X className={cn(
                        "w-4 h-4 shrink-0 mt-0.5",
                        plan.highlighted ? "text-brand-600" : "text-slate-300"
                      )} strokeWidth={2} />
                    )}
                    <span className={cn(
                      "text-sm leading-tight",
                      feature.included
                        ? plan.highlighted ? "text-brand-100" : "text-slate-700"
                        : plan.highlighted ? "text-brand-500" : "text-slate-400"
                    )}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Rodapé */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4
                        max-w-2xl mx-auto">
          <p className="text-sm text-slate-400 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-green-500 shrink-0" />
            7 dias de garantia nos planos pagos. Cancelamento sem complicação.
          </p>
          <Link
            href="/auth/register?type=teacher"
            className="text-sm text-brand-600 hover:text-brand-700 font-medium whitespace-nowrap"
          >
            É professor? Acesso gratuito →
          </Link>
        </div>

      </div>
    </section>
  );
}
