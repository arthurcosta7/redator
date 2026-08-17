"use client";

import { motion } from "framer-motion";

/* ─── Três níveis de redação ───────────────────────────────────────────── */

interface LevelEssay {
  score: number;
  level: string;
  excerpt: string;
  highlights: Array<{
    text: string;
    type: "ok" | "fix";
    comment: string;
  }>;
}

const levels: LevelEssay[] = [
  {
    score: 560,
    level: "Em desenvolvimento",
    excerpt:
      "O tema da educação é muito importante para o nosso país. É necessário que o governo faça alguma coisa para mudar isso. Os jovens precisam estudar mais.",
    highlights: [
      {
        text: "O tema da educação é muito importante para o nosso país.",
        type: "fix",
        comment: "Repertório genérico — não avança no tema da proposta.",
      },
      {
        text: "alguma coisa",
        type: "fix",
        comment: "Linguagem informal — substitua por um agente concreto.",
      },
    ],
  },
  {
    score: 720,
    level: "Consolidado",
    excerpt:
      "Segundo dados do IBGE (2023), o Brasil ocupa a 79ª posição no ranking mundial de educação. Então, é necessário que o governo tome providências imediatas.",
    highlights: [
      {
        text: "IBGE (2023)",
        type: "ok",
        comment: "Argumento de autoridade bem usado.",
      },
      {
        text: "Então, é necessário",
        type: "fix",
        comment: "Conectivo inadequado para iniciar conclusão.",
      },
    ],
  },
  {
    score: 880,
    level: "Alto desempenho",
    excerpt:
      "Conforme pesquisa do IBGE (2023), apenas 49% dos jovens concluem o ensino médio na idade adequada. Cabe ao MEC articular com estados uma política nacional de correção de fluxo.",
    highlights: [
      {
        text: "Conforme pesquisa do IBGE (2023)",
        type: "ok",
        comment: "Conectivo coesivo + dado recente e específico.",
      },
      {
        text: "Cabe ao MEC articular com estados uma política nacional de correção de fluxo.",
        type: "ok",
        comment: "Proposta completa: agente (MEC), ação (articular), meio (política), finalidade.",
      },
    ],
  },
];

export function ScoreGallery() {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-8 pb-3 border-b-2 border-ink">
        <h3 className="font-display italic font-semibold text-2xl lg:text-3xl text-ink">
          Três redações, três notas
        </h3>
        <span className="eyebrow">mesmo tema, níveis diferentes</span>
      </div>

      <div className="grid md:grid-cols-3 gap-0 border border-ink-line bg-paper">
        {levels.map((lvl, idx) => (
          <motion.article
            key={lvl.score}
            initial={{ opacity: 0, transform: "translateY(16px)" }}
            whileInView={{ opacity: 1, transform: "translateY(0)" }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: idx * 0.08, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }}
            className={`p-6 lg:p-7 flex flex-col ${
              idx > 0 ? "border-t md:border-t-0 md:border-l border-ink-line" : ""
            }`}
          >
            {/* Cabeçalho — score + nível */}
            <header className="mb-5 pb-4 border-b border-ink-line">
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <span className="font-display font-semibold text-4xl text-ink leading-none">
                  {lvl.score}
                  <span className="text-base text-ink-muted font-normal">/1000</span>
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-muted">
                  Nível
                </span>
              </div>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent font-semibold">
                {lvl.level}
              </p>
            </header>

            {/* Trecho da redação */}
            <p className="text-[14px] leading-[1.7] text-ink-soft mb-5 font-display">
              {lvl.highlights.map((h, i) => {
                const before = i === 0 ? lvl.excerpt.split(h.text)[0] : "";
                const after = lvl.excerpt.split(h.text)[1] || "";
                return (
                  <span key={i}>
                    <span>{before}</span>
                    <span className={h.type === "ok" ? "grife-good" : "grife-bad"}>
                      {h.text}
                    </span>
                    {i === lvl.highlights.length - 1 && <span>{after}</span>}
                  </span>
                );
              })}
            </p>

            {/* Comentários */}
            <ul className="mt-auto space-y-2.5 pt-4 border-t border-ink-line">
              {lvl.highlights.map((h, i) => (
                <li key={i} className="text-[12.5px] leading-snug text-ink-muted">
                  <span className={`font-mono font-semibold ${h.type === "ok" ? "text-emerald-700" : "text-accent"}`}>
                    {h.type === "ok" ? "+" : "−"}
                  </span>
                  <span className="ml-2">{h.comment}</span>
                </li>
              ))}
            </ul>
          </motion.article>
        ))}
      </div>
    </div>
  );
}
