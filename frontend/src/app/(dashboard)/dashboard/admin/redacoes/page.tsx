"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Hourglass,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import type { AdminEssayItem, AdminEssaysResponse } from "@/types/admin";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    completed: { label: "Concluída", className: "bg-green-50 text-green-700", icon: CheckCircle2 },
    pending: { label: "Pendente", className: "bg-amber-50 text-amber-700", icon: Clock },
    processing: { label: "Processando", className: "bg-blue-50 text-blue-700", icon: Hourglass },
    error: { label: "Erro", className: "bg-red-50 text-red-700", icon: XCircle },
  };
  const s = map[status] ?? { label: status, className: "bg-slate-100 text-slate-600", icon: FileText };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${s.className}`}>
      <Icon className="w-3 h-3" />
      {s.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
      type === "enem" ? "bg-brand-50 text-brand-700" : "bg-purple-50 text-purple-700"
    }`}>
      {type === "enem" ? "ENEM" : "Vestibular"}
    </span>
  );
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  const color = pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-600 font-medium">
        {score}/{max}
      </span>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AdminEssaysPage() {
  const [data, setData] = useState<AdminEssaysResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchEssays = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "20",
        ...(search && { search }),
        ...(typeFilter && { essay_type: typeFilter }),
        ...(statusFilter && { essay_status: statusFilter }),
      });
      const res = await api.get<AdminEssaysResponse>(`/admin/essays?${params}`);
      setData(res.data);
    } catch {
      setError("Erro ao carregar redações.");
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter]);

  useEffect(() => {
    fetchEssays();
  }, [fetchEssays]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-900">Redações</h1>
        <p className="text-slate-500 text-sm mt-1">
          {data ? `${data.total.toLocaleString("pt-BR")} redações no total` : "Listagem de todas as redações"}
        </p>
      </div>

      {error && (
        <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por email ou nome do usuário…"
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-50 transition-colors"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-700 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors"
            >
              Buscar
            </button>
          </form>

          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-brand-400 bg-white"
          >
            <option value="">Todos os tipos</option>
            <option value="enem">ENEM</option>
            <option value="vestibular">Vestibular</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-brand-400 bg-white"
          >
            <option value="">Todos os status</option>
            <option value="completed">Concluídas</option>
            <option value="pending">Pendentes</option>
            <option value="processing">Processando</option>
            <option value="error">Com erro</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 text-brand-500 animate-spin" />
          </div>
        ) : !data?.items.length ? (
          <div className="text-center py-16 text-slate-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma redação encontrada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Redação</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Usuário</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Nota</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden xl:table-cell">Data</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.items.map((essay) => (
                  <tr key={essay.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate max-w-[200px]">
                          {essay.title ?? "Sem título"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {essay.word_count ? `${essay.word_count} palavras` : "—"} · {essay.input_type === "text" ? "Texto" : "Foto"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <p className="text-slate-700 font-medium truncate max-w-[160px]">{essay.user_name}</p>
                      <p className="text-xs text-slate-400 truncate max-w-[160px]">{essay.user_email}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <TypeBadge type={essay.essay_type} />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={essay.status} />
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      {essay.total_score != null && essay.max_score != null ? (
                        <ScoreBar score={essay.total_score} max={essay.max_score} />
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 hidden xl:table-cell text-xs text-slate-400">
                      {new Date(essay.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3.5">
                      {essay.status === "completed" && (
                        <Link
                          href={`/dashboard/aluno/correcao/${essay.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium"
                        >
                          Ver <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > data.per_page && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Página {data.page} de {Math.ceil(data.total / data.per_page)} · {data.total} redações
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!data.has_more}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
