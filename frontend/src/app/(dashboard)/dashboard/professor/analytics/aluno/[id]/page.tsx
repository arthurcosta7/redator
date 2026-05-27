"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, ScrollText, TrendingUp } from "lucide-react";
import { api } from "@/lib/api/client";
import type { StudentFullAnalytics, TurmaEssay } from "@/types/turma";

function ScoreChip({ score, max }: { score: number; max: number }) {
  const pct = (score / max) * 100;
  const color = pct >= 70 ? "bg-green-50 text-green-700" : pct >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${color}`}>{Math.round(pct)}%</span>;
}

export default function StudentAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<StudentFullAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<StudentFullAnalytics>(`/professor/analytics/aluno/${id}`)
      .then((r) => setData(r.data))
      .catch(() => router.push("/dashboard/professor/analytics"))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return <div className="flex justify-center h-64 items-center"><Loader2 className="w-6 h-6 text-brand-400 animate-spin" /></div>;
  if (!data) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-900">{data.display_name}</h2>
          <p className="text-slate-400 text-sm">
            {data.email ?? "Sem conta"} · Turma: {data.turma_name}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 text-center shadow-card">
          <p className="text-2xl font-bold font-display text-slate-900">{data.essay_count}</p>
          <p className="text-xs text-slate-400 mt-0.5">Redações</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 text-center shadow-card">
          <p className="text-2xl font-bold font-display text-slate-900">{data.completed_count}</p>
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
          <p className="text-xs text-slate-400 mt-0.5">Média</p>
        </div>
      </div>

      {/* Histórico de redações */}
      <div>
        <h3 className="font-display font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-slate-400" />
          Histórico de Redações
        </h3>

        {data.essays.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-8 text-center">
            <p className="text-sm text-slate-400">
              {data.user_id ? "Nenhuma redação enviada ainda." : "Aluno sem conta — sem redações."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Redação</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase hidden sm:table-cell">Modelo</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Nota</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase hidden md:table-cell">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.essays.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{e.title ?? "Sem título"}</p>
                      <p className="text-xs text-slate-400">{e.word_count} palavras</p>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <span className="text-xs font-semibold uppercase text-slate-500">
                        {e.essay_type === "enem" ? "ENEM" : "Vestibular"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {e.status === "completed" && e.total_score != null && e.max_score != null ? (
                        <ScoreChip score={e.total_score} max={e.max_score} />
                      ) : (
                        <span className="text-xs text-slate-400">{e.status}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400 hidden md:table-cell whitespace-nowrap">
                      {new Date(e.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
