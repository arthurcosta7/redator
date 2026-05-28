"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Plus,
  Mail,
  UserPlus,
  Loader2,
  X,
  AlertCircle,
  Trash2,
  ScrollText,
  TrendingUp,
  BarChart3,
  ChevronRight,
  Clock,
  CheckCircle2,
  ClipboardList,
  CalendarClock,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api/client";
import type { TurmaDetail, TurmaMembro, TurmaEssay, TurmaEssaysResponse, TarefaListItem } from "@/types/turma";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScoreBar({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <span className="text-xs text-slate-300">—</span>;
  const color = pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-600 w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:   { label: "Ativo",     cls: "bg-green-50 text-green-700" },
    pending:  { label: "Pendente",  cls: "bg-amber-50 text-amber-700" },
    removed:  { label: "Removido",  cls: "bg-slate-100 text-slate-500" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-500" };
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cls}`}>{label}</span>;
}

// ─── Modal: Adicionar aluno offline ──────────────────────────────────────────

function AddOfflineModal({
  turmaId,
  onClose,
  onAdd,
}: {
  turmaId: string;
  onClose: () => void;
  onAdd: (m: TurmaMembro) => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<TurmaMembro>(`/professor/turmas/${turmaId}/membros`, {
        display_name: name.trim(),
      });
      onAdd(res.data);
    } catch (err: any) {
      const msg = err?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Erro ao adicionar aluno.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-bold text-lg text-slate-900">Adicionar Aluno</h3>
            <p className="text-xs text-slate-400 mt-0.5">Aluno sem conta no sistema</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        {error && (
          <div className="flex gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nome do aluno *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="Ex: João da Silva"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none
                         focus:border-brand-400 focus:ring-2 focus:ring-brand-50 transition-colors"
              required
              autoFocus
            />
          </div>
          <p className="text-xs text-slate-400">
            O aluno será adicionado sem acesso ao sistema. Nenhum dado de redação estará disponível.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={!name.trim() || loading}
              className="flex-1 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Convidar por email ────────────────────────────────────────────────

function InviteModal({
  turmaId,
  onClose,
  onInvite,
}: {
  turmaId: string;
  onClose: () => void;
  onInvite: (m: TurmaMembro) => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<TurmaMembro>(`/professor/turmas/${turmaId}/convidar`, {
        email: email.trim().toLowerCase(),
      });
      onInvite(res.data);
    } catch (err: any) {
      const msg = err?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Erro ao enviar convite.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-bold text-lg text-slate-900">Convidar Aluno</h3>
            <p className="text-xs text-slate-400 mt-0.5">Aluno com conta no Redator</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        {error && (
          <div className="flex gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email do aluno *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aluno@email.com"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none
                         focus:border-brand-400 focus:ring-2 focus:ring-brand-50 transition-colors"
              required
              autoFocus
            />
          </div>
          <p className="text-xs text-slate-400">
            O aluno receberá um convite pendente no painel dele e poderá aceitar ou recusar.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={!email.trim() || loading}
              className="flex-1 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <Mail className="w-4 h-4" />
              Enviar Convite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

type ModalState = null | "offline" | "invite";

export default function TurmaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [turma, setTurma] = useState<TurmaDetail | null>(null);
  const [essays, setEssays] = useState<TurmaEssay[]>([]);
  const [tarefas, setTarefas] = useState<TarefaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadTurma = useCallback(async () => {
    try {
      const [turmaRes, essayRes, tarefasRes] = await Promise.all([
        api.get<TurmaDetail>(`/professor/turmas/${id}`),
        api.get<TurmaEssaysResponse>(`/professor/turmas/${id}/redacoes?per_page=5`),
        api.get<TarefaListItem[]>(`/professor/turmas/${id}/tarefas`),
      ]);
      setTurma(turmaRes.data);
      setEssays(essayRes.data.items);
      setTarefas(tarefasRes.data);
    } catch {
      router.push("/dashboard/professor/turmas");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { loadTurma(); }, [loadTurma]);

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Remover este aluno da turma?")) return;
    setRemovingId(memberId);
    try {
      await api.delete(`/professor/turmas/${id}/membros/${memberId}`);
      setTurma((prev) =>
        prev ? {
          ...prev,
          members: prev.members.map((m) =>
            m.id === memberId ? { ...m, status: "removed" as const } : m
          ).filter((m) => m.status !== "removed"),
        } : prev
      );
    } catch {
      // ignore
    } finally {
      setRemovingId(null);
    }
  };

  const handleAddMember = (m: TurmaMembro) => {
    setTurma((prev) => prev ? { ...prev, members: [...prev.members, m] } : prev);
    setModal(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
      </div>
    );
  }

  if (!turma) return null;

  const visibleMembers = turma.members.filter((m) => m.status !== "removed");
  const activeMembers = visibleMembers.filter((m) => m.status === "active");
  const pendingMembers = visibleMembers.filter((m) => m.status === "pending");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {modal === "offline" && (
        <AddOfflineModal turmaId={id} onClose={() => setModal(null)} onAdd={handleAddMember} />
      )}
      {modal === "invite" && (
        <InviteModal turmaId={id} onClose={() => setModal(null)} onInvite={handleAddMember} />
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.push("/dashboard/professor/turmas")}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 mt-1"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-2xl text-slate-900">{turma.name}</h2>
          {turma.description && (
            <p className="text-slate-400 text-sm mt-0.5 line-clamp-2">{turma.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
            <span>{turma.active_member_count} ativo{turma.active_member_count !== 1 ? "s" : ""}</span>
            {turma.member_count > turma.active_member_count && (
              <span className="text-amber-500">· {turma.member_count - turma.active_member_count} pendente{turma.member_count - turma.active_member_count !== 1 ? "s" : ""}</span>
            )}
            <span>· {turma.essay_count} redaç{turma.essay_count !== 1 ? "ões" : "ão"}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setModal("offline")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Adicionar
          </button>
          <button
            onClick={() => setModal("invite")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-xs font-medium text-white transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            Convidar
          </button>
        </div>
      </div>

      {/* Analytics links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href={`/dashboard/professor/analytics?turma=${id}`}
          className="bg-white rounded-xl border border-slate-100 p-4 shadow-card hover:shadow-card-hover transition-shadow flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center">
            <BarChart3 className="w-4.5 h-4.5 text-brand-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Analytics da Turma</p>
            <p className="text-xs text-slate-400">Desempenho por aluno</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </Link>
        <Link
          href={`/dashboard/professor/turmas/${id}/redacoes`}
          className="bg-white rounded-xl border border-slate-100 p-4 shadow-card hover:shadow-card-hover transition-shadow flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
            <ScrollText className="w-4.5 h-4.5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Redações da Turma</p>
            <p className="text-xs text-slate-400">{turma.essay_count} no total</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </Link>
      </div>

      {/* Tarefas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-slate-400" />
            Tarefas <span className="text-slate-400 font-normal text-sm">({tarefas.length})</span>
          </h3>
          <Link
            href={`/dashboard/professor/turmas/${id}/tarefas/nova`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-xs font-medium text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Tarefa
          </Link>
        </div>

        {tarefas.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-6 text-center">
            <p className="text-sm text-slate-400">
              Nenhuma tarefa criada. Crie uma tarefa para seus alunos entregarem redações.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tarefas.map((t) => {
              const isPastDue = t.due_date && new Date(t.due_date) < new Date();
              return (
                <Link
                  key={t.id}
                  href={`/dashboard/professor/turmas/${id}/tarefas/${t.id}`}
                  className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-3 hover:shadow-card-hover transition-shadow"
                >
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <ClipboardList className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900 truncate">{t.title}</p>
                      {t.is_ai_generated && (
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" title="Gerada por IA" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{t.theme}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-slate-400">
                      {t.submission_count} entrega{t.submission_count !== 1 ? "s" : ""}
                    </span>
                    {t.due_date && (
                      <span className={`flex items-center gap-1 text-xs font-medium ${isPastDue ? "text-red-500" : "text-slate-400"}`}>
                        <CalendarClock className="w-3.5 h-3.5" />
                        {new Date(t.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Membros ativos */}
      <div>
        <h3 className="font-display font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          Alunos Ativos <span className="text-slate-400 font-normal text-sm">({activeMembers.length})</span>
        </h3>

        {activeMembers.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-6 text-center">
            <p className="text-sm text-slate-400">
              Nenhum aluno ativo. Use os botões acima para adicionar ou convidar.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Aluno</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Redações</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Média</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Última</th>
                    <th className="px-5 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {activeMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-900">{m.display_name ?? "Aluno"}</p>
                        {m.email && <p className="text-xs text-slate-400 mt-0.5">{m.email}</p>}
                        {!m.user_id && (
                          <span className="text-xs text-slate-300 italic">sem conta</span>
                        )}
                      </td>
                      <td className="px-5 py-4 hidden sm:table-cell">
                        <span className="text-sm text-slate-600">{m.essay_count}</span>
                        {m.completed_count > 0 && (
                          <span className="text-xs text-slate-400 ml-1">({m.completed_count} ok)</span>
                        )}
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell w-36">
                        <ScoreBar pct={m.avg_score_pct} />
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-400 hidden lg:table-cell whitespace-nowrap">
                        {m.last_essay_at
                          ? new Date(m.last_essay_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                          : "—"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {m.user_id && (
                            <Link
                              href={`/dashboard/professor/analytics/aluno/${m.id}`}
                              className="text-xs text-brand-700 hover:text-brand-800 font-medium"
                            >
                              Ver →
                            </Link>
                          )}
                          <button
                            onClick={() => handleRemoveMember(m.id)}
                            disabled={removingId === m.id}
                            className="p-1 rounded text-slate-300 hover:text-red-400 transition-colors disabled:opacity-40"
                            title="Remover aluno"
                          >
                            {removingId === m.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />
                            }
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Convites pendentes */}
      {pendingMembers.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Convites Pendentes <span className="text-slate-400 font-normal text-sm">({pendingMembers.length})</span>
          </h3>
          <div className="space-y-2">
            {pendingMembers.map((m) => (
              <div
                key={m.id}
                className="bg-amber-50 border border-amber-100 rounded-xl px-5 py-3 flex items-center gap-3"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{m.display_name ?? m.email ?? "Aluno"}</p>
                  {m.email && <p className="text-xs text-slate-400">{m.email}</p>}
                </div>
                <span className="text-xs text-amber-600 font-medium">Aguardando aceite</span>
                <button
                  onClick={() => handleRemoveMember(m.id)}
                  disabled={removingId === m.id}
                  className="p-1 rounded text-amber-300 hover:text-red-400 transition-colors"
                  title="Cancelar convite"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Redações recentes */}
      {essays.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-slate-900">Redações Recentes</h3>
            <Link
              href={`/dashboard/professor/turmas/${id}/redacoes`}
              className="text-sm text-brand-700 hover:text-brand-800 font-medium"
            >
              Ver todas →
            </Link>
          </div>
          <div className="space-y-2">
            {essays.map((essay) => (
              <div
                key={essay.id}
                className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-brand-700 uppercase">
                    {essay.essay_type === "enem" ? "EN" : "VB"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{essay.title ?? "Sem título"}</p>
                  <p className="text-xs text-slate-400">{essay.student_name}</p>
                </div>
                {essay.status === "completed" && essay.total_score != null && essay.max_score != null ? (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    (essay.total_score / essay.max_score) >= 0.7 ? "bg-green-50 text-green-700" :
                    (essay.total_score / essay.max_score) >= 0.5 ? "bg-amber-50 text-amber-700" :
                    "bg-red-50 text-red-700"
                  }`}>
                    {Math.round(essay.total_score / essay.max_score * 100)}%
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">{essay.status}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
