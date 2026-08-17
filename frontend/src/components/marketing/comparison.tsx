"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const routine = [
  {
    step: "Domingo",
    title: "Escreva uma redação",
    description:
      "Comece pelo tema mais recente do ENEM ou pelo que o cursinho atribuiu. Mínimo de trinta linhas, sem consulta. Tempo total: uma hora.",
  },
  {
    step: "Logo depois",
    title: "Submeta na plataforma",
    description:
      "Texto digitado ou foto da folha manuscrita. Em ~30 segundos você recebe: nota por competência, grife nos trechos e comentário detalhado em cada um dos cinco critérios.",
  },
  {
    step: "No mesmo dia",
    title: "Revise com as grifes",
    description:
      "Leia o feedback. Vá trecho por trecho, reescreva as partes grifadas em vermelho, justifique por onde mudou. Guarde a nova versão.",
  },
  {
    step: "Toda semana",
    title: "Compare a evolução",
    description:
      "O histórico mostra a curva de cada competência. Você descobre em qual critério está estagnado — e onde a próxima hora de estudo vai render mais.",
  },
];

const fadeUp = {
  initial: { opacity: 0, transform: "translateY(16px)" },
  whileInView: { opacity: 1, transform: "translateY(0)" },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] },
};

export function Comparison() {
  return (
    <section className="section-padding bg-paper-deep border-t border-ink-line">
      <div className="container-site">

        {/* Cabeçalho */}
        <motion.header {...fadeUp} className="mb-16 lg:mb-20 grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-7">
            <p className="eyebrow mb-5">§ V — Método</p>
            <h2 className="font-display font-semibold text-4xl sm:text-5xl lg:text-6xl text-ink leading-[1.05] tracking-[-0.01em] text-balance">
              A rotina semanal que separa quem passa de quem fica pelo caminho.
            </h2>
          </div>
          <p className="lg:col-span-5 lg:pt-3 text-lg text-ink-soft leading-[1.6] font-sans">
            A plataforma não substitui o estudo — ela fecha o ciclo de feedback que estava faltando na sua rotina. Quatro passos, toda semana, e a nota sobe com consistência em vez de sorte.
          </p>
        </motion.header>

        {/* Lista numerada — sem cards coloridos, layout editorial */}
        <ol className="space-y-0 divide-y divide-ink-line border-y border-ink-line">

          {routine.map((item, idx) => (
            <motion.li
              key={item.title}
              initial={{ opacity: 0, transform: "translateY(12px)" }}
              whileInView={{ opacity: 1, transform: "translateY(0)" }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: idx * 0.07, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }}
              className="grid grid-cols-12 gap-6 lg:gap-10 py-10 lg:py-14"
            >
              {/* Etiqueta — dia/período em mono */}
              <div className="col-span-12 sm:col-span-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                  Passo 0{idx + 1}
                </p>
                <p className="font-display italic font-semibold text-2xl lg:text-3xl text-ink mt-2">
                  {item.step}
                </p>
              </div>

              {/* Conteúdo */}
              <div className="col-span-12 sm:col-span-9 sm:pl-6 sm:border-l border-ink-line">
                <h3 className="font-display font-semibold text-2xl lg:text-3xl text-ink mb-3 leading-tight">
                  {item.title}
                </h3>
                <p className="text-ink-soft leading-[1.6] max-w-2xl text-[16px]">
                  {item.description}
                </p>
              </div>
            </motion.li>
          ))}
        </ol>

        {/* CTA inferior */}
        <div className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 bg-ink hover:bg-ink-soft
                       text-paper font-semibold px-7 py-3.5 rounded text-[16px]
                       transition-colors group"
          >
            Começar a praticar
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.25} />
          </Link>
          <p className="text-sm text-ink-muted font-mono">
            Grátis para começar — sem cartão.
          </p>

          {/* SVG decorativo: caderno com lápis */}
          <svg
            width="64"
            height="48"
            viewBox="0 0 64 48"
            fill="none"
            className="text-ink-muted ml-auto hidden lg:block"
            aria-hidden="true"
          >
            <rect x="8" y="6" width="40" height="36" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <line x1="14" y1="14" x2="42" y2="14" stroke="currentColor" strokeWidth="1" />
            <line x1="14" y1="20" x2="42" y2="20" stroke="currentColor" strokeWidth="1" />
            <line x1="14" y1="26" x2="36" y2="26" stroke="currentColor" strokeWidth="1" />
            <line x1="14" y1="32" x2="40" y2="32" stroke="currentColor" strokeWidth="1" />
            <path
              d="M48 30 L60 18 M56 22 L62 16 M44 38 L50 44 L52 42 L46 36 Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>

      </div>
    </section>
  );
}
