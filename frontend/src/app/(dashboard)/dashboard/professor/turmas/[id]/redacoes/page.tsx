"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Filter, Loader2, ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api/client";
import type { TurmaEssaysResponse, TurmaEssay } from "@/types/turma";

const STATUS_LABELS: Record<string, string> = {
  pending:    "Pendente",
  processing: "Corrigindo",
  completed:  "Concluída",
  error:      "Erro",
};

const STATUS_STYLES: Record<string, string> = {
  pending:    "bg-slate-100 text-slate-600",
  processing: "bg-blue-50 text-blue-600",
  completed:  "bg-green-50 text-green-700",
  error:      "bg-red-50 text-red-600",
};

const PER_PAGE = 20;

export default function TurmaRedacoesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<TurmaEssaysResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [turmaName, setTurmaName] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
        if (filterStatus !== "all") params.set("status_filter", filterStatus);
        const res = await api.get<TurmaEssaysResponse>(`/professor/turmas/${id}/redacoes?${params}`);
        setData(res.data);
        if (!turmaName) {
          const turmaRes = await api.get<{ name: string }>(`/professor/turmas/${id}`);
          setTurmaName(turmaRes.data.name);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, page, filterStatus]);

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 1;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push(`/dashboard/professor/turmas/${id}`)}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-900">Redações da Turma</h2>
          {turmaName && <p className="text-slate-400 text-sm">{turmaName}</p>}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-slate-400" />
        {(["all", "completed", "processing", "pending", "error"] as const).map((v) => (
          <button key={v}
            onClick={() => { setFilterStatus(v); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === v
                ? "bg-brand-700 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}>
            {v === "all" ? "Todos" : STATUS_LABELS[v] ?? v}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
        </div>
      ) : data && data.items.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Aluno</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Redação</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase hidden sm:table-cell">Modelo</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Nota</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase hidden md:table-cell">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase hidden lg:table-cell">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.items.map((essay) => (
                  <tr key={essay.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-slate-900">{essay.student_name}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-slate-700 line-clamp-1 max-w-[180px]">{essay.title ?? "Sem título"}</p>
                      <p className="text-xs text-slate-400">{essay.word_count} palavras</p>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <span className="text-xs font-semibold uppercase text-slate-500">
                        {essay.essay_type === "enem" ? "ENEM" : "Vestibular"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {essay.status === "completed" && essay.total_score != null && essay.max_score != null ? (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          (essay.total_score / essay.max_score) >= 0.7 ? "bg-green-50 text-green-700" :
                          (essay.total_score / essay.max_score) >= 0.5 ? "bg-amber-50 text-amber-700" :
                          "bg-red-50 text-red-700"
                        }`}>
                          {Math.round(essay.total_score / essay.max_score * 100)}%
                        </span>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[essay.status] ?? ""}`}>
                        {STATUS_LABELS[essay.status] ?? essay.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400 hidden lg:table-cell whitespace-nowrap">
                      {new Date(essay.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 text-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ScrollText className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-slate-500 text-sm">
            {filterStatus !== "all" ? "Nenhuma redação com este filtro." : "Nenhuma redação enviada pelos alunos ainda."}
          </p>
        </div>
      )}

      {data && data.total > PER_PAGE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {Math.min((page - 1) * PER_PAGE + 1, data.total)}–{Math.min(page * PER_PAGE, data.total)} de {data.total}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="flex items-center px-3 text-sm text-slate-600 font-medium">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
