"use client";

import { Check, Sparkles } from "lucide-react";

/* ─── Redação exemplo (com marcadores para grifar) ─────────────────────── */
type SegmentType = "ok" | "fix" | "neutral";

interface Segment {
  text: string;
  type: SegmentType;
  tip?: string;
}

const ESSAY: Segment[] = [
  { text: "Segundo dados do ", type: "neutral" },
  { text: "IBGE (2023)", type: "ok", tip: "Argumento de autoridade — uso correto de dado estatístico recente." },
  { text: ", o Brasil ocupa a 79ª posição no ranking mundial de educação.", type: "neutral" },
  { text: " ", type: "neutral" },
  { text: "Então, é necessário que o governo tome providências imediatas", type: "fix", tip: "Conectivo \"Então\" inadequado para iniciar conclusão — sugere causa onde não há." },
  { text: ".", type: "neutral" },
  { text: " ", type: "neutral" },
  { text: "A violência e a desigualdade social são fatores que agravam esse cenário,", type: "ok", tip: "Boa contextualização do tema — sustenta o argumento com fatores reais." },
  { text: " ", type: "neutral" },
  { text: "tornando urgente a reflexão sobre políticas públicas eficazes", type: "fix", tip: "Repertório genérico. Trocar por agente concreto (ex: MEC, estados) ou citar lei/programa." },
  { text: "...", type: "neutral" },
];

export function EssayExample() {
  return (
    <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">

      {/* A redação em si */}
      <div className="lg:col-span-7">
        <div className="bg-paper border border-ink-line rounded-lg p-6 lg:p-8">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-ink-line">
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-muted">
              Redação · Tema: desafios da educação brasileira
            </p>
            <span className="font-mono text-[11px] text-ink-muted uppercase tracking-[0.15em]">
              680/1000
            </span>
          </div>

          <p className="text-[16px] lg:text-[17px] leading-[1.85] text-ink">
            {ESSAY.map((seg, i) => {
              if (seg.type === "neutral") {
                return <span key={i}>{seg.text}</span>;
              }

              const grife = seg.type === "ok" ? "grife-good" : "grife-bad";
              const Icon = seg.type === "ok" ? Check : Sparkles;
              const iconClass =
                seg.type === "ok"
                  ? "text-emerald-400"
                  : "text-accent-light";

              return (
                <span key={i} className={`${grife} tip-anchor group`} tabIndex={0}>
                  {seg.text}
                  {seg.tip && (
                    <span
                      role="tooltip"
                      className="tip-bubble pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-10 w-64 px-3.5 py-2.5 bg-ink text-paper font-sans text-[12.5px] leading-snug rounded shadow-lg"
                    >
                      <Icon
                        className={`w-3 h-3 inline -mt-0.5 mr-1.5 ${iconClass}`}
                        strokeWidth={seg.type === "ok" ? 2.5 : 2.25}
                      />
                      {seg.tip}
                    </span>
                  )}
                </span>
              );
            })}
          </p>

          <div className="mt-6 pt-4 border-t border-ink-line flex items-center justify-between">
            <p className="font-mono text-[11px] text-ink-muted uppercase tracking-[0.12em]">
              ↑ passe o mouse nas grifes
            </p>
            <p className="font-mono text-[11px] text-ink-muted uppercase tracking-[0.12em]">
              nota devolvida em 28s
            </p>
          </div>
        </div>
      </div>

      {/* Legenda explicativa + "o que você recebe" */}
      <div className="lg:col-span-5 space-y-6">
        <div>
          <p className="eyebrow text-accent mb-3">O que você recebe</p>
          <h4 className="font-display font-semibold text-2xl lg:text-3xl text-ink leading-tight mb-4">
            Cada trecho recebe um veredito, com o motivo.
          </h4>
          <p className="text-ink-soft leading-[1.6] text-[15px]">
            Verde é o que está bom e por quê. Vermelho é o que travou e o que mudar. Você não precisa adivinhar — a plataforma aponta o problema e a correção.
          </p>
        </div>

        <div className="border-t border-ink-line pt-5 space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted mb-3">
            Tipos de grife
          </p>
          <div className="flex items-start gap-3">
            <span className="grife-good shrink-0 text-[13px]">boa escolha</span>
            <span className="text-[13px] text-ink-soft leading-snug pt-0.5">
              <Check className="w-3 h-3 inline -mt-0.5 mr-1 text-emerald-700" strokeWidth={2.5} />
              Argumento, citação ou construção que sustenta o texto.
            </span>
          </div>
          <div className="flex items-start gap-3">
            <span className="grife-bad shrink-0 text-[13px]">para revisar</span>
            <span className="text-[13px] text-ink-soft leading-snug pt-0.5">
              <Sparkles className="w-3 h-3 inline -mt-0.5 mr-1 text-accent" strokeWidth={2.25} />
              Conectivo fraco, repertório genérico ou estrutura a refazer.
            </span>
          </div>
        </div>

        <div className="border-t border-ink-line pt-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted mb-2">
            Por baixo
          </p>
          <p className="text-[14px] text-ink-soft leading-[1.55]">
            Cada redação também gera nota por competência (0–200 em cada uma das cinco), comentário detalhado por parágrafo, e — se você já fez outras — um comparativo de evolução.
          </p>
        </div>
      </div>
    </div>
  );
}
