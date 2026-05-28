"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  ClipboardList,
  CheckCircle2,
  Clock,
  CalendarClock,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api/client";
import type { TarefaStudentView } from "@/types/turma";

function statusBadge(tarefa: TarefaStudentView) {
  if (tarefa.my_submission?.submitted_at) {
    const score = tarefa.my_submission.total_score;
    const max = tarefa.my_submission.max_score;
    if (score != null && max != null) {
      const pct = (score / max) * 100;
      const cls =
        pct >= 70
          ? "bg-green-50 text-green-700"
          : pct >= 50
          ? "bg-amber-50 text-amber-700"
          : "bg-red-50 text-red-700";
      const label = max === 1000 ? `${Math.round(score)} pts` : `${pct.toFixed(0)}%`;
      return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>;
    }
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
        <CheckCircle2 className="w-3 h-3" /> Entregue
      </span>
    );
  }

  if (tarefa.is_past_due) {
    return (
      <span className="text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
        Atrasada
      </span>
    );
  }

  return (
    <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full flex items-center gap-1">
      <Clock className="w-3 h-3" /> Pendente
    </span>
  );
}

export default function AlunoTurmaDetailPage() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const router = useRouter();

  const [tarefas, setTarefas] = useState<TarefaStudentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<TarefaStudentView[]>(
        `/professor/minhas-turmas/${turmaId}/tarefas`
      );
      setTarefas(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [turmaId]);

  useEffect(() => { load(); }, [load]);

  const pending = tarefas.filter((t) => !t.my_submission?.submitted_at && !t.is_past_due);
  const submitted = tarefas.filter((t) => t.my_submission?.submitted_at);
  const pastDue = tarefas.filter((t) => !t.my_submission?.submitted_at && t.is_past_due);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard/aluno/turmas")}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-900">Tarefas da Turma</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {pending.length > 0
              ? `${pending.length} tarefa${pending.length !== 1 ? "s" : ""} pendente${pending.length !== 1 ? "s" : ""}`
              : "Todas as tarefas em dia"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">Não foi possível carregar as tarefas.</p>
        </div>
      ) : tarefas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-12 text-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ClipboardList className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-slate-500 text-sm">Nenhuma tarefa publicada ainda.</p>
          <p className="text-xs text-slate-400 mt-1.5">
            O professor ainda não criou tarefas nesta turma.
          </p>
        </div>
      ) : (
        <>
          {/* Pendentes */}
          {pending.length > 0 && (
            <TarefaSection
              title="Pendentes"
              tarefas={pending}
              turmaId={turmaId}
              accentClass="text-amber-600"
            />
          )}

          {/* Atrasadas */}
          {pastDue.length > 0 && (
            <TarefaSection
              title="Atrasadas"
              tarefas={pastDue}
              turmaId={turmaId}
              accentClass="text-red-500"
            />
          )}

          {/* Entregues */}
          {submitted.length > 0 && (
            <TarefaSection
              title="Entregues"
              tarefas={submitted}
              turmaId={turmaId}
              accentClass="text-green-600"
            />
          )}
        </>
      )}
    </div>
  );
}

function TarefaSection({
  title,
  tarefas,
  turmaId,
  accentClass,
}: {
  title: string;
  tarefas: TarefaStudentView[];
  turmaId: string;
  accentClass: string;
}) {
  return (
    <div>
      <h3 className={`font-display font-semibold text-sm uppercase tracking-wide mb-3 ${accentClass}`}>
        {title} ({tarefas.length})
      </h3>
      <div className="space-y-2">
        {tarefas.map((t) => (
          <Link
            key={t.id}
            href={`/dashboard/aluno/turmas/${turmaId}/tarefas/${t.id}`}
            className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-3 hover:shadow-card-hover transition-shadow"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-slate-900 truncate">{t.title}</p>
                {t.is_ai_generated && (
                  <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-slate-400 uppercase font-medium">{t.essay_type}</span>
                {t.due_date && !t.my_submission?.submitted_at && (
                  <span className={`flex items-center gap-0.5 text-xs ${t.is_past_due ? "text-red-500" : "text-slate-400"}`}>
                    <CalendarClock className="w-3 h-3" />
                    {new Date(t.due_date).toLocaleDateString("pt-BR", {
                      day: "2-digit", month: "short",
                    })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {statusBadge(t)}
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
