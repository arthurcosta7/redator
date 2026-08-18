"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { api, getApiError } from "@/lib/api/client";
import type { AppealListResponse, CorrectionAppeal, ReviewerAppealDetail } from "@/types/appeal";

type Decision = "upheld" | "corrected";

function QueueItem({ item, active, onSelect }: { item: CorrectionAppeal; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full border-b border-slate-100 px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${active ? "bg-brand-50" : "hover:bg-slate-50"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-2 text-sm font-semibold text-slate-800">{item.essay_title}</p>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${item.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
          {item.status === "pending" ? "Nova" : "Em análise"}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
        <span>{item.essay_type.toUpperCase()}</span><span>·</span><span>Nota {item.original_total_score}/{item.max_score}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.student_reason}</p>
    </button>
  );
}

export default function AppealsReviewPage() {
  const [queue, setQueue] = useState<CorrectionAppeal[]>([]);
  const [selected, setSelected] = useState<ReviewerAppealDetail | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [decision, setDecision] = useState<Decision>("upheld");
  const [explanation, setExplanation] = useState("");
  const [scores, setScores] = useState<Record<number, number>>({});
  const [manualTotal, setManualTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    setError(null);
    try {
      const { data } = await api.get<AppealListResponse>("/appeals/review-queue");
      setQueue(data.items);
    } catch (err) {
      const detail = getApiError(err).detail;
      setError(typeof detail === "string" ? detail : "Não foi possível carregar a fila.");
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const openAppeal = async (item: CorrectionAppeal) => {
    setLoadingDetail(true);
    setError(null);
    setSuccess(null);
    try {
      const endpoint = item.status === "pending" ? `/appeals/${item.id}/claim` : `/appeals/${item.id}`;
      const request = item.status === "pending" ? api.post<ReviewerAppealDetail>(endpoint) : api.get<ReviewerAppealDetail>(endpoint);
      const { data } = await request;
      setSelected(data);
      setDecision("upheld");
      setExplanation("");
      setScores(Object.fromEntries(data.original_competencies.map((competency) => [competency.number, competency.score])));
      setManualTotal(data.original_total_score);
      setQueue((current) => current.map((queued) => queued.id === data.id ? { ...queued, status: "in_review" } : queued));
    } catch (err) {
      const detail = getApiError(err).detail;
      setError(typeof detail === "string" ? detail : "Não foi possível abrir a contestação.");
      await loadQueue();
    } finally {
      setLoadingDetail(false);
    }
  };

  const correctedTotal = useMemo(
    () => selected?.original_competencies.length
      ? Object.values(scores).reduce((total, score) => total + (Number(score) || 0), 0)
      : manualTotal,
    [scores, selected, manualTotal]
  );

  const resolve = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/appeals/${selected.id}/resolve`, {
        decision,
        explanation,
        corrected_total_score: decision === "corrected" ? correctedTotal : null,
        competency_scores: decision === "corrected"
          ? Object.entries(scores).map(([number, score]) => ({ number: Number(number), score: Number(score) }))
          : null,
      });
      setSuccess(decision === "corrected" ? "Nota atualizada e decisão registrada." : "Correção confirmada e parecer registrado.");
      setSelected(null);
      await loadQueue();
    } catch (err) {
      const detail = getApiError(err).detail;
      setError(typeof detail === "string" ? detail : "Não foi possível registrar a decisão.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Contestações de correção</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Analise o texto, a justificativa do aluno e os critérios originais antes de emitir um parecer pedagógico.</p>
        </div>
        <button onClick={loadQueue} disabled={loadingQueue} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loadingQueue ? "animate-spin" : ""}`} /> Atualizar fila
        </button>
      </header>

      <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <p><strong>Decisão auditável:</strong> a nota original é preservada. Casos corrigidos só entram no conjunto de melhoria quando o aluno autorizou o uso desidentificado.</p>
      </div>

      {error && <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
      {success && <div role="status" className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"><CheckCircle2 className="h-5 w-5 shrink-0" />{success}</div>}

      <div className="grid min-h-[640px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r" aria-label="Fila de contestações">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2"><Scale className="h-4 w-4 text-brand-600" /><h2 className="text-sm font-semibold text-slate-800">Fila de revisão</h2></div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{queue.length}</span>
          </div>
          <div className="max-h-80 overflow-y-auto lg:max-h-[590px]">
            {loadingQueue ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
            ) : queue.length === 0 ? (
              <div className="px-6 py-16 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" /><p className="mt-3 text-sm font-semibold text-slate-700">Fila em dia</p><p className="mt-1 text-xs leading-5 text-slate-400">Nenhuma contestação aguarda sua análise.</p></div>
            ) : queue.map((item) => <QueueItem key={item.id} item={item} active={selected?.id === item.id} onSelect={() => openAppeal(item)} />)}
          </div>
        </aside>

        <main className="min-w-0">
          {loadingDetail ? (
            <div className="flex h-full min-h-96 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-brand-500" /></div>
          ) : !selected ? (
            <div className="flex h-full min-h-96 flex-col items-center justify-center px-8 text-center"><FileText className="h-10 w-10 text-slate-200" /><h2 className="mt-4 font-display text-lg font-semibold text-slate-700">Selecione uma contestação</h2><p className="mt-1 max-w-sm text-sm leading-6 text-slate-400">Ao abrir um caso, ele fica reservado para sua análise e não pode ser decidido por outro revisor.</p></div>
          ) : (
            <div className="divide-y divide-slate-100">
              <section className="p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl font-bold text-slate-900">{selected.essay_title}</h2><p className="mt-1 text-xs text-slate-400">{selected.essay_type.toUpperCase()} · corrigida por {selected.original_ai_model ?? "modelo não registrado"}</p></div><div className="text-right"><p className="text-xs text-slate-400">Nota contestada</p><p className="font-display text-2xl font-bold text-slate-900">{selected.original_total_score}<span className="text-sm font-normal text-slate-400">/{selected.max_score}</span></p></div></div>
                <div className="mt-5 rounded-lg bg-amber-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Justificativa do aluno</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-950">{selected.student_reason}</p></div>
              </section>

              <section className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_320px]">
                <article><h3 className="text-sm font-semibold text-slate-800">Redação enviada</h3>{selected.essay_theme && <p className="mt-2 text-xs leading-5 text-slate-500"><strong>Tema:</strong> {selected.essay_theme}</p>}<div className="mt-4 max-h-[460px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">{selected.essay_content}</div></article>
                <aside><h3 className="text-sm font-semibold text-slate-800">Avaliação original</h3><div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">{selected.original_competencies.map((competency) => <div key={competency.number} className="p-3"><div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold leading-5 text-slate-700">C{competency.number} · {competency.name}</p><span className="text-xs font-bold text-slate-900">{competency.score}/{competency.max_score}</span></div>{competency.feedback && <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">{competency.feedback}</p>}</div>)}</div></aside>
              </section>

              <form onSubmit={resolve} className="space-y-5 bg-slate-50 p-5 sm:p-7">
                <fieldset><legend className="text-sm font-semibold text-slate-800">Sua decisão</legend><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className={`cursor-pointer rounded-xl border p-4 ${decision === "upheld" ? "border-slate-700 bg-white ring-1 ring-slate-700" : "border-slate-200 bg-white"}`}><input type="radio" name="decision" value="upheld" checked={decision === "upheld"} onChange={() => setDecision("upheld")} className="sr-only" /><span className="flex items-center gap-2 text-sm font-semibold text-slate-800"><CheckCircle2 className="h-4 w-4" /> A correção está correta</span><span className="mt-1 block text-xs leading-5 text-slate-500">Mantém a nota e explica ao aluno os critérios aplicados.</span></label><label className={`cursor-pointer rounded-xl border p-4 ${decision === "corrected" ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600" : "border-slate-200 bg-white text-slate-800"}`}><input type="radio" name="decision" value="corrected" checked={decision === "corrected"} onChange={() => setDecision("corrected")} className="sr-only" /><span className="flex items-center gap-2 text-sm font-semibold"><Scale className="h-4 w-4" /> A nota precisa ser corrigida</span><span className={`mt-1 block text-xs leading-5 ${decision === "corrected" ? "text-emerald-800" : "text-slate-500"}`}>Registra novas notas por competência e atualiza o resultado.</span></label></div></fieldset>

                {decision === "corrected" && selected.original_competencies.length > 0 && <fieldset><legend className="text-sm font-semibold text-slate-800">Notas corretas por competência</legend><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{selected.original_competencies.map((competency) => <label key={competency.number} className="rounded-lg border border-slate-200 bg-white p-3"><span className="block truncate text-xs font-semibold text-slate-600">C{competency.number} · {competency.name}</span><div className="mt-2 flex items-center gap-2"><input type="number" required min={0} max={competency.max_score} step="1" value={scores[competency.number] ?? 0} onChange={(event) => setScores((current) => ({ ...current, [competency.number]: Number(event.target.value) }))} className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /><span className="text-xs text-slate-400">/{competency.max_score}</span></div></label>)}</div><div className="mt-3 flex items-center justify-end gap-2 text-sm text-slate-500">Nova nota: <strong className="font-display text-2xl text-emerald-700">{correctedTotal}</strong><span>/{selected.max_score}</span></div></fieldset>}
                {decision === "corrected" && selected.original_competencies.length === 0 && <label className="block max-w-xs text-sm font-semibold text-slate-800">Nota correta<div className="mt-2 flex items-center gap-2"><input type="number" required min={0} max={selected.max_score} step="0.1" value={manualTotal} onChange={(event) => setManualTotal(Number(event.target.value))} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /><span className="text-xs font-normal text-slate-400">/{selected.max_score}</span></div></label>}

                <div><label htmlFor="review-explanation" className="text-sm font-semibold text-slate-800">Parecer pedagógico</label><p className="mt-1 text-xs text-slate-500">Explique a decisão com referências concretas ao texto e aos critérios. O aluno verá este conteúdo; não inclua telefone, email ou outros dados pessoais.</p><textarea id="review-explanation" required minLength={50} maxLength={5000} rows={6} value={explanation} onChange={(event) => setExplanation(event.target.value)} className="mt-2 w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="Fundamente por que a nota original deve ser mantida ou alterada..." /><p className="mt-1 text-right text-xs text-slate-400">{explanation.length}/5000</p></div>
                <div className="flex justify-end"><button type="submit" disabled={submitting || explanation.trim().length < 50} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Registrar decisão</button></div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
