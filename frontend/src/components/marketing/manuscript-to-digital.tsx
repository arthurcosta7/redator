"use client";

import { motion } from "framer-motion";
import { ScrollParallax } from "./scroll-parallax";

/* ─── Da folha para a tela — manuscrito + digital com grife ────────────────── */

const MANUSCRIPT_TEXT =
  "Segundo dados do IBGE (2023), o Brasil ocupa a 79ª posição no ranking mundial de educação. Então, é necessário que o governo tome providências imediatas. A violência e a desigualdade são fatores que agravam esse cenário...";

const DIGITAL_SEGMENTS = [
  { text: "Segundo dados do ", type: "neutral" as const },
  { text: "IBGE (2023)", type: "ok" as const },
  { text: ", o Brasil ocupa a 79ª posição no ranking mundial de educação.", type: "neutral" as const },
  { text: " " },
  { text: "Então, é necessário que o governo tome providências imediatas", type: "fix" as const },
  { text: ". A violência e a desigualdade são fatores que agravam esse cenário...", type: "neutral" as const },
];

export function ManuscriptToDigital() {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-8 pb-3 border-b-2 border-ink">
        <h3 className="font-display italic font-semibold text-2xl lg:text-3xl text-ink">
          Da folha para a tela
        </h3>
        <span className="eyebrow">manuscrito → digital com grife</span>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 lg:gap-10 items-center">

        {/* Folha manuscrita */}
        <motion.div
          initial={{ opacity: 0, transform: "translateY(12px)" }}
          whileInView={{ opacity: 1, transform: "translateY(0)" }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }}
          className="lg:col-span-5"
        >
          <ScrollParallax from={24} to={-18} rotateFrom={-2.2} rotateTo={-0.8}>
            <div className="caderno relative p-6 lg:p-8 rounded shadow-md border border-ink/10">
              {/* Margem vermelha */}
              <div className="absolute top-0 bottom-0 left-12 w-px bg-red-300/70" />
              <p className="font-hand text-[18px] lg:text-[20px] leading-[32px] text-ink/85 pl-16 pr-2">
                {MANUSCRIPT_TEXT}
              </p>
              <div className="absolute bottom-3 right-4 font-mono text-[10px] text-ink-muted uppercase tracking-[0.15em]">
                manuscrito · folha A4
              </div>
            </div>
          </ScrollParallax>
        </motion.div>

        {/* Seta animada */}
        <div className="lg:col-span-2 flex items-center justify-center py-4 lg:py-0">
          <motion.svg
            width="80"
            height="40"
            viewBox="0 0 80 40"
            fill="none"
            className="text-accent w-16 lg:w-20"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
          >
            <motion.path
              d="M 4 20 L 70 20"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              variants={{
                hidden: { pathLength: 0 },
                visible: { pathLength: 1, transition: { duration: 0.8, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] } },
              }}
            />
            <motion.path
              d="M 60 10 L 72 20 L 60 30"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              variants={{
                hidden: { pathLength: 0, opacity: 0 },
                visible: { pathLength: 1, opacity: 1, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] as [number, number, number, number], delay: 0.7 } },
              }}
            />
          </motion.svg>
        </div>

        {/* Versão digital com grife */}
        <motion.div
          initial={{ opacity: 0, transform: "translateY(12px)" }}
          whileInView={{ opacity: 1, transform: "translateY(0)" }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] as [number, number, number, number], delay: 0.3 }}
          className="lg:col-span-5"
        >
          <ScrollParallax from={-16} to={20} rotateFrom={0.5} rotateTo={-0.35}>
            <div className="bg-paper border border-ink-line rounded-lg p-5 lg:p-6 relative shadow-card">
              <div className="absolute top-0 right-0 px-2 py-1 font-mono text-[10px] text-ink-muted uppercase tracking-[0.15em] bg-paper-deep rounded-bl">
                digital · corrigido
              </div>
              <p className="text-[14px] lg:text-[15px] leading-[1.8] text-ink-soft font-display">
                {DIGITAL_SEGMENTS.map((seg, i) => {
                  if (seg.type === "neutral" || seg.type === undefined) {
                    return <span key={i}>{(seg as { text: string }).text}</span>;
                  }
                  return (
                    <span key={i} className={seg.type === "ok" ? "grife-good" : "grife-bad"}>
                      {seg.text}
                    </span>
                  );
                })}
              </p>
              <div className="mt-4 pt-3 border-t border-ink-line flex items-center justify-between">
                <p className="font-mono text-[10px] text-ink-muted uppercase tracking-[0.12em]">
                  OCR · 28 segundos
                </p>
                <p className="font-mono text-[10px] text-accent font-semibold uppercase tracking-[0.12em]">
                  nota: 680
                </p>
              </div>
            </div>
          </ScrollParallax>
        </motion.div>
      </div>
    </div>
  );
}
