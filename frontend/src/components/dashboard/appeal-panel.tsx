"use client";

/** Fluxo do aluno para abrir e acompanhar a única contestação da correção. */
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Loader2, Scale } from "lucide-react";
import { api, getApiError } from "@/lib/api/client";
import type { Correction } from "@/types/essay";
import type { AppealListResponse, CorrectionAppeal } from "@/types/appeal";

const statusCopy = {
  pending: { label: "Aguardando professor", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  in_review: { label: "Em análise", tone: "bg-blue-50 text-blue-800 border-blue-200" },
  upheld: { label: "Correção mantida", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  corrected: { label: "Nota corrigida", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
};

export function AppealPanel({ correction }: { correction: Correction }) {
  const [appeal, setAppeal] = useState<CorrectionAppeal | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Impede que uma resposta tardia atualize o estado após troca de página ou
    // de correção. O request pode terminar, mas seu resultado é descartado.
    let active = true;
    api.get<AppealListResponse>("/appeals/mine")
      .then(({ data }) => {
        if (active) setAppeal(data.items.find((item) => item.correction_id === correction.id) ?? null);
      })
      .catch(() => {
        if (active) setError("Não foi possível consultar o estado da contestação.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [correction.id]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data } = await api.post<CorrectionAppeal>("/appeals", {
        correction_id: correction.id,
        reason,
        // O consentimento é explícito e independente do envio da contestação.
        allow_anonymized_improvement: consent,
      });
      setAppeal(data);
      setIsOpening(false);
    } catch (err) {
      const detail = getApiError(err).detail;
      setError(typeof detail === "string" ? detail : "Não foi possível enviar a contestação.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="h-20 rounded-xl bg-paper-deep animate-pulse" aria-label="Carregando contestação" />;
  }

  if (appeal) {
    const status = statusCopy[appeal.status];
    return (
      <section className="border border-ink-line bg-paper rounded-xl p-5 sm:p-6 space-y-4" aria-labelledby="appeal-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="appeal-title" className="font-display text-lg font-semibold text-ink">Revisão humana</h3>
            <p className="mt-1 text-sm text-ink-muted">Sua solicitação fica registrada com o resultado original.</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${status.tone}`}>
            {appeal.status === "corrected" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
            {status.label}
          </span>
        </div>

        {appeal.status === "corrected" && (
          <div className="flex items-end gap-4 border-y border-ink-line py-4">
            <div><p className="text-xs text-ink-muted">Nota original</p><p className="text-xl text-ink-soft line-through">{appeal.original_total_score}</p></div>
            <div><p className="text-xs text-ink-muted">Nota após revisão</p><p className="font-display text-3xl font-semibold text-emerald-700">{appeal.corrected_total_score}</p></div>
            <span className="pb-1 text-xs text-ink-muted">de {appeal.max_score}</span>
          </div>
        )}

        {appeal.reviewer_explanation && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Parecer do professor</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-soft">{appeal.reviewer_explanation}</p>
            {appeal.reviewer_name && <p className="mt-2 text-xs text-ink-muted">Revisado por {appeal.reviewer_name}</p>}
          </div>
        )}
      </section>
    );
  }

  if (!isOpening) {
    return (
      <section className="border-t border-ink-line pt-5">
        {error && (
          <div role="alert" className="mb-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-ink">Discorda da nota?</h3>
            <p className="mt-1 max-w-xl text-sm text-ink-muted">Peça a análise de um professor licenciado. A redação só pode ser contestada uma vez.</p>
          </div>
          <button onClick={() => setIsOpening(true)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-ink px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-ink hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <Scale className="h-4 w-4" /> Contestar correção
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="border border-ink-line bg-paper rounded-xl p-5 sm:p-6" aria-labelledby="new-appeal-title">
      <h3 id="new-appeal-title" className="font-display text-xl font-semibold text-ink">Solicitar nova análise</h3>
      <p className="mt-1 text-sm text-ink-muted">Aponte objetivamente quais critérios ou trechos parecem ter sido avaliados de forma incorreta.</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="appeal-reason" className="text-sm font-semibold text-ink-soft">Motivo da contestação</label>
          <textarea id="appeal-reason" required minLength={30} maxLength={3000} rows={6} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 w-full resize-y rounded-lg border border-ink-line bg-white px-3 py-3 text-sm leading-6 text-ink outline-none transition focus:border-accent-deep focus:ring-2 focus:ring-accent/20" placeholder="Ex.: Na competência 3, a correção não considerou o argumento desenvolvido no segundo parágrafo..." />
          <p className="mt-1 text-right text-xs text-ink-muted">{reason.length}/3000</p>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-paper-deep p-3 text-sm text-ink-soft">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-ink" />
          <span>Autorizo que este caso, se a correção estiver errada, seja usado de forma desidentificada para avaliar e melhorar o sistema. Identificadores de conta e contatos detectáveis serão removidos, mas textos livres não permitem anonimização perfeita. <strong>Isso é opcional.</strong></span>
        </label>
        {error && <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}</div>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => { setIsOpening(false); setError(null); }} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-ink-muted hover:bg-paper-deep">Cancelar</button>
          <button type="submit" disabled={submitting || reason.trim().length < 30} className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Enviar contestação
          </button>
        </div>
      </form>
    </section>
  );
}
