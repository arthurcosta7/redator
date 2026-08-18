"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Send,
  ExternalLink,
  Sparkles,
  Lock,
} from "lucide-react";
import { api, getApiError } from "@/lib/api/client";
import type { TarefaStudentView } from "@/types/turma";

function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

const LIMITS = {
  enem:       { min: 100, max: 350 },
  vestibular: { min: 150, max: 500 },
};

export default function AlunoTarefaPage() {
  const { turmaId, tarefaId } = useParams<{ turmaId: string; tarefaId: string }>();
  const router = useRouter();

  const [tarefa, setTarefa] = useState<TarefaStudentView | null>(null);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ essayId: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<TarefaStudentView>(`/professor/tarefas/${tarefaId}/aluno`);
      setTarefa(res.data);
    } catch {
      router.push(`/dashboard/aluno/turmas/${turmaId}`);
    } finally {
      setLoading(false);
    }
  }, [tarefaId, turmaId, router]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tarefa) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ id: string }>("/essays", {
        theme: tarefa.theme,
        title: title.trim() || undefined,
        content: content.trim(),
        essay_type: tarefa.essay_type,
        assignment_id: tarefaId,
      });
      setSuccess({ essayId: res.data.id });
    } catch (err: unknown) {
      const msg = getApiError(err).detail;
      setError(typeof msg === "string" ? msg : "Erro ao enviar. Tente novamente.");
    } finally {
      setSubmitting(false);
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

  const isVestibular = tarefa.essay_type === "vestibular";
  const limits = LIMITS[tarefa.essay_type as "enem" | "vestibular"];
  const wc = wordCount(content);
  const wordOk = wc >= limits.min && wc <= limits.max;
  const isPastDue = tarefa.is_past_due;
  const alreadySubmitted = !!tarefa.my_submission?.submitted_at;

  // ─── Closed state ─────────────────────────────────────────────────────────

  if (tarefa.is_closed && !alreadySubmitted) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/dashboard/aluno/turmas/${turmaId}`)}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="font-display font-bold text-xl text-slate-900">{tarefa.title}</h2>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-slate-400" />
          </div>
          <p className="font-semibold text-slate-700">Tarefa encerrada</p>
          <p className="text-sm text-slate-400">
            Esta tarefa foi encerrada pelo professor e não aceita mais entregas.
          </p>
          <button
            onClick={() => router.push(`/dashboard/aluno/turmas/${turmaId}`)}
            className="mt-2 inline-block px-5 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-white transition-colors"
          >
            Voltar para a turma
          </button>
        </div>
      </div>
    );
  }

  // ─── Success state ────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 text-center space-y-4">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <div>
            <h3 className="font-display font-bold text-xl text-slate-900">Redação enviada!</h3>
            <p className="text-sm text-slate-500 mt-1">
              Sua redação foi entregue e a correção está sendo processada.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Link
              href={`/dashboard/aluno/correcao/${success.essayId}`}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Ver Correção
            </Link>
            <Link
              href={`/dashboard/aluno/turmas/${turmaId}`}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Voltar para a turma
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Already submitted ─────────────────────────────────────────────────────

  if (alreadySubmitted) {
    const sub = tarefa.my_submission!;
    const scoreLabel =
      sub.total_score != null && sub.max_score != null
        ? tarefa.essay_type === "enem"
          ? `${Math.round(sub.total_score)} / ${sub.max_score} pts`
          : `${((sub.total_score / sub.max_score) * 100).toFixed(0)}%`
        : null;

    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/dashboard/aluno/turmas/${turmaId}`)}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="font-display font-bold text-xl text-slate-900">{tarefa.title}</h2>
        </div>

        <div className="bg-green-50 border border-green-100 rounded-2xl p-6 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
          <p className="font-semibold text-slate-800">Tarefa já entregue</p>
          {sub.submitted_at && (
            <p className="text-xs text-slate-400">
              Enviada em {new Date(sub.submitted_at).toLocaleString("pt-BR")}
            </p>
          )}
          {scoreLabel && (
            <p className="text-lg font-bold text-brand-700">{scoreLabel}</p>
          )}
          {sub.teacher_comment && (
            <div className="bg-white rounded-xl p-4 text-left mt-3">
              <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Comentário do professor</p>
              <p className="text-sm text-slate-700">{sub.teacher_comment}</p>
            </div>
          )}
          {sub.essay_id && (
            <Link
              href={`/dashboard/aluno/correcao/${sub.essay_id}`}
              className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Ver Correção Completa
            </Link>
          )}
        </div>
      </div>
    );
  }

  // ─── Submission form ───────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/dashboard/aluno/turmas/${turmaId}`)}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display font-bold text-xl text-slate-900">{tarefa.title}</h2>
            {tarefa.is_ai_generated && (
              <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
            <span className="uppercase font-semibold">{tarefa.essay_type}</span>
            {tarefa.due_date && (
              <span className={`flex items-center gap-1 ${isPastDue ? "text-red-500" : ""}`}>
                <CalendarClock className="w-3.5 h-3.5" />
                {new Date(tarefa.due_date).toLocaleString("pt-BR", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}
                {isPastDue && " (prazo encerrado)"}
              </span>
            )}
          </div>
        </div>
      </div>

      {isPastDue && (
        <div className="flex gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">
            O prazo de entrega encerrou. Você ainda pode enviar, mas ficará marcada como atrasada.
          </p>
        </div>
      )}

      {/* Tema e instruções */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Tema</p>
          <p className="text-sm text-slate-800 leading-relaxed font-medium">{tarefa.theme}</p>
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
                <details key={i} className="bg-slate-50 rounded-xl">
                  <summary className="px-4 py-3 text-xs font-semibold text-slate-700 cursor-pointer list-none flex items-center justify-between">
                    {mt.title}
                    <span className="text-slate-400 text-[10px]">clique para ler</span>
                  </summary>
                  <p className="px-4 pb-3 text-xs text-slate-600 leading-relaxed">{mt.content}</p>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Título — só vestibular pode editar */}
        {isVestibular && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Título da Redação <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Dê um título para sua redação..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-50 transition-colors"
            />
          </div>
        )}

        {/* Conteúdo */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700">
              Texto da Redação <span className="text-red-400">*</span>
            </label>
            <span className={`text-xs font-medium ${
              wc === 0 ? "text-slate-300"
              : wordOk ? "text-green-600"
              : wc < limits.min ? "text-amber-500"
              : "text-red-500"
            }`}>
              {wc} / {limits.max} palavras
            </span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={10000}
            rows={16}
            placeholder={`Escreva sua redação aqui... (mínimo ${limits.min} palavras)`}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-50 transition-colors resize-none leading-relaxed"
            required
          />
          {wc > 0 && !wordOk && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {wc < limits.min
                ? `Mínimo ${limits.min} palavras (faltam ${limits.min - wc})`
                : `Máximo ${limits.max} palavras (excedeu em ${wc - limits.max})`}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting || !content.trim() || !wordOk}
          className="w-full py-3.5 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
            : <><Send className="w-4 h-4" /> Enviar Tarefa</>}
        </button>
        <p className="text-xs text-slate-400 text-center">
          A correção por IA será iniciada automaticamente. Esta entrega não desconta seu limite diário.
        </p>
      </form>
    </div>
  );
}
