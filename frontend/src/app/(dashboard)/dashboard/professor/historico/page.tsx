"use client";

/** Histórico paginado das correções avulsas feitas na conta do professor. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ScrollText, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api/client";
import type { EssayListItem, EssayListResponse } from "@/types/essay";
import type { EssayType, EssayStatus } from "@/types/essay";

const STATUS_LABELS: Record<EssayStatus, string> = {
  pending:    "Pendente",
  processing: "Corrigindo",
  completed:  "Concluída",
  error:      "Erro",
};

const STATUS_STYLES: Record<EssayStatus, string> = {
  pending:    "bg-slate-100 text-slate-600",
  processing: "bg-blue-50 text-blue-600",
  completed:  "bg-green-50 text-green-700",
  error:      "bg-red-50 text-red-600",
};

function ScoreDisplay({ score, max }: { score: number | null; max: number | null }) {
  if (score === null || max === null) return <span className="text-slate-300">—</span>;
  const pct = (score / max) * 100;
  const color = pct >= 70 ? "text-green-700" : pct >= 50 ? "text-brand-700" : pct >= 40 ? "text-amber-700" : "text-red-700";
  return (
    <span className={`font-bold text-sm ${color}`}>
      {Math.round(pct)}%<span className="font-normal text-slate-400 text-xs ml-1">{score}/{max}</span>
    </span>
  );
}

const PER_PAGE = 10;

export default function ProfessorHistoricoPage() {
  const [data, setData] = useState<EssayListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<EssayType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<EssayStatus | "all">("all");

  useEffect(() => {
    // Paginação e filtros ficam no servidor para não carregar todo o histórico
    // no navegador nem produzir contagens diferentes das exibidas pela API.
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
        if (filterType !== "all") params.set("essay_type", filterType);
        if (filterStatus !== "all") params.set("status", filterStatus);
        const res = await api.get<EssayListResponse>(`/essays?${params}`);
        setData(res.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [page, filterType, filterStatus]);

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 1;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-900">Histórico</h2>
          <p className="text-slate-500 text-sm mt-0.5">Suas redações corrigidas pela IA</p>
        </div>
        <Link
          href="/dashboard/professor/nova-redacao"
          className="bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          + Nova Redação
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-slate-400" />
        <div className="flex gap-1">
          {(["all", "enem", "vestibular"] as const).map((v) => (
            <button key={v}
              onClick={() => { setFilterType(v); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterType === v ? "bg-brand-700 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}>
              {v === "all" ? "Todos" : v === "enem" ? "ENEM" : "Vestibular"}
            </button>
          ))}
        </div>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <div className="flex gap-1">
          {(["all", "completed", "processing", "error"] as const).map((v) => (
            <button key={v}
              onClick={() => { setFilterStatus(v); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === v ? "bg-slate-700 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}>
              {v === "all" ? "Todos" : STATUS_LABELS[v]}
            </button>
          ))}
        </div>
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
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Redação</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Modelo</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Nota</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Status</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Data</th>
                  <th className="px-5 py-3.5 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.items.map((essay) => (
                  <tr key={essay.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-slate-900 line-clamp-1 max-w-[200px]">{essay.title ?? "Sem título"}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{essay.word_count} palavras</p>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <span className="text-xs font-semibold uppercase text-slate-500">
                        {essay.essay_type === "enem" ? "ENEM" : "Vestibular"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <ScoreDisplay score={essay.total_score} max={essay.max_score} />
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[essay.status]}`}>
                        {STATUS_LABELS[essay.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400 hidden lg:table-cell whitespace-nowrap">
                      {new Date(essay.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {essay.status === "completed" ? (
                        <Link href={`/dashboard/professor/correcao/${essay.id}`}
                          className="text-xs font-semibold text-brand-700 hover:text-brand-800 whitespace-nowrap">
                          Ver →
                        </Link>
                      ) : (
                        <Link href={`/dashboard/professor/correcao/${essay.id}`}
                          className="text-xs font-medium text-slate-400 hover:text-slate-600 whitespace-nowrap">
                          Status →
                        </Link>
                      )}
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
            {filterType !== "all" || filterStatus !== "all"
              ? "Nenhuma redação com esses filtros."
              : "Nenhuma redação enviada."}
          </p>
          <Link href="/dashboard/professor/nova-redacao"
            className="mt-4 inline-block text-sm text-brand-700 font-medium hover:text-brand-800">
            Enviar a primeira →
          </Link>
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
