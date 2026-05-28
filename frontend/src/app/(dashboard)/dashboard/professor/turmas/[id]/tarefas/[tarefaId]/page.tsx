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
} from "lucide-react";
import { api } from "@/lib/api/client";
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

  const [tarefa, setTarefa] = useState<TarefaWithSubmissoes | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

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
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-2 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
          title="Excluir tarefa"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>

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
