"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  AlertCircle,
  Clock,
} from "lucide-react";
import { api, getApiError } from "@/lib/api/client";
import type { Essay } from "@/types/essay";
import { CorrectionView } from "@/components/dashboard/correction-view";
import { AppealPanel } from "@/components/dashboard/appeal-panel";

// ─── Estado de processamento ─────────────────────────────────────────────────

function ProcessingState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 text-center">
      <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Loader2 className="w-7 h-7 text-brand-500 animate-spin" />
      </div>
      <h3 className="font-display font-bold text-xl text-slate-900 mb-2">
        Corrigindo sua redação…
      </h3>
      <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">
        Nossa IA está analisando cada competência com cuidado. Isso leva
        alguns segundos.
      </p>
      <button
        onClick={onRefresh}
        className="mt-6 flex items-center gap-2 text-sm text-brand-700 font-medium hover:text-brand-800 mx-auto"
      >
        <RefreshCw className="w-4 h-4" />
        Verificar status
      </button>
    </div>
  );
}

// ─── Estado de erro da correção ───────────────────────────────────────────────

function ErrorState({ message }: { message?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-red-100 shadow-card p-10 text-center">
      <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-7 h-7 text-red-400" />
      </div>
      <h3 className="font-display font-bold text-xl text-slate-900 mb-2">
        Erro na correção
      </h3>
      <p className="text-slate-500 text-sm max-w-xs mx-auto">
        {message ?? "Não foi possível corrigir esta redação. Tente enviar novamente."}
      </p>
      <Link
        href="/dashboard/aluno/nova-redacao"
        className="mt-6 inline-block bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-800 transition-colors"
      >
        Enviar nova redação
      </Link>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CorrectionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [essay, setEssay] = useState<Essay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Polling automático enquanto o status for "processing"
  const [pollCount, setPollCount] = useState(0);

  const loadEssay = useCallback(async () => {
    try {
      const res = await api.get<Essay>(`/essays/${id}`);
      setEssay(res.data);
    } catch (err: unknown) {
      const { detail: msg, status } = getApiError(err);
      if (status === 404) {
        setError("Redação não encontrada.");
      } else {
        setError(typeof msg === "string" ? msg : "Erro ao carregar a correção.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadEssay();
  }, [loadEssay]);

  // Polling: se status é "processing" ou "pending", verifica a cada 4s (até 15 vezes)
  useEffect(() => {
    if (!essay) return;
    if (essay.status !== "processing" && essay.status !== "pending") return;
    if (pollCount >= 15) return;

    const timer = setTimeout(() => {
      setPollCount((c) => c + 1);
      loadEssay();
    }, 4000);

    return () => clearTimeout(timer);
  }, [essay, pollCount, loadEssay]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <ErrorState message={error} />
      </div>
    );
  }

  if (!essay) return null;

  const title =
    essay.title ??
    `Redação de ${new Date(essay.created_at).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })}`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="font-display font-bold text-xl text-slate-900 line-clamp-1">
            {title}
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
            <Clock className="w-3 h-3" />
            <span>
              {new Date(essay.created_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span>·</span>
            <span>{essay.essay_type === "enem" ? "ENEM" : "Vestibular"}</span>
          </div>
        </div>
      </div>

      {/* Conteúdo baseado no status */}
      {(essay.status === "processing" || essay.status === "pending") && (
        <ProcessingState onRefresh={loadEssay} />
      )}

      {essay.status === "error" && <ErrorState />}

      {essay.status === "completed" && essay.correction && (
        <>
          <CorrectionView essay={essay} correction={essay.correction} />
          <AppealPanel correction={essay.correction} />
        </>
      )}

      {essay.status === "completed" && !essay.correction && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 text-center">
          <p className="text-amber-700 text-sm">
            Correção concluída, mas os dados ainda estão carregando.
          </p>
          <button
            onClick={loadEssay}
            className="mt-3 flex items-center gap-2 text-sm text-amber-700 font-medium hover:text-amber-800 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Recarregar
          </button>
        </div>
      )}
    </div>
  );
}
