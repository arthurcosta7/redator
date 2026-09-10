"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

/**
 * Estado da máquina de animação em cinco fases, com repetição opcional.
 * - typing: texto é revelado caractere por caractere
 * - analyzing: texto completo fica visível, shimmer de análise
 * - highlighting: cada trecho grifado aparece um a um
 * - scoring: barras de competência sobem uma a uma
 * - reveal: nota final aparece
 */
export type TypewriterPhase =
  | "typing"
  | "analyzing"
  | "highlighting"
  | "scoring"
  | "reveal";

export interface TypewriterConfig {
  /** Caracteres por segundo durante a fase de digitação. */
  charsPerSecond: number;
  /** Duração de cada fase em ms (typing/analyzing/highlighting/scoring/reveal). */
  phaseDurations: Record<TypewriterPhase, number>;
  /** Quando true, a animação não inicia automaticamente. */
  paused?: boolean;
  /** Quando false, mantém o resultado final visível após o primeiro ciclo. */
  loop?: boolean;
}

export interface TypewriterState {
  phase: TypewriterPhase;
  /** Quantos code points já foram "digitados" — sempre alinhado em code point boundary. */
  typedCount: number;
  highlightedCount: number;
  scoredCount: number;
  /** Texto completo como array de code points (preserva acentos e emojis). */
  codePoints: string[];
  /** Total de code points (caracteres visíveis). */
  totalChars: number;
  /** Total de segmentos não-neutros que serão grifados. */
  totalHighlights: number;
}

export interface UseTypewriterMachine {
  state: TypewriterState;
  /** Avança a máquina para o início do próximo ciclo (reset). */
  restart: () => void;
  /** Permite ao componente injetar o total de itens da fase de scoring. */
  setScoringTotal: (n: number) => void;
}

const DEFAULT_CONFIG: TypewriterConfig = {
  charsPerSecond: 180,
  loop: true,
  phaseDurations: {
    typing: 0, // controlado por cps
    analyzing: 1000,
    highlighting: 2200,
    scoring: 2000,
    reveal: 2200,
  },
};

/**
 * Hook puro que dirige a animação da demo de correção.
 *
 * Pontos críticos que esta versão conserta:
 * 1. **Code points, não code units.** `Array.from(text)` quebra a string em
 *    code points UTF-16, preservando acentos, ç, emojis etc. Avançar o cursor
 *    aqui nunca cai no meio de um par surrogate nem entre base+combining mark.
 * 2. **rAF + timestamp, não setTimeout encadeado.** O efeito não re-roda a cada
 *    caractere novo. Um único loop de animação decide o estado com base no
 *    `performance.now()` desde o início do ciclo. Isso elimina o "salto" que
 *    vinha do React batching de setStates seguidos.
 * 3. **Cleanup único.** Apenas `cancelAnimationFrame` no unmount. Sem
 *    `clearTimeout` encadeado que pudesse vazar em hot reload.
 * 4. **Restart confiável.** `restart()` zera todas as contagens e o timestamp
 *    de início; não depende de múltiplos setStates em sequência.
 */
export function useTypewriterMachine(
  fullText: string,
  segments: Array<{ type: "ok" | "fix" | "neutral" }>,
  config: Partial<TypewriterConfig> = {},
): UseTypewriterMachine {
  const cfg: TypewriterConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    phaseDurations: {
      ...DEFAULT_CONFIG.phaseDurations,
      ...(config.phaseDurations ?? {}),
    },
  };

  // Materializa o texto em code points UMA vez por mudança de fullText.
  // useMemo evita recomputar a cada frame.
  const codePoints = useMemo(() => Array.from(fullText), [fullText]);
  const totalChars = codePoints.length;
  const totalHighlights = useMemo(
    () => segments.filter((s) => s.type !== "neutral").length,
    [segments],
  );

  // Estado observável (re-renderiza o componente).
  const [state, setState] = useState<TypewriterState>({
    phase: "typing",
    typedCount: 0,
    highlightedCount: 0,
    scoredCount: 0,
    codePoints,
    totalChars,
    totalHighlights,
  });

  // Refs mutáveis para o loop de animação. Não causam re-render.
  const rafRef = useRef<number | null>(null);
  const cycleStartRef = useRef<number>(0);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const totalCharsRef = useRef(totalChars);
  totalCharsRef.current = totalChars;
  const totalHighlightsRef = useRef(totalHighlights);
  totalHighlightsRef.current = totalHighlights;
  const scoringTotalRef = useRef(0);
  const tickRef = useRef<FrameRequestCallback | null>(null);

  // API pública para reset.
  const restartRef = useRef<() => void>(() => {});
  restartRef.current = () => {
    cycleStartRef.current = performance.now();
    setState((s) => ({
      ...s,
      phase: "typing",
      typedCount: 0,
      highlightedCount: 0,
      scoredCount: 0,
    }));
    if (rafRef.current === null && tickRef.current) {
      rafRef.current = requestAnimationFrame(tickRef.current);
    }
  };

  useEffect(() => {
    if (cfg.paused) return;

    cycleStartRef.current = performance.now();

    const tick = (now: number) => {
      const c = cfgRef.current;
      const elapsed = now - cycleStartRef.current;

      // Calcula fase atual com base no tempo decorrido.
      const typingDurationMs = (totalCharsRef.current / c.charsPerSecond) * 1000;
      const aStart = typingDurationMs;
      const hStart = aStart + c.phaseDurations.analyzing;
      const sStart = hStart + c.phaseDurations.highlighting;
      const rStart = sStart + c.phaseDurations.scoring;
      const cycleEnd = rStart + c.phaseDurations.reveal;

      if (elapsed >= cycleEnd) {
        if (c.loop === false) {
          setState((s) => ({
            ...s,
            phase: "reveal",
            typedCount: totalCharsRef.current,
            highlightedCount: totalHighlightsRef.current,
            scoredCount: scoringTotalRef.current,
          }));
          rafRef.current = null;
          return;
        }

        // Reinicia o loop quando a demonstração pede repetição contínua.
        cycleStartRef.current = now;
        setState((s) => ({
          ...s,
          phase: "typing",
          typedCount: 0,
          highlightedCount: 0,
          scoredCount: 0,
        }));
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      let nextPhase: TypewriterPhase = "typing";
      let nextTyped = 0;
      let nextHighlighted = 0;
      let nextScored = 0;

      if (elapsed < aStart) {
        nextPhase = "typing";
        // Avança o cursor em code points: caracteres = cps * segundos.
        // Usa Math.floor para garantir que só revelamos caracteres completos
        // — nunca metade de um par surrogate.
        const seconds = elapsed / 1000;
        nextTyped = Math.min(
          totalCharsRef.current,
          Math.floor(seconds * c.charsPerSecond),
        );
      } else if (elapsed < hStart) {
        nextPhase = "analyzing";
        nextTyped = totalCharsRef.current;
      } else if (elapsed < sStart) {
        nextPhase = "highlighting";
        nextTyped = totalCharsRef.current;
        const hlElapsed = elapsed - hStart;
        const hlDuration = c.phaseDurations.highlighting;
        const ratio = Math.min(1, hlElapsed / hlDuration);
        nextHighlighted = Math.round(ratio * totalHighlightsRef.current);
      } else if (elapsed < rStart) {
        nextPhase = "scoring";
        nextTyped = totalCharsRef.current;
        nextHighlighted = totalHighlightsRef.current;
        const scElapsed = elapsed - sStart;
        const scDuration = c.phaseDurations.scoring;
        const ratio = Math.min(1, scElapsed / scDuration);
        // scoringTotal vem do componente via ref; se 0, não avança
        const scTotal = Math.max(1, scoringTotalRef.current);
        nextScored = Math.round(ratio * scTotal);
      } else {
        nextPhase = "reveal";
        nextTyped = totalCharsRef.current;
        nextHighlighted = totalHighlightsRef.current;
        // scoredCount máximo é setado via prop ref
        nextScored = scoringTotalRef.current;
      }

      // flushSync força o React a fazer commit síncrono neste update,
      // garantindo que cada caractere seja pintado de fato no próximo paint
      // do navegador. Sem isso, o React 18 faz batching dentro do rAF e o
      // usuário vê apenas o estado coalescido — o efeito visual é de
      // "palavras inteiras" aparecendo em vez de letra por letra.
      flushSync(() => {
        setState((prev) => {
          if (
            prev.phase === nextPhase &&
            prev.typedCount === nextTyped &&
            prev.highlightedCount === nextHighlighted &&
            prev.scoredCount === nextScored
          ) {
            return prev;
          }
          return {
            ...prev,
            phase: nextPhase,
            typedCount: nextTyped,
            highlightedCount: nextHighlighted,
            scoredCount: nextScored,
          };
        });
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    tickRef.current = tick;
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      tickRef.current = null;
    };
  }, [cfg.paused]);

  const setScoringTotal = (n: number) => {
    scoringTotalRef.current = Math.max(0, n);
  };

  return {
    state: { ...state, codePoints, totalChars, totalHighlights },
    restart: () => restartRef.current(),
    setScoringTotal,
  };
}
