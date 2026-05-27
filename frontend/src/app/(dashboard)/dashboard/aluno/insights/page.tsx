"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, BarChart3, Target, Lightbulb, RefreshCw, Lock } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api/client";

interface CompetencyAvg {
  number: number;
  name: string;
  avg_score: number;
  max_score: number;
  avg_percentage: number;
}

interface InsightsSummary {
  period_days: number;
  total_corrections: number;
  avg_score: number;
  avg_score_percentage: number;
  score_trend: string;
  competency_averages: CompetencyAvg[];
  weakest_competency: CompetencyAvg | null;
  strongest_competency: CompetencyAvg | null;
  most_common_improvements: string[];
  writing_level: string;
  corrections_by_type: Record<string, number>;
  last_correction_at: string | null;
  from_cache: boolean;
}

const TREND_CONFIG = {
  improving:          { label: "Evoluindo",  icon: TrendingUp,   color: "text-green-600",  bg: "bg-green-50"  },
  stable:             { label: "Estável",    icon: Minus,        color: "text-slate-500",  bg: "bg-slate-50"  },
  declining:          { label: "Caindo",     icon: TrendingDown, color: "text-red-500",    bg: "bg-red-50"    },
  insufficient_data:  { label: "Poucos dados", icon: Minus,      color: "text-slate-400",  bg: "bg-slate-50"  },
};

const LEVEL_COLORS: Record<string, string> = {
  "iniciante":     "bg-orange-100 text-orange-700",
  "intermediário": "bg-blue-100 text-blue-700",
  "avançado":      "bg-green-100 text-green-700",
  "sem dados":     "bg-slate-100 text-slate-500",
};

function PlanGate() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Lock className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="font-display font-bold text-lg text-slate-900 mb-2">
        Recurso exclusivo
      </h3>
      <p className="text-slate-500 text-sm max-w-xs">
        Insights dos seus últimos 30 dias estão disponíveis nos planos Standard e Pro.
      </p>
      <a
        href="/dashboard/aluno/plano"
        className="mt-6 bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
      >
        Ver planos
      </a>
    </div>
  );
}

export default function InsightsPage() {
  const { user } = useUser();
  const [data, setData] = useState<InsightsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isPaid = user?.plan === "standard" || user?.plan === "pro";

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<InsightsSummary>("/insights/summary");
      setData(res.data);
    } catch {
      setError("Não foi possível carregar os insights.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isPaid) load();
    else setLoading(false);
  }, [isPaid]);

  const trend = data ? TREND_CONFIG[data.score_trend as keyof typeof TREND_CONFIG] : null;
  const TrendIcon = trend?.icon ?? Minus;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-900">Insights</h2>
          <p className="text-slate-500 text-sm mt-1">Resumo dos seus últimos 30 dias</p>
        </div>
        {isPaid && data && (
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        )}
      </div>

      {!isPaid && <PlanGate />}

      {isPaid && loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 h-28 animate-pulse bg-slate-50" />
          ))}
        </div>
      )}

      {isPaid && error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center text-sm text-red-600">
          {error}
        </div>
      )}

      {isPaid && !loading && data && (
        <>
          {/* Sem dados ainda */}
          {data.total_corrections === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">
                Nenhuma correção nos últimos 30 dias. Envie sua primeira redação para ver os insights.
              </p>
            </div>
          ) : (
            <>
              {/* Cards de resumo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Correções</p>
                  <p className="font-display font-bold text-3xl text-slate-900">{data.total_corrections}</p>
                  <p className="text-xs text-slate-400 mt-1">nos últimos 30 dias</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Média geral</p>
                  <p className="font-display font-bold text-3xl text-slate-900">
                    {data.avg_score_percentage.toFixed(0)}
                    <span className="text-lg text-slate-400">%</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{data.avg_score.toFixed(0)} pts</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Tendência</p>
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold mt-1 ${trend?.bg} ${trend?.color}`}>
                    <TrendIcon className="w-4 h-4" />
                    {trend?.label}
                  </div>
                  <p className={`text-xs mt-2 ${LEVEL_COLORS[data.writing_level] ? "" : "text-slate-400"}`}>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${LEVEL_COLORS[data.writing_level] ?? "bg-slate-100 text-slate-500"}`}>
                      {data.writing_level}
                    </span>
                  </p>
                </div>
              </div>

              {/* Competências */}
              {data.competency_averages.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <BarChart3 className="w-4 h-4 text-brand-600" />
                    <h3 className="font-semibold text-slate-900 text-sm">Desempenho por competência</h3>
                  </div>
                  <div className="space-y-4">
                    {data.competency_averages.map((comp) => (
                      <div key={comp.number}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm text-slate-600">
                            <span className="font-semibold text-slate-800">C{comp.number}</span> — {comp.name}
                          </span>
                          <span className="text-sm font-semibold text-slate-700">
                            {comp.avg_score.toFixed(0)}
                            <span className="text-slate-400 font-normal">/{comp.max_score}</span>
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              comp.avg_percentage >= 70
                                ? "bg-green-400"
                                : comp.avg_percentage >= 50
                                ? "bg-amber-400"
                                : "bg-red-400"
                            }`}
                            style={{ width: `${comp.avg_percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {(data.weakest_competency || data.strongest_competency) && (
                    <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-slate-100">
                      {data.strongest_competency && (
                        <div className="bg-green-50 rounded-xl p-3">
                          <p className="text-xs text-green-600 font-medium mb-0.5">Ponto forte</p>
                          <p className="text-sm font-semibold text-green-800">C{data.strongest_competency.number}</p>
                          <p className="text-xs text-green-600 truncate">{data.strongest_competency.name}</p>
                        </div>
                      )}
                      {data.weakest_competency && (
                        <div className="bg-orange-50 rounded-xl p-3">
                          <p className="text-xs text-orange-600 font-medium mb-0.5">A melhorar</p>
                          <p className="text-sm font-semibold text-orange-800">C{data.weakest_competency.number}</p>
                          <p className="text-xs text-orange-600 truncate">{data.weakest_competency.name}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Melhorias prioritárias */}
              {data.most_common_improvements.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="w-4 h-4 text-brand-600" />
                    <h3 className="font-semibold text-slate-900 text-sm">Foco de melhoria recorrente</h3>
                  </div>
                  <ul className="space-y-2">
                    {data.most_common_improvements.map((imp, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                        <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        {imp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.from_cache && (
                <p className="text-xs text-slate-400 text-center">
                  Dados em cache — atualizados automaticamente a cada hora.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
