"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Dumbbell, Clock, ChevronRight, RefreshCw, Lock, FileText } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api/client";

interface Simulado {
  id: string;
  essay_type: string;
  theme: string;
  prompt: string;
  motivating_texts: string[];
  time_suggested_minutes: number;
}

const TYPE_CONFIG = {
  enem: {
    label: "ENEM",
    description: "Dissertativo-argumentativo + proposta de intervenção",
    color: "bg-blue-50 border-blue-200 text-blue-700",
    activeColor: "bg-blue-700 text-white border-blue-700",
  },
  vestibular: {
    label: "Vestibular",
    description: "FUVEST / UNICAMP / UNESP",
    color: "bg-purple-50 border-purple-200 text-purple-700",
    activeColor: "bg-purple-700 text-white border-purple-700",
  },
};

function PlanGate() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Lock className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="font-display font-bold text-lg text-slate-900 mb-2">
        Recurso exclusivo
      </h3>
      <p className="text-slate-500 text-sm max-w-xs">
        Simulados estão disponíveis nos planos Standard e Pro.
      </p>
      <a
        href="/dashboard/aluno/plano"
        className="mt-6 bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
      >
        Ver planos
      </a>
    </div>
  );
}

export default function SimuladosPage() {
  const { user } = useUser();
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<"enem" | "vestibular">("enem");
  const [simulado, setSimulado] = useState<Simulado | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPaid = user?.plan === "standard" || user?.plan === "pro";

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Simulado>(`/simulados/new?type=${selectedType}`);
      setSimulado(res.data);
    } catch {
      setError("Não foi possível gerar o simulado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handlePractice = () => {
    if (!simulado) return;
    const params = new URLSearchParams({ tema: simulado.theme, tipo: simulado.essay_type });
    router.push(`/dashboard/aluno/nova-redacao?${params.toString()}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl text-slate-900">Simulados</h2>
        <p className="text-slate-500 text-sm mt-1">
          Pratique com propostas geradas especialmente para você
        </p>
      </div>

      {!isPaid && <PlanGate />}

      {isPaid && (
        <>
          {/* Seleção de tipo */}
          <div className="grid grid-cols-2 gap-3">
            {(["enem", "vestibular"] as const).map((type) => {
              const cfg = TYPE_CONFIG[type];
              const isActive = selectedType === type;
              return (
                <button
                  key={type}
                  onClick={() => { setSelectedType(type); setSimulado(null); }}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    isActive ? cfg.activeColor : `${cfg.color} hover:opacity-80`
                  }`}
                >
                  <p className="font-semibold text-sm">{cfg.label}</p>
                  <p className={`text-xs mt-0.5 ${isActive ? "opacity-80" : "opacity-70"}`}>
                    {cfg.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Botão gerar */}
          <button
            onClick={generate}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-brand-700 hover:bg-brand-800 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Gerando simulado...
              </>
            ) : (
              <>
                <Dumbbell className="w-4 h-4" />
                {simulado ? "Gerar novo simulado" : "Gerar simulado"}
              </>
            )}
          </button>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          {/* Card do simulado */}
          {simulado && !loading && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-brand-600" />
                  <span className="text-xs font-semibold text-brand-700 uppercase tracking-wide">
                    {simulado.essay_type.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  {simulado.time_suggested_minutes} min sugeridos
                </div>
              </div>

              {/* Tema */}
              <div className="px-6 py-5 border-b border-slate-100">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Tema</p>
                <h3 className="font-display font-bold text-lg text-slate-900 leading-snug">
                  {simulado.theme}
                </h3>
              </div>

              {/* Textos motivadores */}
              {simulado.motivating_texts.length > 0 && (
                <div className="px-6 py-5 border-b border-slate-100 space-y-3">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                    Textos motivadores
                  </p>
                  {simulado.motivating_texts.map((text, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs text-slate-400 font-medium mb-1">Texto {i + 1}</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Proposta */}
              <div className="px-6 py-5 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-brand-600" />
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Proposta</p>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{simulado.prompt}</p>
              </div>

              {/* CTA */}
              <div className="px-6 py-4">
                <button
                  onClick={handlePractice}
                  className="w-full py-3 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  Escrever esta redação
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
