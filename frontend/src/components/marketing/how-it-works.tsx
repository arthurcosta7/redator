"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const steps = [
  {
    number: "I",
    title: "Envie sua redação",
    description:
      "Digite o texto ou tire uma foto da redação manuscrita. A tecnologia OCR reconhece a maior parte das letras manuscritas, incluindo cursiva. Letra muito apertada ou ilegível pode exigir revisão manual do texto extraído antes de enviar.",
    detail: "Texto digitado ou foto (JPG/PNG) — até 5 MB",
  },
  {
    number: "II",
    title: "A análise percorre cada competência",
    description:
      "A redação é avaliada nos critérios do ENEM ou da banca de vestibular escolhida. Cada competência recebe nota individual e comentário específico.",
    detail: "Resultado em ~30 segundos",
  },
  {
    number: "III",
    title: "Você evolui de verdade",
    description:
      "Nota por competência, grife nos trechos que funcionam e nos que travam, e um plano claro para a próxima redação. Você sabe exatamente o que melhorar — em vez de adivinhar.",
    detail: "Grifes, insights, histórico e comparativo de evolução",
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

        <motion.header {...fadeUp} className="mb-20 lg:mb-24 max-w-3xl">
          <p className="eyebrow mb-5">§ II — Como funciona</p>
          <h2 className="font-display font-semibold text-4xl sm:text-5xl lg:text-6xl text-ink leading-[1.05] tracking-[-0.01em] text-balance">
            Três passos, menos de um minuto.
          </h2>
        </motion.header>

        <ol className="space-y-0 divide-y divide-ink-line border-y border-ink-line">

          {steps.map((step, idx) => (
            <motion.li
              key={step.number}
              {...fadeUp}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] as [number, number, number, number], delay: idx * 0.08 }}
              className="grid grid-cols-12 gap-6 lg:gap-10 py-10 lg:py-14 group"
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

        <motion.div {...fadeUp} className="mt-12 flex items-center gap-3">
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 text-ink font-semibold text-[17px] link-underline"
          >
            Começar grátis
            <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
