"use client";

import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { useTypewriterMachine } from "@/hooks/use-typewriter-machine";

/* ─── Redação exemplo (com marcadores para grifar) ─────────────────────── */
// Cada trecho tem tipo: "ok" (verde) ou "fix" (vermelho) + tooltip
const ESSAY_SEGMENTS = [
  { text: "Segundo dados do IBGE (2023), ", type: "ok" as const, tip: "Argumento de autoridade — uso correto de dado." },
  { text: "o Brasil ocupa a 79ª posição no ranking mundial de educação.", type: "neutral" as const },
  { text: " ", type: "neutral" as const },
  { text: "Então, é necessário que o governo tome providências imediatas.", type: "fix" as const, tip: "Conectivo inadequado para iniciar conclusão — sugere causa onde não há." },
  { text: " ", type: "neutral" as const },
  { text: "A violência e a desigualdade social são fatores que agravam esse cenário,", type: "ok" as const, tip: "Boa contextualização do tema — sustenta o argumento." },
  { text: " ", type: "neutral" as const },
  { text: "tornando urgente a reflexão sobre políticas públicas eficazes...", type: "fix" as const, tip: "Repertório genérico. Trocar por dado concreto (índice, lei, autor)." },
];

const COMPETENCIES = [
  { label: "C1 · Linguagem formal", score: 160, color: "bg-accent" },
  { label: "C2 · Desenvolvimento do tema", score: 160, color: "bg-accent" },
  { label: "C3 · Argumentação", score: 120, color: "bg-amber-600" },
  { label: "C4 · Coesão e coerência", score: 120, color: "bg-amber-600" },
  { label: "C5 · Proposta de intervenção", score: 120, color: "bg-amber-600" },
];

const FINAL_SCORE = 680;
const CYCLE_CHARS_PER_SECOND = 180;

/* ─── Componente ───────────────────────────────────────────────────────── */
export function LiveCorrectionDemo() {
  const fullText = useMemo(
    () => ESSAY_SEGMENTS.map((s) => s.text).join(""),
    [],
  );

  // O hook dirige a animação. scoreTotalRef fica dentro do hook via
  // workaround: o hook lê do scoringTotalRef mutável.
  const { state, setScoringTotal } = useTypewriterMachine(fullText, ESSAY_SEGMENTS, {
    charsPerSecond: CYCLE_CHARS_PER_SECOND,
    phaseDurations: {
      typing: 0,
      analyzing: 1200,
      highlighting: 2400,
      scoring: 2200,
      reveal: 2400,
    },
  });

  // Comunica ao hook o total de competências para a fase de scoring.
  // Roda em effect para evitar re-render loop (setState dentro do render).
  useEffect(() => {
    setScoringTotal(COMPETENCIES.length);
  }, [setScoringTotal]);

  // Reconstrói os segmentos grifados respeitando a posição em code points.
  // Cada segmento tem um range [start, end) no array de code points.
  const renderedSegments = useMemo(() => {
    let cursor = 0;
    const out: Array<{
      segment: typeof ESSAY_SEGMENTS[number];
      show: boolean;
      isHighlighted: boolean;
    }> = [];
    let highlightIdx = 0;
    for (const seg of ESSAY_SEGMENTS) {
      const segStart = cursor;
      const segEnd = cursor + Array.from(seg.text).length;
      cursor = segEnd;

      const isTyped = state.typedCount >= segStart;
      const isNeutral = seg.type === "neutral";
      const isCurrentlyHighlighted =
        isNeutral || state.highlightedCount > highlightIdx - (isNeutral ? 0 : 1);
      if (!isNeutral) highlightIdx++;

      if (!isTyped) {
        out.push({ segment: seg, show: false, isHighlighted: false });
        continue;
      }
      if (state.phase === "typing" || state.phase === "analyzing") {
        // Antes de highlighting, mostra como neutro (sem grife).
        out.push({
          segment: { text: seg.text, type: "neutral" },
          show: true,
          isHighlighted: false,
        });
      } else {
        const segIndexInNonNeutral = ESSAY_SEGMENTS.slice(
          0,
          ESSAY_SEGMENTS.indexOf(seg),
        ).filter((s) => s.type !== "neutral").length;
        const visible =
          seg.type === "neutral"
            ? true
            : segIndexInNonNeutral < state.highlightedCount;
        out.push({ segment: seg, show: visible, isHighlighted: isCurrentlyHighlighted });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.typedCount, state.phase, state.highlightedCount]);

  return (
    <div className="relative bg-paper border border-ink-line rounded-lg overflow-hidden">
      {/* Header da "correção" */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-ink-line bg-paper-deep/50">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[11px] text-ink-muted uppercase tracking-[0.15em]">
            Correção · ENEM
          </span>
        </div>
        <AnimatePresence mode="wait">
          {state.phase === "analyzing" ? (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="font-mono text-[11px] text-accent uppercase tracking-[0.15em]">
                Analisando
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span className="font-mono text-[11px] text-ink-muted uppercase tracking-[0.15em]">
                {state.phase === "typing" ? "Digitando" : "Corrigida"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Corpo: texto da redação */}
      <div className="px-5 pt-5 pb-4 min-h-[180px]">
        <p className="text-[15px] leading-[1.75] text-ink-soft">
          {renderedSegments.map((r, i) => {
            if (!r.show) return null;
            const seg = r.segment;
            if (seg.type === "neutral") {
              return <span key={i}>{seg.text}</span>;
            }
            const grife = seg.type === "ok" ? "grife-good" : "grife-bad";
            const Icon = seg.type === "ok" ? Check : Sparkles;
            const iconClass =
              seg.type === "ok" ? "text-emerald-400" : "text-accent-light";
            const strokeWidth = seg.type === "ok" ? 2.5 : 2.25;
            return (
              <span key={i} className={`${grife} tip-anchor group`} tabIndex={0}>
                {seg.text}
                {seg.tip && (
                  <span
                    role="tooltip"
                    className="tip-bubble absolute left-1/2 -translate-x-1/2 -top-2 z-10 w-56 px-3 py-2 bg-ink text-paper font-sans text-[12px] leading-snug rounded shadow-lg"
                  >
                    <Icon
                      className={`w-3 h-3 inline -mt-0.5 mr-1 ${iconClass}`}
                      strokeWidth={strokeWidth}
                    />
                    {seg.tip}
                  </span>
                )}
              </span>
            );
          })}
          {state.phase === "typing" && (
            <span className="inline-block w-[2px] h-[1.05em] bg-ink align-middle ml-0.5" style={{ animation: "caretBlink 0.6s steps(1) infinite" }} />
          )}
        </p>

        {/* Estado "Analisando" com shimmer sobreposto */}
        <AnimatePresence>
          {state.phase === "analyzing" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4 h-1 rounded shimmer"
            />
          )}
        </AnimatePresence>
      </div>

      {/* Rodapé: competências + nota */}
      <div className="border-t border-ink-line px-5 py-4 bg-paper-deep/30 space-y-2.5">
        <AnimatePresence>
          {(state.phase === "scoring" || state.phase === "reveal") && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-2.5 overflow-hidden"
            >
              {COMPETENCIES.slice(0, state.scoredCount).map((comp, idx) => (
                <motion.div
                  key={comp.label}
                  initial={{ opacity: 0, transform: "translateX(-8px)" }}
                  animate={{ opacity: 1, transform: "translateX(0)" }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className="flex items-center gap-3"
                >
                  <span className="font-mono text-[11px] text-ink-muted w-44 shrink-0 truncate">
                    {comp.label}
                  </span>
                  <div className="flex-1 h-1.5 bg-paper-deep rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${comp.color} rounded-full`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(comp.score / 200) * 100}%` }}
                      transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-ink font-semibold w-12 text-right shrink-0">
                    {comp.score}/200
                  </span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nota final */}
        <AnimatePresence>
          {state.phase === "reveal" && (
            <motion.div
              initial={{ opacity: 0, transform: "translateY(8px)" }}
              animate={{ opacity: 1, transform: "translateY(0)" }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }}
              className="pt-3 mt-1 border-t border-ink-line flex items-center justify-between"
            >
              <div>
                <p className="font-mono text-[10px] text-ink-muted uppercase tracking-[0.15em]">
                  Nota final
                </p>
                <motion.p
                  initial={{ transform: "scale(0.95)", opacity: 0 }}
                  animate={{ transform: "scale(1)", opacity: 1 }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] as [number, number, number, number], delay: 0.1 }}
                  className="font-display font-semibold text-3xl text-ink leading-none mt-1"
                >
                  {FINAL_SCORE}
                  <span className="text-base text-ink-muted font-normal">/1000</span>
                </motion.p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] text-ink-muted uppercase tracking-[0.15em]">
                  Nível
                </p>
                <p className="font-mono text-[11px] font-semibold text-accent bg-accent-light px-2.5 py-1 rounded mt-1 inline-block">
                  Intermediário
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fim do card */}
    </div>
  );
}
