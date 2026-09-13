"use client";

/** Acompanha uma correção solicitada pelo professor até seu estado terminal. */
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw, AlertCircle, Clock } from "lucide-react";
import { api, getApiError } from "@/lib/api/client";
import type { Essay } from "@/types/essay";
import { CorrectionView } from "@/components/dashboard/correction-view";

function ProcessingState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 text-center">
      <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Loader2 className="w-7 h-7 text-brand-500 animate-spin" />
      </div>
      <h3 className="font-display font-bold text-xl text-slate-900 mb-2">Corrigindo…</h3>
      <p className="text-slate-500 text-sm max-w-xs mx-auto">A IA está analisando cada competência.</p>
      <button onClick={onRefresh}
        className="mt-6 flex items-center gap-2 text-sm text-brand-700 font-medium hover:text-brand-800 mx-auto">
        <RefreshCw className="w-4 h-4" />Verificar status
      </button>
    </div>
  );
}

function ErrorState({ message }: { message?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-red-100 shadow-card p-10 text-center">
      <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-7 h-7 text-red-400" />
      </div>
      <h3 className="font-display font-bold text-xl text-slate-900 mb-2">Erro na correção</h3>
      <p className="text-slate-500 text-sm max-w-xs mx-auto">
        {message ?? "Não foi possível corrigir. Tente enviar novamente."}
      </p>
    </div>
  );
}

export default function ProfessorCorrectionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [essay, setEssay] = useState<Essay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  const loadEssay = useCallback(async () => {
    try {
      const res = await api.get<Essay>(`/professor/redacoes/${id}`);
      setEssay(res.data);
    } catch (err: unknown) {
      const { detail: msg, status } = getApiError(err);
      setError(status === 404 ? "Redação não encontrada." : typeof msg === "string" ? msg : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadEssay(); }, [loadEssay]);

  useEffect(() => {
    // Polling limitado a um minuto (15 × 4 s) para não manter requisições
    // indefinidas quando o worker estiver indisponível.
    if (!essay || (essay.status !== "processing" && essay.status !== "pending") || pollCount >= 15) return;
    const timer = setTimeout(() => { setPollCount((c) => c + 1); loadEssay(); }, 4000);
    return () => clearTimeout(timer);
  }, [essay, pollCount, loadEssay]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 text-brand-400 animate-spin" /></div>;
  if (error) return <div className="max-w-2xl mx-auto"><ErrorState message={error} /></div>;
  if (!essay) return null;

  const title = essay.title ?? `Redação de ${new Date(essay.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="font-display font-bold text-xl text-slate-900 line-clamp-1">{title}</h2>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
            <Clock className="w-3 h-3" />
            <span>{new Date(essay.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            <span>·</span>
            <span>{essay.essay_type === "enem" ? "ENEM" : "Vestibular"}</span>
          </div>
        </div>
      </div>

      {(essay.status === "processing" || essay.status === "pending") && <ProcessingState onRefresh={loadEssay} />}
      {essay.status === "error" && <ErrorState />}
      {essay.status === "completed" && essay.correction && (
        <CorrectionView essay={essay} correction={essay.correction} />
      )}
    </div>
  );
}
