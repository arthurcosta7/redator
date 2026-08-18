"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FilePlus2, ScrollText, TrendingUp, AlertCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useUser } from "@/contexts/UserContext";
import type { EssayListItem, DailyLimitResponse } from "@/types/essay";
import { PLAN_LABELS } from "@/types/user";

// ─── Componentes pequenos ─────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "brand",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: "brand" | "green" | "amber";
}) {
  const colors = {
    brand: "bg-brand-50 text-brand-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-card flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold font-display text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function EssayStatusBadge({ status }: { status: EssayListItem["status"] }) {
  const map = {
    pending: { label: "Pendente", cls: "bg-slate-100 text-slate-600" },
    processing: { label: "Corrigindo…", cls: "bg-blue-50 text-blue-600 animate-pulse" },
    completed: { label: "Concluída", cls: "bg-green-50 text-green-700" },
    error: { label: "Erro", cls: "bg-red-50 text-red-600" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cls}`}>
      {label}
    </span>
  );
}

function ScoreChip({ score, max }: { score: number; max: number }) {
  const pct = (score / max) * 100;
  const color =
    pct >= 80 ? "text-green-700 bg-green-50" :
    pct >= 60 ? "text-brand-700 bg-brand-50" :
    pct >= 40 ? "text-amber-700 bg-amber-50" :
    "text-red-700 bg-red-50";
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${color}`}>
      {score}/{max}
    </span>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function StudentDashboard() {
  const { user, isLoading: userLoading } = useUser();
  const [essays, setEssays] = useState<EssayListItem[]>([]);
  const [dailyLimit, setDailyLimit] = useState<DailyLimitResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [essayRes, limitRes] = await Promise.all([
          api.get<{ items: EssayListItem[] }>("/essays?per_page=5"),
          api.get<DailyLimitResponse>("/essays/daily-limit"),
        ]);
        setEssays(essayRes.data.items);
        setDailyLimit(limitRes.data);
      } catch {
        // Erros tratados pelo interceptor
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
      </div>
    );
  }

  const completedEssays = essays.filter((e) => e.status === "completed");
  const avgScore =
    completedEssays.length > 0
      ? Math.round(
          completedEssays.reduce(
            (sum, e) => sum + (e.total_score ?? 0) / (e.max_score ?? 1000),
            0
          ) /
            completedEssays.length *
            100
        )
      : null;

  const canSubmit = dailyLimit
    ? dailyLimit.used < dailyLimit.limit
    : true;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Boas-vindas */}
      <div>
        <h2 className="font-display font-bold text-2xl text-slate-900">
          Olá, {user?.full_name.split(" ")[0]} 👋
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          {canSubmit
            ? "Você tem correções disponíveis hoje. Que tal enviar uma redação?"
            : "Você usou todas as correções de hoje. Volte amanhã ou faça upgrade."}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Correções hoje"
          value={`${dailyLimit?.used ?? 0} / ${(dailyLimit?.limit ?? 0) >= 9999 || dailyLimit?.limit === Infinity ? "Ilimitado" : dailyLimit?.limit ?? "—"}`}
          sub={`Plano ${user ? PLAN_LABELS[user.plan] : ""}`}
          icon={FilePlus2}
          color="brand"
        />
        <StatCard
          label="Total corrigidas"
          value={essays.filter((e) => e.status === "completed").length}
          icon={ScrollText}
          color="green"
        />
        <StatCard
          label="Média geral"
          value={avgScore !== null ? `${avgScore}%` : "—"}
          sub={completedEssays.length > 0 ? `${completedEssays.length} redações` : "Sem dados ainda"}
          icon={TrendingUp}
          color="amber"
        />
      </div>

      {/* Alerta de email não verificado */}
      {user && !user.is_email_verified && (
        <div className="flex gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Email não verificado</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Verifique sua caixa de entrada e clique no link que enviamos.
            </p>
          </div>
        </div>
      )}

      {/* Ação rápida */}
      <div className="rounded-2xl border border-accent-800/30 bg-accent-700 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-card">
        <div className="flex-1">
          <h3 className="font-display font-bold text-lg text-paper">
            Enviar nova redação
          </h3>
          <p className="text-accent-100 text-sm mt-1">
            Corrija no modelo ENEM ou Vestibular com feedback detalhado por competência.
          </p>
        </div>
        <Link
          href="/dashboard/aluno/nova-redacao"
          className={`flex-shrink-0 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
            canSubmit
              ? "bg-paper text-accent-800 hover:bg-paper-deep"
              : "bg-paper/15 text-paper/75 cursor-not-allowed pointer-events-none"
          }`}
        >
          {canSubmit ? "Enviar redação →" : "Limite atingido"}
        </Link>
      </div>

      {/* Últimas correções */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-slate-900">
            Últimas redações
          </h3>
          <Link
            href="/dashboard/aluno/historico"
            className="text-sm text-brand-700 hover:text-brand-800 font-medium"
          >
            Ver todas →
          </Link>
        </div>

        {essays.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 text-center">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <ScrollText className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-slate-500 text-sm">
              Nenhuma redação ainda.{" "}
              <Link href="/dashboard/aluno/nova-redacao" className="text-brand-700 font-medium">
                Envie a primeira →
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {essays.map((essay) => (
              <Link
                key={essay.id}
                href={
                  essay.status === "completed"
                    ? `/dashboard/aluno/correcao/${essay.id}`
                    : "#"
                }
                className={`flex items-center gap-4 bg-white rounded-xl border border-slate-100 p-4 shadow-card transition-shadow ${
                  essay.status === "completed"
                    ? "hover:shadow-card-hover cursor-pointer"
                    : "cursor-default"
                }`}
              >
                {/* Tipo */}
                <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-brand-700 uppercase">
                    {essay.essay_type === "enem" ? "EN" : "VB"}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {essay.title ?? `Redação de ${new Date(essay.created_at).toLocaleDateString("pt-BR")}`}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {essay.word_count} palavras ·{" "}
                    {new Date(essay.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </p>
                </div>

                {/* Status ou score */}
                <div className="flex-shrink-0">
                  {essay.status === "completed" && essay.total_score !== null ? (
                    <ScoreChip score={essay.total_score} max={essay.max_score ?? 1000} />
                  ) : (
                    <EssayStatusBadge status={essay.status} />
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
