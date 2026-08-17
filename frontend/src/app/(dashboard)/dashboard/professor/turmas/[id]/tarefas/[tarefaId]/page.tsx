"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CalendarClock,
  BookOpen,
  MessageSquare,
  CheckCircle2,
  Clock,
  Sparkles,
  Trash2,
  ExternalLink,
  BarChart3,
  Lock,
  TrendingUp,
  Users,
  XCircle,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useUser } from "@/contexts/UserContext";
import type { TarefaWithSubmissoes, SubmissaoItem } from "@/types/turma";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScorePill({ score, max }: { score: number; max: number }) {
  const pct = (score / max) * 100;
  const cls =
    pct >= 70
      ? "bg-green-50 text-green-700"
      : pct >= 50
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";
  const label = max === 1000 ? `${Math.round(score)}` : `${pct.toFixed(0)}%`;
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
  );
}

// ─── Insights Panel ───────────────────────────────────────────────────────────

interface TarefaInsights {
  tarefa_id: string;
  submission_count: number;
  corrected_count: number;
  avg_score_pct: number | null;
  max_score: number | null;
  score_distribution: { range: string; count: number }[];
  competency_averages: { name: string; avg_pct: number }[];
  ranking: { student_name: string; total_score: number; max_score: number; score_pct: number }[];
}

function InsightsPanel({ tarefaId, isPaid }: { tarefaId: string; isPaid: boolean }) {
  const [data, setData] = useState<TarefaInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (data) { setOpen(true); return; }
    setLoading(true);
    try {
      const res = await api.get<TarefaInsights>(`/professor/tarefas/${tarefaId}/insights`);
      setData(res.data);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  if (!isPaid) {
    return (
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
          <Lock className="w-5 h-5 text-slate-400" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-700 text-sm">Insights por Tarefa</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Disponível para professores com pacote de alunos ativo. Inclui distribuição de notas,
            médias por competência e ranking dos alunos.
          </p>
          <a
            href="/dashboard/professor/plano"
            className="inline-block mt-2 text-xs font-semibold text-brand-700 hover:text-brand-800"
          >
            Ver planos →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
      <button
        onClick={open ? () => setOpen(false) : load}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2 font-display font-semibold text-slate-900 text-sm">
          <BarChart3 className="w-4 h-4 text-brand-500" />
          Insights da Tarefa
          <span className="text-xs font-medium bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">Pago</span>
        </span>
        {loading
          ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          : <span className="text-xs text-slate-400">{open ? "▲ fechar" : "▼ ver insights"}</span>}
      </button>

      {open && data && (
        <div className="border-t border-slate-100 p-5 space-y-5">
          {data.corrected_count === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">
              Nenhuma submissão corrigida ainda.
            </p>
          ) : (
            <>
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold font-display text-slate-900">
                    {data.corrected_count}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Corrigidas</p>
                </div>
                <div className="bg-brand-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold font-display text-brand-700">
                    {data.avg_score_pct != null ? `${data.avg_score_pct.toFixed(0)}%` : "—"}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Média geral</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold font-display text-slate-900">
                    {data.submission_count}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Entregas</p>
                </div>
              </div>

              {/* Distribuição */}
              {data.score_distribution.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> Distribuição de Notas
                  </p>
                  <div className="space-y-1.5">
                    {data.score_distribution.map((b) => {
                      const pct = data.corrected_count > 0 ? (b.count / data.corrected_count) * 100 : 0;
                      return (
                        <div key={b.range} className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 w-14 text-right">{b.range}%</span>
                          <div className="flex-1 h-5 bg-slate-100 rounded-md overflow-hidden">
                            <div
                              className="h-full w-full origin-left bg-brand-400 rounded-md"
                              style={{ transform: `scaleX(${Math.min(Math.max(pct, 0), 100) / 100})` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-600 w-8">{b.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Médias por competência */}
              {data.competency_averages.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Média por Competência
                  </p>
                  <div className="space-y-2">
                    {data.competency_averages.map((c) => {
                      const color = c.avg_pct >= 70 ? "bg-green-400" : c.avg_pct >= 50 ? "bg-amber-400" : "bg-red-400";
                      return (
                        <div key={c.name}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs text-slate-600 truncate max-w-[70%]">{c.name}</span>
                            <span className="text-xs font-semibold text-slate-700">{c.avg_pct.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${color} rounded-full`} style={{ width: `${c.avg_pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ranking */}
              {data.ranking.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Ranking dos Alunos
                  </p>
                  <div className="space-y-1">
                    {data.ranking.map((r, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50">
                        <span className={`text-xs font-bold w-5 text-center ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-slate-300"}`}>
                          {i + 1}
                        </span>
                        <span className="flex-1 text-sm text-slate-700 truncate">{r.student_name}</span>
                        <ScorePill score={r.total_score} max={r.max_score} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Comentário inline ────────────────────────────────────────────────────────

function CommentCell({
  tarefaId,
  sub,
}: {
  tarefaId: string;
  sub: SubmissaoItem;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(sub.teacher_comment ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`/professor/tarefas/${tarefaId}/comentario/${sub.id}`, {
        comment: value.trim(),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={1000}
          rows={3}
          className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-400 resize-none"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-1.5 rounded-lg bg-brand-700 text-white text-xs font-semibold disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Salvar"}
          </button>
          <button
            onClick={() => { setEditing(false); setValue(sub.teacher_comment ?? ""); }}
            className="flex-1 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="group cursor-pointer min-h-[2rem] flex items-start gap-2"
      title="Clique para editar comentário"
    >
      {value ? (
        <p className="text-xs text-slate-600 group-hover:text-brand-700 leading-relaxed">{value}</p>
      ) : (
        <span className="text-xs text-slate-300 group-hover:text-brand-400 italic">
          Clique para adicionar comentário...
        </span>
      )}
      <MessageSquare className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand-400 flex-shrink-0 mt-0.5" />
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function TarefaDetailPage() {
  const { id: turmaId, tarefaId } = useParams<{ id: string; tarefaId: string }>();
  const router = useRouter();
  const { user } = useUser();

  const isPaid = (user?.teacher_student_slots ?? 0) > 0;

  const [tarefa, setTarefa] = useState<TarefaWithSubmissoes | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newDueDate, setNewDueDate] = useState("");
  const [savingDate, setSavingDate] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<TarefaWithSubmissoes>(`/professor/tarefas/${tarefaId}`);
      setTarefa(res.data);
    } catch {
      router.push(`/dashboard/professor/turmas/${turmaId}`);
    } finally {
      setLoading(false);
    }
  }, [tarefaId, turmaId, router]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!confirm("Excluir esta tarefa? Todas as submissões serão removidas.")) return;
    setDeleting(true);
    try {
      await api.delete(`/professor/tarefas/${tarefaId}`);
      router.push(`/dashboard/professor/turmas/${turmaId}`);
    } catch {
      setDeleting(false);
    }
  };

  const handleClose = async () => {
    if (!confirm("Fechar esta tarefa? Os alunos não poderão mais entregar.")) return;
    setClosing(true);
    try {
      await api.post(`/professor/tarefas/${tarefaId}/fechar`);
      setTarefa((t) => t ? { ...t, is_closed: true } : t);
    } finally {
      setClosing(false);
    }
  };

  const handleReopen = async () => {
    setReopening(true);
    try {
      await api.post(`/professor/tarefas/${tarefaId}/reabrir`);
      setTarefa((t) => t ? { ...t, is_closed: false } : t);
    } finally {
      setReopening(false);
    }
  };

  const handleExtendDate = async () => {
    if (!newDueDate) return;
    setSavingDate(true);
    try {
      await api.patch(`/professor/tarefas/${tarefaId}`, { due_date: newDueDate });
      setTarefa((t) => t ? { ...t, due_date: newDueDate } : t);
      setShowDatePicker(false);
      setNewDueDate("");
    } finally {
      setSavingDate(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
      </div>
    );
  }

  if (!tarefa) return null;

  const isPastDue = tarefa.due_date && new Date(tarefa.due_date) < new Date();
  const submitted = tarefa.submissoes.filter((s) => s.submitted_at).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.push(`/dashboard/professor/turmas/${turmaId}`)}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 mt-1"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display font-bold text-2xl text-slate-900">{tarefa.title}</h2>
            {tarefa.is_ai_generated && (
              <span className="flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" /> IA
              </span>
            )}
            {tarefa.is_closed && (
              <span className="flex items-center gap-1 text-xs font-medium bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                <XCircle className="w-3 h-3" /> Encerrada
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
            <span className="uppercase font-semibold">{tarefa.essay_type}</span>
            <span>{submitted}/{tarefa.submissoes.length} entrega{tarefa.submissoes.length !== 1 ? "s" : ""}</span>
            {tarefa.due_date && (
              <span className={`flex items-center gap-1 ${isPastDue ? "text-red-500" : ""}`}>
                <CalendarClock className="w-3.5 h-3.5" />
                {new Date(tarefa.due_date).toLocaleString("pt-BR", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {tarefa.is_closed ? (
            <button
              onClick={handleReopen}
              disabled={reopening}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 text-xs font-semibold transition-colors disabled:opacity-40"
              title="Reabrir tarefa para novas entregas"
            >
              {reopening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Reabrir
            </button>
          ) : (
            <button
              onClick={handleClose}
              disabled={closing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold transition-colors disabled:opacity-40"
              title="Fechar tarefa para novas entregas"
            >
              {closing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              Fechar
            </button>
          )}
          <button
            onClick={() => setShowDatePicker((v) => !v)}
            className={`p-2 rounded-lg transition-colors ${showDatePicker ? "bg-brand-50 text-brand-600" : "text-slate-300 hover:text-brand-500 hover:bg-brand-50"}`}
            title="Alterar prazo"
          >
            <Calendar className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
            title="Excluir tarefa"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Alterar prazo */}
      {showDatePicker && (
        <div className="bg-white rounded-2xl border border-brand-100 shadow-card p-4">
          <p className="text-xs font-semibold text-slate-500 mb-3">
            {tarefa.due_date ? "Alterar prazo" : "Definir prazo"}
          </p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <input
                type="datetime-local"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-50 transition-colors"
              />
            </div>
            <button
              onClick={handleExtendDate}
              disabled={savingDate || !newDueDate}
              className="px-4 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center gap-2"
            >
              {savingDate ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </button>
            <button
              onClick={() => { setShowDatePicker(false); setNewDueDate(""); }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tema e textos motivadores */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Tema</p>
          <p className="text-sm text-slate-800 leading-relaxed">{tarefa.theme}</p>
        </div>
        {tarefa.instructions && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Instruções</p>
            <p className="text-sm text-slate-700 leading-relaxed">{tarefa.instructions}</p>
          </div>
        )}
        {tarefa.motivating_texts && tarefa.motivating_texts.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Textos Motivadores
            </p>
            <div className="space-y-3">
              {tarefa.motivating_texts.map((mt, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-slate-700 mb-1">{mt.title}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{mt.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Insights */}
      <InsightsPanel tarefaId={tarefaId} isPaid={isPaid} />

      {/* Submissões */}
      <div>
        <h3 className="font-display font-semibold text-slate-900 mb-3">
          Submissões dos Alunos
          <span className="text-slate-400 font-normal text-sm ml-2">({tarefa.submissoes.length})</span>
        </h3>

        {tarefa.submissoes.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-8 text-center">
            <p className="text-sm text-slate-400">Nenhum aluno entregou esta tarefa ainda.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Aluno</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Entregue em</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Nota</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Comentário</th>
                    <th className="px-5 py-3 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tarefa.submissoes.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-900">{sub.student_name}</p>
                      </td>
                      <td className="px-5 py-4 hidden sm:table-cell">
                        {sub.submitted_at ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            {new Date(sub.submitted_at).toLocaleDateString("pt-BR", {
                              day: "2-digit", month: "short",
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Clock className="w-3.5 h-3.5" />
                            Aguardando
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        {sub.total_score != null && sub.max_score != null ? (
                          <ScorePill score={sub.total_score} max={sub.max_score} />
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 max-w-xs">
                        <CommentCell tarefaId={tarefaId} sub={sub} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        {sub.essay_id && (
                          <Link
                            href={`/dashboard/professor/correcao/${sub.essay_id}`}
                            className="text-brand-700 hover:text-brand-800"
                            title="Ver correção"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
