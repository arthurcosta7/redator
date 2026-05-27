"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Users,
  ScrollText,
  TrendingUp,
  Loader2,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { api } from "@/lib/api/client";
import type {
  ProfessorOverviewAnalytics,
  TurmaFullAnalytics,
  StudentAnalytics,
} from "@/types/turma";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScoreBar({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <span className="text-xs text-slate-300 italic">sem dados</span>;
  const color = pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color = "brand" }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: "brand" | "purple" | "green" | "amber";
}) {
  const colors = {
    brand:  "bg-brand-50 text-brand-600",
    purple: "bg-purple-50 text-purple-600",
    green:  "bg-green-50 text-green-600",
    amber:  "bg-amber-50 text-amber-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-card flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold font-display text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Visão por turma ──────────────────────────────────────────────────────────

function TurmaAnalyticsView({ turmaId }: { turmaId: string }) {
  const [data, setData] = useState<TurmaFullAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<TurmaFullAnalytics>(`/professor/analytics/turma/${turmaId}`)
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [turmaId]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-400 animate-spin" /></div>;
  if (!data) return null;

  return (
    <div className="space-y-5">
      {/* Stats da turma */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 text-center shadow-card">
          <p className="text-2xl font-bold font-display text-slate-900">{data.active_members}</p>
          <p className="text-xs text-slate-400 mt-0.5">Alunos ativos</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 text-center shadow-card">
          <p className="text-2xl font-bold font-display text-slate-900">{data.total_essays}</p>
          <p className="text-xs text-slate-400 mt-0.5">Total de redações</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 text-center shadow-card">
          <p className="text-2xl font-bold font-display text-slate-900">{data.completed_essays}</p>
          <p className="text-xs text-slate-400 mt-0.5">Corrigidas</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 text-center shadow-card">
          <p className={`text-2xl font-bold font-display ${
            data.avg_score_pct == null ? "text-slate-300" :
            data.avg_score_pct >= 70 ? "text-green-600" :
            data.avg_score_pct >= 50 ? "text-amber-600" : "text-red-600"
          }`}>
            {data.avg_score_pct != null ? `${data.avg_score_pct}%` : "—"}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Média geral</p>
        </div>
      </div>

      {/* Tabela de alunos */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-semibold text-slate-900">Desempenho por Aluno</h4>
          <span className="text-xs text-slate-400">{data.students.length} alunos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Aluno</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase hidden sm:table-cell">Redações</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Média</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase hidden lg:table-cell">Última</th>
                <th className="px-5 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.students.map((s) => (
                <tr key={s.member_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-slate-900">{s.display_name}</p>
                    {s.email && <p className="text-xs text-slate-400">{s.email}</p>}
                    {!s.user_id && <span className="text-xs text-slate-300 italic">sem conta</span>}
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <span className="text-sm text-slate-600">{s.essay_count}</span>
                    {s.completed_count > 0 && (
                      <span className="text-xs text-slate-400 ml-1">({s.completed_count} ok)</span>
                    )}
                  </td>
                  <td className="px-5 py-4 w-40">
                    <ScoreBar pct={s.avg_score_pct} />
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-400 hidden lg:table-cell whitespace-nowrap">
                    {s.last_essay_at
                      ? new Date(s.last_essay_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                      : "—"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {s.user_id && (
                      <Link
                        href={`/dashboard/professor/analytics/aluno/${s.member_id}`}
                        className="text-xs text-brand-700 hover:text-brand-800 font-medium"
                      >
                        Detalhe →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const turmaId = searchParams.get("turma");

  const [overview, setOverview] = useState<ProfessorOverviewAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTurma, setSelectedTurma] = useState<string | null>(turmaId);

  useEffect(() => {
    api.get<ProfessorOverviewAnalytics>("/professor/analytics")
      .then((r) => setOverview(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {selectedTurma && (
          <button onClick={() => setSelectedTurma(null)}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-900">
            {selectedTurma
              ? overview?.turmas.find((t) => t.id === selectedTurma)?.name ?? "Analytics da Turma"
              : "Analytics"}
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {selectedTurma ? "Desempenho por aluno" : "Visão geral de todas as turmas"}
          </p>
        </div>
      </div>

      {/* Overview Stats */}
      {!selectedTurma && overview && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Turmas" value={overview.turma_count} icon={BarChart3} color="purple" />
            <StatCard label="Alunos ativos" value={overview.active_member_count} icon={Users} color="brand" />
            <StatCard label="Redações esta semana" value={overview.essays_this_week}
              sub={`${overview.total_essay_count} no total`} icon={ScrollText} color="green" />
            <StatCard
              label="Média geral"
              value={overview.avg_score_pct != null ? `${overview.avg_score_pct}%` : "—"}
              icon={TrendingUp} color="amber" />
          </div>

          {/* Turmas */}
          <div>
            <h3 className="font-display font-semibold text-slate-900 mb-3">Por Turma</h3>
            {overview.turmas.length === 0 ? (
              <p className="text-sm text-slate-400 p-4">Nenhuma turma criada.</p>
            ) : (
              <div className="space-y-3">
                {overview.turmas.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTurma(t.id)}
                    className="w-full bg-white rounded-xl border border-slate-100 shadow-card p-4 flex items-center gap-4
                               hover:shadow-card-hover transition-shadow text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                        <span className="text-xs text-slate-400">
                          {t.active_members} alunos · {t.essay_count} redações
                        </span>
                      </div>
                      <ScoreBar pct={t.avg_score_pct} />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Turma selecionada */}
      {selectedTurma && <TurmaAnalyticsView turmaId={selectedTurma} />}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <span className="w-6 h-6 border-2 border-brand-300 border-t-brand-700 rounded-full animate-spin" />
      </div>
    }>
      <AnalyticsContent />
    </Suspense>
  );
}
