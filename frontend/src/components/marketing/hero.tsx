"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { LiveCorrectionDemo } from "./live-correction-demo";
import { ScrollParallax } from "./scroll-parallax";

const enterEase = [0.23, 1, 0.32, 1] as [number, number, number, number];

export function Hero() {
  return (
    <section className="relative pt-28 lg:pt-36 pb-16 lg:pb-24 bg-paper">
      <div className="container-site">

        {/* Eyebrow */}
        {/* O texto permanece opaco durante a entrada para manter contraste AA;
            o deslocamento preserva a percepcao de movimento sem reduzir leitura. */}
        <motion.div
          initial={{ transform: "translateY(8px)" }}
          animate={{ transform: "translateY(0)" }}
          transition={{ duration: 0.5, ease: enterEase }}
          className="flex items-center gap-3 mb-8 lg:mb-10"
        >
          <span className="eyebrow">Nº 01 — Edição de agosto</span>
          <span className="hidden sm:block flex-1 max-w-[120px] h-px bg-ink-line" />
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">

          {/* Texto principal */}
          <div className="lg:col-span-7 space-y-7">
            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, transform: "translateY(12px)" }}
              animate={{ opacity: 1, transform: "translateY(0)" }}
              transition={{ duration: 0.55, ease: enterEase, delay: 0.1 }}
              className="font-display font-semibold text-[2.65rem] sm:text-6xl lg:text-7xl xl:text-[5.25rem]
                         text-ink leading-[1.04] tracking-[-0.015em] text-balance"
            >
              Sua redação corrigida em menos de um minuto.
            </motion.h1>

            {/* Subhead */}
            <motion.p
              initial={{ opacity: 0, transform: "translateY(12px)" }}
              animate={{ opacity: 1, transform: "translateY(0)" }}
              transition={{ duration: 0.55, ease: enterEase, delay: 0.2 }}
              className="text-lg lg:text-xl text-ink-soft leading-[1.55] max-w-xl font-sans"
            >
              Envie o texto ou foto. A plataforma devolve grife nos trechos, nota por competência e o que mudar da próxima vez — sem esperar o cursinho devolver em duas semanas.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, transform: "translateY(12px)" }}
              animate={{ opacity: 1, transform: "translateY(0)" }}
              transition={{ duration: 0.55, ease: enterEase, delay: 0.3 }}
              className="flex flex-col sm:flex-row sm:items-center gap-5 pt-2"
            >
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center gap-2.5 bg-accent hover:bg-accent-deep
                           text-paper font-semibold px-7 py-4 rounded text-[17px]
                           transition-colors group w-fit interactive-lift"
              >
                Começar grátis
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.25} />
              </Link>
              <a
                href="#como-funciona"
                className="text-ink-soft hover:text-ink text-[15px] font-medium link-underline w-fit"
              >
                ou veja como funciona ↓
              </a>
            </motion.div>

            {/* Trust line */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="pt-6 border-t border-ink-line"
            >
              <p className="font-mono text-[13px] text-ink-muted leading-relaxed">
                <span className="text-ink">[01]</span> feedback em ~30 segundos &nbsp;·&nbsp;
                <span className="text-ink">[02]</span> sem cartão de crédito &nbsp;·&nbsp;
                <span className="text-ink">[03]</span> consistência em correção
              </p>
            </motion.div>
          </div>

          {/* Demo ao vivo */}
          <motion.div
            initial={{ opacity: 0, transform: "translateY(20px)" }}
            animate={{ opacity: 1, transform: "translateY(0)" }}
            transition={{ duration: 0.7, ease: enterEase, delay: 0.25 }}
            className="lg:col-span-5 lg:pt-2"
          >
            <ScrollParallax from={18} to={-30}>
              <p className="eyebrow mb-3 text-accent">↓ Como aparece na prática</p>
              <LiveCorrectionDemo />
              <p className="mt-3 font-mono text-[11px] text-ink-muted uppercase tracking-[0.12em]">
                ↑ demo ao vivo · loop de ~12s · passe o mouse nas grifes
              </p>
            </ScrollParallax>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
