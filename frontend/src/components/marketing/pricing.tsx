"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X, Zap, Star } from "lucide-react";
import { cn } from "@/lib/utils";

type Plan = {
  name: string;
  price: { monthly: number; yearly: number };
  description: string;
  badge?: string;
  features: { text: string; included: boolean }[];
  cta: string;
  highlighted: boolean;
};

const plans: Plan[] = [
  {
    name: "Free",
    price: { monthly: 0, yearly: 0 },
    description: "Para quem está começando a praticar redações.",
    features: [
      { text: "1 correção por dia", included: true },
      { text: "Foto → Texto (OCR)", included: true },
      { text: "Análise por competências", included: true },
      { text: "Feedback básico e consistente", included: true },
      { text: "Modelos ENEM e Vestibular", included: true },
      { text: "Grifes no texto (bom/ruim)", included: false },
      { text: "Análise avançada com insights", included: false },
      { text: "Simulados completos", included: false },
      { text: "Retrospecto geral de evolução", included: false },
      { text: "Suporte prioritário", included: false },
    ],
    cta: "Começar grátis",
    highlighted: false,
  },
  {
    name: "Standard",
    price: { monthly: 29.9, yearly: 24.9 },
    description: "Para quem está estudando sério para ENEM ou vestibular.",
    badge: "Mais popular",
    features: [
      { text: "3 correções por dia", included: true },
      { text: "Foto → Texto (OCR)", included: true },
      { text: "Análise por competências", included: true },
      { text: "Feedback avançado e detalhado", included: true },
      { text: "Modelos ENEM e Vestibular", included: true },
      { text: "Grifes no texto (bom/ruim)", included: true },
      { text: "Análise avançada com insights", included: true },
      { text: "Simulados completos", included: true },
      { text: "Retrospecto geral de evolução", included: true },
      { text: "Suporte prioritário", included: false },
    ],
    cta: "Assinar Standard",
    highlighted: true,
  },
  {
    name: "Pro",
    price: { monthly: 59.9, yearly: 49.9 },
    description: "Para quem não pode se dar ao luxo de perder tempo.",
    features: [
      { text: "Correções ilimitadas", included: true },
      { text: "Foto → Texto (OCR)", included: true },
      { text: "Análise por competências", included: true },
      { text: "Feedback avançado e detalhado", included: true },
      { text: "Modelos ENEM e Vestibular", included: true },
      { text: "Grifes no texto (bom/ruim)", included: true },
      { text: "Análise avançada com insights", included: true },
      { text: "Simulados completos", included: true },
      { text: "Retrospecto geral de evolução", included: true },
      { text: "Suporte prioritário", included: true },
    ],
    cta: "Assinar Pro",
    highlighted: false,
  },
];

export function Pricing() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section id="planos" className="section-padding bg-white">
      <div className="container-site">

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-sm font-semibold text-brand-600 uppercase tracking-widest mb-3">
            Planos
          </p>
          <h2 className="font-display font-bold text-4xl lg:text-5xl text-slate-900 mb-4">
            Invista na sua nota.
            <br />
            <span className="text-gradient">Comece grátis.</span>
          </h2>
          <p className="text-lg text-slate-500 mb-8">
            Sem surpresas. Cancele quando quiser.
          </p>

          {/* Toggle mensal/anual */}
          <div className="inline-flex items-center gap-3 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setIsYearly(false)}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-medium transition-all",
                !isYearly
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Mensal
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                isYearly
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Anual
              <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                −17%
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
              {/* Badge */}
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
                <h3 className={cn(
                  "font-display font-bold text-lg mb-1",
                  plan.highlighted ? "text-white" : "text-slate-900"
                )}>
                  {plan.name}
                </h3>
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
                        {isYearly
                          ? plan.price.yearly.toFixed(2).replace(".", ",")
                          : plan.price.monthly.toFixed(2).replace(".", ",")}
                      </span>
                      <span className={cn(
                        "text-sm mb-1",
                        plan.highlighted ? "text-brand-200" : "text-slate-400"
                      )}>
                        /mês
                      </span>
                    </div>
                    {isYearly && (
                      <p className={cn(
                        "text-xs mt-1",
                        plan.highlighted ? "text-brand-200" : "text-slate-400"
                      )}>
                        cobrado anualmente
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* CTA */}
              <Link
                href={plan.price.monthly === 0 ? "/auth/register" : `/checkout/${plan.name.toLowerCase()}`}
                className={cn(
                  "w-full text-center font-semibold py-3 rounded-xl mb-8 transition-all duration-200",
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
                        "w-4.5 h-4.5 shrink-0 mt-0.5",
                        plan.highlighted ? "text-brand-300" : "text-brand-600"
                      )} strokeWidth={2.5} />
                    ) : (
                      <X className={cn(
                        "w-4.5 h-4.5 shrink-0 mt-0.5",
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

        {/* Nota de rodapé */}
        <p className="text-center text-sm text-slate-400 mt-10">
          Todos os planos incluem ENEM e Vestibular. Cancele a qualquer momento, sem multa.
        </p>
      </div>
    </section>
  );
}
