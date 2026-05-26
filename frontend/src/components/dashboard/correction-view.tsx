"use client";

/**
 * correction-view.tsx — Visualização completa de uma correção
 *
 * Exibe:
 * - Pontuação total com barra de progresso
 * - Competências/critérios detalhados (ENEM ou Vestibular)
 * - Texto com grifes interativas
 * - Insights e feedback geral
 */
import { useState } from "react";
import { clsx } from "clsx";
import { ChevronDown, ChevronUp, Lightbulb, MessageSquare, FileText } from "lucide-react";
import type { Correction, Essay } from "@/types/essay";
import { HighlightedText } from "./highlighted-text";

// ─── Barra de score ───────────────────────────────────────────────────────────

function ScoreBar({
  score,
  max,
  label,
  size = "md",
}: {
  score: number;
  max: number;
  label?: string;
  size?: "sm" | "md";
}) {
  const pct = Math.round((score / max) * 100);
  const color =
    pct >= 80
      ? "bg-green-500"
      : pct >= 60
      ? "bg-brand-500"
      : pct >= 40
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>{label}</span>
          <span className="font-semibold text-slate-700">
            {score}/{max}
          </span>
        </div>
      )}
      <div className={`w-full rounded-full bg-slate-100 ${size === "sm" ? "h-1.5" : "h-2"}`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Accordion para competência/critério ──────────────────────────────────────

function CompetencyItem({
  name,
  score,
  max,
  feedback,
  index,
}: {
  name: string;
  score: number;
  max: number;
  feedback: string;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const pct = Math.round((score / max) * 100);
  const color =
    pct >= 80 ? "text-green-600" : pct >= 60 ? "text-brand-600" : pct >= 40 ? "text-amber-600" : "text-red-600";
  const bg =
    pct >= 80 ? "bg-green-50" : pct >= 60 ? "bg-brand-50" : pct >= 40 ? "bg-amber-50" : "bg-red-50";

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors text-left"
      >
        {/* Índice */}
        <span
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${bg} ${color}`}
        >
          {index}
        </span>
        {/* Nome */}
        <span className="flex-1 text-sm font-medium text-slate-700 line-clamp-1">
          {name}
        </span>
        {/* Score */}
        <span className={`text-sm font-bold ${color} mr-2`}>
          {score}/{max}
        </span>
        {/* Chevron */}
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
      </button>

      {/* Barra de progresso */}
      <div className="px-4 pb-2">
        <ScoreBar score={score} max={max} size="sm" />
      </div>

      {/* Feedback expandido */}
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-50">
          <p className="text-sm text-slate-600 leading-relaxed">{feedback}</p>
        </div>
      )}
    </div>
  );
}

// ─── Score total ──────────────────────────────────────────────────────────────

function TotalScore({ score, max }: { score: number; max: number }) {
  const pct = Math.round((score / max) * 100);
  const color =
    pct >= 80
      ? "text-green-600"
      : pct >= 60
      ? "text-brand-600"
      : pct >= 40
      ? "text-amber-600"
      : "text-red-600";
  const ring =
    pct >= 80
      ? "stroke-green-500"
      : pct >= 60
      ? "stroke-blue-500"
      : pct >= 40
      ? "stroke-amber-500"
      : "stroke-red-500";

  // SVG circular gauge
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="10"
          />
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            className={ring}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s ease-in-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold font-display ${color}`}>
            {score}
          </span>
          <span className="text-xs text-slate-400">de {max}</span>
        </div>
      </div>
      <span className="text-sm font-medium text-slate-500 mt-1">
        Pontuação Total
      </span>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface CorrectionViewProps {
  essay: Essay;
  correction: Correction;
}

export function CorrectionView({ essay, correction }: CorrectionViewProps) {
  const [activeTab, setActiveTab] = useState<"analise" | "texto" | "insights">(
    "analise"
  );

  const competencies = correction.competencies ?? [];
  const criteria = correction.criteria ?? [];
  const items = competencies.length > 0 ? competencies : criteria;

  return (
    <div className="space-y-6">
      {/* Header — Score + tipo */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-card">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <TotalScore score={correction.total_score} max={correction.max_score} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {essay.essay_type === "enem" ? "Modelo ENEM" : "Vestibular"}
              </span>
              <span className="text-xs text-slate-300">•</span>
              <span className="text-xs text-slate-400">
                {essay.word_count} palavras
              </span>
            </div>
            <p className="text-slate-700 text-sm leading-relaxed line-clamp-3">
              {correction.general_feedback}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(["analise", "texto", "insights"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize",
              activeTab === tab
                ? "bg-white text-slate-900 shadow-card"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab === "analise"
              ? "Análise"
              : tab === "texto"
              ? "Texto"
              : "Insights"}
          </button>
        ))}
      </div>

      {/* Tab: Análise */}
      {activeTab === "analise" && (
        <div className="space-y-3">
          <h3 className="font-display font-semibold text-slate-900">
            {essay.essay_type === "enem"
              ? "Competências ENEM"
              : "Critérios de Avaliação"}
          </h3>
          {items.length > 0 ? (
            items.map((item, i) => (
              <CompetencyItem
                key={i}
                index={i + 1}
                name={"name" in item ? item.name : `Critério ${i + 1}`}
                score={item.score}
                max={item.max_score}
                feedback={item.feedback}
              />
            ))
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">
              Dados de competências não disponíveis para esta correção.
            </p>
          )}
        </div>
      )}

      {/* Tab: Texto */}
      {activeTab === "texto" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-slate-400" />
            <h3 className="font-display font-semibold text-slate-900">
              Texto da Redação
            </h3>
            {correction.highlights.length > 0 ? (
              <span className="ml-auto text-xs text-slate-400">
                {correction.highlights.length} grife
                {correction.highlights.length !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="ml-auto text-xs text-slate-400 bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                Grifes disponíveis no plano Standard/Pro
              </span>
            )}
          </div>
          <HighlightedText
            text={essay.content}
            highlights={correction.highlights}
          />
        </div>
      )}

      {/* Tab: Insights */}
      {activeTab === "insights" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <h3 className="font-display font-semibold text-slate-900">
              Insights para Melhorar
            </h3>
          </div>
          {correction.insights.length > 0 ? (
            correction.insights.map((insight, i) => (
              <div
                key={i}
                className="flex gap-3 bg-white border border-slate-100 rounded-xl p-4 shadow-card"
              >
                <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-slate-700 leading-relaxed">{insight}</p>
              </div>
            ))
          ) : (
            <div className="flex gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
              <MessageSquare className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                Insights detalhados disponíveis nos planos Standard e Pro.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
