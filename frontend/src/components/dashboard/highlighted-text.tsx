"use client";

/**
 * highlighted-text.tsx — Renderiza o texto da redação com grifes coloridas
 *
 * Recebe o texto e um array de highlights com posições (start, end) e tipo.
 * Divide o texto em segmentos e renderiza cada um com a classe CSS correta.
 *
 * Tipos de grife:
 * - positive   → verde  (ponto forte)
 * - negative   → vermelho (erro/melhoria necessária)
 * - suggestion → âmbar (sugestão de melhoria)
 */
import { useState } from "react";
import type { TextHighlight, HighlightType } from "@/types/essay";

// ─── Estilos por tipo de grife ────────────────────────────────────────────────

const HIGHLIGHT_STYLES: Record<HighlightType, string> = {
  positive: "bg-green-100 border-b-2 border-green-400 text-green-900",
  negative: "bg-red-100 border-b-2 border-red-400 text-red-900",
  suggestion: "bg-amber-100 border-b-2 border-amber-400 text-amber-900",
};

const HIGHLIGHT_LABELS: Record<HighlightType, string> = {
  positive: "✓ Ponto forte",
  negative: "✗ Atenção",
  suggestion: "→ Sugestão",
};

const TOOLTIP_STYLES: Record<HighlightType, string> = {
  positive: "bg-green-800 text-green-50",
  negative: "bg-red-800 text-red-50",
  suggestion: "bg-amber-800 text-amber-50",
};

// ─── Segmentação do texto ────────────────────────────────────────────────────

interface Segment {
  text: string;
  highlight?: TextHighlight;
}

function buildSegments(text: string, highlights: TextHighlight[]): Segment[] {
  if (!highlights || highlights.length === 0) {
    return [{ text }];
  }

  // Ordena highlights por posição inicial, remove sobreposições
  const sorted = [...highlights]
    .sort((a, b) => a.start - b.start)
    .reduce<TextHighlight[]>((acc, cur) => {
      const last = acc[acc.length - 1];
      if (last && cur.start < last.end) {
        // Sobreposição — mantém o maior
        if (cur.end > last.end) {
          acc[acc.length - 1] = { ...last, end: cur.end };
        }
        return acc;
      }
      return [...acc, cur];
    }, []);

  const segments: Segment[] = [];
  let cursor = 0;

  for (const hl of sorted) {
    // Clamp para não ultrapassar o tamanho do texto
    const start = Math.min(hl.start, text.length);
    const end = Math.min(hl.end, text.length);

    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start) });
    }
    if (start < end) {
      segments.push({ text: text.slice(start, end), highlight: hl });
    }
    cursor = end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }

  return segments;
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface HighlightedTextProps {
  text: string;
  highlights: TextHighlight[];
  className?: string;
}

export function HighlightedText({
  text,
  highlights,
  className = "",
}: HighlightedTextProps) {
  const [activeHighlight, setActiveHighlight] = useState<TextHighlight | null>(null);
  const segments = buildSegments(text, highlights);

  return (
    <div className={`relative ${className}`}>
      <p className="leading-8 text-slate-700 whitespace-pre-wrap font-sans text-[0.9375rem]">
        {segments.map((seg, i) =>
          seg.highlight ? (
            <span
              key={i}
              className={`relative rounded-sm px-0.5 cursor-pointer transition-opacity ${
                HIGHLIGHT_STYLES[seg.highlight.type]
              } ${
                activeHighlight && activeHighlight !== seg.highlight
                  ? "opacity-60"
                  : ""
              }`}
              onClick={() =>
                setActiveHighlight(
                  activeHighlight === seg.highlight ? null : seg.highlight!
                )
              }
            >
              {seg.text}
              {/* Tooltip */}
              {activeHighlight === seg.highlight && (
                <span
                  className={`absolute bottom-full left-0 mb-2 z-10 w-max max-w-xs
                               text-xs rounded-lg px-3 py-2 shadow-lg
                               ${TOOLTIP_STYLES[seg.highlight.type]}`}
                >
                  <span className="block font-semibold mb-0.5">
                    {HIGHLIGHT_LABELS[seg.highlight.type]}
                  </span>
                  {seg.highlight.comment}
                </span>
              )}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </p>

      {/* Legenda */}
      {highlights.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-100">
          {(["positive", "negative", "suggestion"] as HighlightType[]).map(
            (type) =>
              highlights.some((h) => h.type === type) && (
                <span key={type} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span
                    className={`inline-block w-3 h-3 rounded-sm border-b-2 ${
                      type === "positive"
                        ? "bg-green-100 border-green-400"
                        : type === "negative"
                        ? "bg-red-100 border-red-400"
                        : "bg-amber-100 border-amber-400"
                    }`}
                  />
                  {HIGHLIGHT_LABELS[type]}
                </span>
              )
          )}
          <span className="text-xs text-slate-400 ml-auto">
            Clique nos trechos para ver o comentário
          </span>
        </div>
      )}
    </div>
  );
}
