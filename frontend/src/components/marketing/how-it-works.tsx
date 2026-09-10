"use client";

import { motion } from "framer-motion";

const steps = [
  {
    number: "I",
    title: "Envie sua redação",
    description:
      "Digite o texto ou envie uma foto da folha. Antes da correção, você pode revisar o texto reconhecido.",
    detail: "Texto digitado ou foto (JPG/PNG) — até 5 MB",
  },
  {
    number: "II",
    title: "A análise percorre cada competência",
    description:
      "Escolha ENEM ou vestibular. Cada critério recebe uma nota e uma explicação objetiva.",
    detail: "Resultado em ~30 segundos",
  },
  {
    number: "III",
    title: "Revise e acompanhe sua evolução",
    description:
      "Use as grifes para reescrever os trechos mais fracos e compare o desempenho das próximas redações.",
    detail: "Grifes, histórico e próximos passos",
  },
];

const fadeUp = {
  initial: { opacity: 0, transform: "translateY(16px)" },
  whileInView: { opacity: 1, transform: "translateY(0)" },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] },
};

const stamp = {
  initial: { opacity: 0, transform: "scale(0.95)" },
  whileInView: { opacity: 1, transform: "scale(1)" },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] },
};

export function HowItWorks() {
  return (
    <section id="como-funciona" className="section-padding bg-paper border-t border-ink-line">
      <div className="container-site">

        <motion.header {...fadeUp} className="mb-14 lg:mb-16 max-w-3xl">
          <h2 className="font-display font-semibold text-4xl sm:text-5xl lg:text-6xl text-ink leading-[1.05] tracking-[-0.01em] text-balance">
            Envie. Receba o diagnóstico. Evolua.
          </h2>
        </motion.header>

        <ol className="space-y-0 divide-y divide-ink-line border-y border-ink-line">

          {steps.map((step, idx) => (
            <motion.li
              key={step.number}
              {...fadeUp}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] as [number, number, number, number], delay: idx * 0.08 }}
              className="grid grid-cols-12 gap-6 lg:gap-10 py-8 lg:py-10 group"
            >
              {/* Número romano */}
              <div className="col-span-2 sm:col-span-1">
                <motion.span
                  {...stamp}
                  transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] as [number, number, number, number], delay: idx * 0.08 + 0.1 }}
                  className="font-display italic font-medium text-6xl lg:text-7xl text-paper-deep leading-none block group-hover:text-accent-light transition-colors duration-300"
                >
                  {step.number}
                </motion.span>
              </div>

              {/* Título e descrição */}
              <div className="col-span-10 sm:col-span-7">
                <h3 className="font-display font-semibold text-2xl lg:text-3xl text-ink mb-3 leading-tight">
                  {step.title}
                </h3>
                <p className="text-ink-soft leading-[1.6] max-w-xl text-[16px]">
                  {step.description}
                </p>
              </div>

              {/* Detalhe mono */}
              <div className="col-span-12 sm:col-span-4 sm:pl-6 sm:border-l border-ink-line flex sm:items-end">
                <p className="font-mono text-[13px] text-ink-muted leading-relaxed uppercase tracking-[0.08em]">
                  {step.detail}
                </p>
              </div>
            </motion.li>
          ))}
        </ol>

      </div>
    </section>
  );
}
