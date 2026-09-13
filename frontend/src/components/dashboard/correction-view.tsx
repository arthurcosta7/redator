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
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Lightbulb,
  ListChecks,
  MessageSquare,
  Quote,
  Repeat2,
  Target,
} from "lucide-react";
import type {
  Correction,
  DetailedImprovement,
  DetailedStrength,
  Essay,
} from "@/types/essay";
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
          className={`h-full w-full origin-left rounded-full ${color}`}
          style={{ transform: `scaleX(${Math.min(Math.max(pct, 0), 100) / 100})` }}
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
  strengths,
  improvements,
  index,
}: {
  name: string;
  score: number;
  max: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
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
        <div className="space-y-4 border-t border-slate-100 bg-slate-50/40 px-4 pb-5 pt-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Diagnóstico do critério
            </p>
            <p className="text-sm leading-relaxed text-slate-700">{feedback}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {strengths.length > 0 && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" /> O que você acertou
                </p>
                <ul className="space-y-2">
                  {strengths.map((strength, strengthIndex) => (
                    <li key={`${strength}-${strengthIndex}`} className="text-sm leading-relaxed text-emerald-950">
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {improvements.length > 0 && (
              <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
                  <AlertTriangle className="h-4 w-4" /> O que corrigir agora
                </p>
                <ul className="space-y-2">
                  {improvements.map((improvement, improvementIndex) => (
                    <li key={`${improvement}-${improvementIndex}`} className="text-sm leading-relaxed text-amber-950">
                      {improvement}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function isDetailedStrength(
  strength: string | DetailedStrength
): strength is DetailedStrength {
  return typeof strength !== "string";
}

function isDetailedImprovement(
  improvement: string | DetailedImprovement
): improvement is DetailedImprovement {
  return typeof improvement !== "string";
}

function StrengthCard({ strength }: { strength: DetailedStrength }) {
  return (
    <article className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        {strength.title}
      </h4>
      <dl className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">
        <div>
          <dt className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-800">
            <Quote className="h-3.5 w-3.5" /> Evidência no texto
          </dt>
          <dd className="rounded-lg border border-emerald-100 bg-white/80 px-3 py-2 italic">
            “{strength.evidence}”
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-800">Por que está certo</dt>
          <dd>{strength.explanation}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 font-semibold text-slate-800">
            <Repeat2 className="h-3.5 w-3.5 text-emerald-600" /> Como repetir esse acerto
          </dt>
          <dd>{strength.repeat_strategy}</dd>
        </div>
      </dl>
    </article>
  );
}

function ImprovementCard({
  improvement,
  index,
}: {
  improvement: DetailedImprovement;
  index: number;
}) {
  return (
    <article className="rounded-xl border border-amber-100 bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-slate-900">{improvement.title}</h4>
          <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2 text-sm italic leading-relaxed text-amber-950">
            “{improvement.evidence}”
          </p>
        </div>
      </div>
      <dl className="mt-4 grid gap-4 text-sm leading-relaxed text-slate-700 md:grid-cols-2">
        <div>
          <dt className="font-semibold text-slate-900">Por que prejudica a nota</dt>
          <dd>{improvement.impact}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 font-semibold text-slate-900">
            <Target className="h-3.5 w-3.5 text-brand-600" /> Como melhorar
          </dt>
          <dd>{improvement.how_to_improve}</dd>
        </div>
        <div className="rounded-lg bg-brand-50/70 p-3 md:col-span-2">
          <dt className="font-semibold text-brand-900">Exemplo de reescrita</dt>
          <dd className="mt-1 text-brand-950">{improvement.rewrite_example}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="font-semibold text-slate-900">Exercício recomendado</dt>
          <dd>{improvement.practice}</dd>
        </div>
      </dl>
    </article>
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
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.77, 0, 0.175, 1)" }}
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
  const highlights = correction.highlights ?? [];
  const hasHighlightsAccess = correction.highlights !== undefined;
  const rawInsights = correction.insights;
  const structuredInsights =
    rawInsights && !Array.isArray(rawInsights) ? rawInsights : null;
  const legacyInsights = Array.isArray(rawInsights) ? rawInsights : [];
  const priorityImprovements =
    structuredInsights?.priority_improvements ?? legacyInsights;
  const mainStrengths = structuredInsights?.main_strengths ?? [];
  const hasInsightsAccess = rawInsights !== undefined;
  const generalFeedback =
    correction.general_feedback ?? structuredInsights?.general_feedback ?? "";

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
              {generalFeedback || "Correção concluída. Consulte a análise detalhada abaixo."}
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
                strengths={item.strengths ?? []}
                improvements={item.improvements ?? []}
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
            {highlights.length > 0 ? (
              <span className="ml-auto text-xs text-slate-400">
                {highlights.length} grife
                {highlights.length !== 1 ? "s" : ""}
              </span>
            ) : !hasHighlightsAccess ? (
              <span className="ml-auto text-xs text-slate-400 bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                Grifes disponíveis no plano Standard/Pro
              </span>
            ) : (
              <span className="ml-auto text-xs text-slate-400">
                Nenhum trecho grifado
              </span>
            )}
          </div>
          <HighlightedText
            text={essay.content}
            highlights={highlights}
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
          {structuredInsights && (
            <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-700 leading-relaxed">
                  {structuredInsights.general_feedback}
                </p>
                <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold capitalize text-brand-700">
                  Nível {structuredInsights.writing_level}
                </span>
              </div>

              {mainStrengths.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Principais pontos fortes
                  </p>
                  <ul className="space-y-2">
                    {mainStrengths.map((strength, index) => (
                      isDetailedStrength(strength) ? (
                        <li key={`${strength.title}-${index}`}>
                          <StrengthCard strength={strength} />
                        </li>
                      ) : (
                        <li key={`${strength}-${index}`} className="flex gap-3 text-sm leading-relaxed text-slate-700">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          {strength}
                        </li>
                      )
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {priorityImprovements.map((insight, index) => (
            isDetailedImprovement(insight) ? (
              <ImprovementCard key={`${insight.title}-${index}`} improvement={insight} index={index} />
            ) : (
              <div
                key={`${insight}-${index}`}
                className="flex gap-3 bg-white border border-slate-100 rounded-xl p-4 shadow-card"
              >
                <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {index + 1}
                </span>
                <p className="text-sm text-slate-700 leading-relaxed">{insight}</p>
              </div>
            )
          ))}

          {structuredInsights && (structuredInsights.next_essay_checklist?.length ?? 0) > 0 && (
            <section className="rounded-xl border border-brand-100 bg-brand-50/60 p-5">
              <h4 className="flex items-center gap-2 font-semibold text-brand-950">
                <ListChecks className="h-4 w-4" /> Checklist para a próxima redação
              </h4>
              <ul className="mt-3 space-y-2">
                {structuredInsights.next_essay_checklist?.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex gap-2 text-sm leading-relaxed text-brand-950">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!structuredInsights && priorityImprovements.length === 0 && !hasInsightsAccess ? (
            <div className="flex gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
              <MessageSquare className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                Insights detalhados disponíveis nos planos Standard e Pro.
              </p>
            </div>
          ) : !structuredInsights && priorityImprovements.length === 0 ? (
            <div className="flex gap-3 bg-slate-50 border border-slate-100 rounded-xl p-4">
              <MessageSquare className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600">
                Nenhum insight adicional foi gerado para esta correção.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
