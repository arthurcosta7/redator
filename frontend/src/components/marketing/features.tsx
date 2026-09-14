"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { FeatureOverview } from "./feature-overview";

const evaluationModels = [
  {
    name: "ENEM",
    description: "Nota de 0 a 1.000, dividida nas cinco competências oficiais.",
    criteria: [
      "Domínio da língua portuguesa",
      "Desenvolvimento do tema",
      "Seleção de argumentos",
      "Coesão e coerência",
      "Proposta de intervenção",
    ],
  },
  {
    name: "Vestibular tradicional",
    description: "Escala pedagógica normalizada de 0 a 100; não equivale à nota oficial de cada banca.",
    criteria: [
      "Adequação ao tema e ao gênero",
      "Desenvolvimento e argumentação",
      "Coesão e coerência textual",
      "Adequação da linguagem",
    ],
  },
];

const teacherBenefits = [
  "Turmas e tarefas no mesmo painel",
  "Relatórios por aluno e competência",
  "Banco de temas com prazos de entrega",
];

const fadeUp = {
  initial: { opacity: 0, transform: "translateY(16px)" },
  whileInView: { opacity: 1, transform: "translateY(0)" },
  viewport: { once: true, margin: "-80px" },
  transition: {
    duration: 0.5,
    ease: [0.23, 1, 0.32, 1] as [number, number, number, number],
  },
};

export function Features() {
  return (
    <section id="funcionalidades" className="section-padding bg-paper-deep">
      <div className="container-site">
        <motion.header {...fadeUp} className="mb-14 max-w-3xl lg:mb-16">
          <h2 className="font-display text-4xl font-semibold leading-[1.05] tracking-[-0.01em] text-ink text-balance sm:text-5xl lg:text-6xl">
            Veja o erro, entenda a nota e saiba o próximo passo.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
            Uma única correção reúne o que você precisa para revisar o texto e escrever melhor na próxima tentativa.
          </p>
        </motion.header>

        <motion.div {...fadeUp}>
          <FeatureOverview />
        </motion.div>

        <motion.div
          {...fadeUp}
          className="mt-16 grid gap-10 border-y border-ink-line py-10 lg:mt-20 lg:grid-cols-12 lg:items-center lg:gap-14 lg:py-12"
        >
          <div className="lg:col-span-5">
            <h3 className="font-display text-3xl font-semibold leading-tight text-ink lg:text-4xl">
              Corrija no modelo da sua prova.
            </h3>
            <p className="mt-4 max-w-lg leading-relaxed text-ink-soft">
              Escolha ENEM ou vestibular antes de enviar. Os detalhes ficam disponíveis quando você precisar comparar os critérios.
            </p>
          </div>

          <div className="lg:col-span-7">
            {evaluationModels.map((model) => (
              <details key={model.name} className="group border-t border-ink-line first:border-t-0">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <span>
                    <span className="block font-display text-xl font-semibold text-ink">
                      {model.name}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-ink-muted">
                      {model.description}
                    </span>
                  </span>
                  <ChevronDown
                    className="size-5 shrink-0 text-accent transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <ul className="grid gap-2 pb-5 sm:grid-cols-2" aria-label={`Critérios do modelo ${model.name}`}>
                  {model.criteria.map((criterion) => (
                    <li key={criterion} className="flex items-start gap-2 text-sm text-ink-soft">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2.25} aria-hidden />
                      <span>{criterion}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </motion.div>

        <motion.div
          id="professores"
          {...fadeUp}
          className="mt-16 scroll-mt-24 bg-ink px-6 py-9 text-paper sm:px-9 lg:mt-20 lg:grid lg:grid-cols-12 lg:items-center lg:gap-12 lg:px-12 lg:py-11"
        >
          <div className="lg:col-span-5">
            <h3 className="font-display text-3xl font-semibold leading-tight lg:text-4xl">
              Uma rotina mais leve para professores.
            </h3>
            <p className="mt-4 max-w-lg leading-relaxed text-paper/70">
              Comece grátis com até três alunos ativos no total. Turmas continuam ilimitadas.
            </p>
          </div>

          <div className="mt-8 lg:col-span-4 lg:mt-0">
            <ul className="space-y-3">
              {teacherBenefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-paper/80">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent-light" strokeWidth={2.25} aria-hidden />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 lg:col-span-3 lg:mt-0 lg:text-right">
            <Link
              href="/professores"
              className="inline-flex min-h-12 items-center justify-center gap-2 bg-accent px-6 font-semibold text-paper transition-colors hover:bg-accent-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-light focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Conhecer a plataforma docente
              <ArrowRight className="size-4" strokeWidth={2.25} aria-hidden />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
