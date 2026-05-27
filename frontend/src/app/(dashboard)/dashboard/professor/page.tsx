"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Users,
  ScrollText,
  TrendingUp,
  FilePlus2,
  BarChart3,
  Loader2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useUser } from "@/contexts/UserContext";
import type { ProfessorOverviewAnalytics } from "@/types/turma";
import { PLAN_LABELS } from "@/types/user";

// ─── Componentes menores ──────────────────────────────────────────────────────

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
  color?: "brand" | "purple" | "green" | "amber";
}) {
  const colors = {
    brand:  "bg-brand-50  text-brand-600",
    purple: "bg-purple-50 text-purple-600",
    green:  "bg-green-50  text-green-600",
    amber:  "bg-amber-50  text-amber-600",
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

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ProfessorDashboard() {
  const { user, isLoading: userLoading } = useUser();
  const [analytics, setAnalytics] = useState<ProfessorOverviewAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get<ProfessorOverviewAnalytics>("/professor/analytics");
        setAnalytics(res.data);
      } catch {
        setError(true);
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Boas-vindas */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-900">
            Olá, Prof. {user?.full_name.split(" ")[0]} 👋
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {user?.school_name
              ? `${user.school_name}${user.discipline ? ` · ${user.discipline}` : ""}`
              : "Painel do Professor"}
          </p>
        </div>
        <Link
          href="/dashboard/professor/turmas"
          className="flex-shrink-0 bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2"
        >
          <Users className="w-4 h-4" />
          Gerenciar Turmas
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Turmas ativas"
          value={analytics?.turma_count ?? 0}
          icon={GraduationCap}
          color="purple"
        />
        <StatCard
          label="Alunos ativos"
          value={analytics?.active_member_count ?? 0}
          sub="em todas as turmas"
          icon={Users}
          color="brand"
        />
        <StatCard
          label="Redações esta semana"
          value={analytics?.essays_this_week ?? 0}
          sub={`${analytics?.total_essay_count ?? 0} no total`}
          icon={ScrollText}
          color="green"
        />
        <StatCard
          label="Média geral"
          value={analytics?.avg_score_pct != null ? `${analytics.avg_score_pct}%` : "—"}
          sub="das correções"
          icon={TrendingUp}
          color="amber"
        />
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/dashboard/professor/nova-redacao"
          className="bg-white rounded-2xl border border-slate-100 p-5 shadow-card hover:shadow-card-hover transition-shadow flex items-center gap-4 group"
        >
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
            <FilePlus2 className="w-5 h-5 text-brand-700" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Nova Redação</p>
            <p className="text-xs text-slate-400">Corrigir com IA</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-brand-500 transition-colors" />
        </Link>

        <Link
          href="/dashboard/professor/turmas"
          className="bg-white rounded-2xl border border-slate-100 p-5 shadow-card hover:shadow-card-hover transition-shadow flex items-center gap-4 group"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
            <Users className="w-5 h-5 text-purple-700" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Turmas</p>
            <p className="text-xs text-slate-400">Gerenciar alunos</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-purple-500 transition-colors" />
        </Link>

        <Link
          href="/dashboard/professor/analytics"
          className="bg-white rounded-2xl border border-slate-100 p-5 shadow-card hover:shadow-card-hover transition-shadow flex items-center gap-4 group"
        >
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
            <BarChart3 className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Analytics</p>
            <p className="text-xs text-slate-400">Desempenho por turma</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-green-500 transition-colors" />
        </Link>
      </div>

      {/* Turmas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-slate-900">Suas Turmas</h3>
          <Link
            href="/dashboard/professor/turmas"
            className="text-sm text-brand-700 hover:text-brand-800 font-medium"
          >
            Ver todas →
          </Link>
        </div>

        {error ? (
          <div className="flex gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              Não foi possível carregar os dados. Recarregue a página.
            </p>
          </div>
        ) : !analytics || analytics.turmas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 text-center">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Users className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-slate-500 text-sm">
              Nenhuma turma criada.{" "}
              <Link href="/dashboard/professor/turmas" className="text-brand-700 font-medium">
                Criar primeira turma →
              </Link>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {analytics.turmas.map((turma) => (
              <Link
                key={turma.id}
                href={`/dashboard/professor/turmas/${turma.id}`}
                className="bg-white rounded-2xl border border-slate-100 p-5 shadow-card hover:shadow-card-hover transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  {turma.avg_score_pct != null && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      turma.avg_score_pct >= 70 ? "bg-green-50 text-green-700" :
                      turma.avg_score_pct >= 50 ? "bg-amber-50 text-amber-700" :
                      "bg-red-50 text-red-700"
                    }`}>
                      {turma.avg_score_pct}%
                    </span>
                  )}
                </div>
                <p className="font-display font-bold text-slate-900 mb-1">{turma.name}</p>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>{turma.active_members} alunos</span>
                  <span>·</span>
                  <span>{turma.essay_count} redações</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Alerta email não verificado */}
      {user && !user.is_email_verified && (
        <div className="flex gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Email não verificado</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Verifique sua caixa de entrada para ativar a conta.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
