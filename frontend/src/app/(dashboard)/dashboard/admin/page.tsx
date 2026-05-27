"use client";

import { useEffect, useState } from "react";
import {
  Users,
  FileText,
  CheckCircle2,
  TrendingUp,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useUser } from "@/contexts/UserContext";
import type { AdminStats } from "@/types/admin";

// ─── Componentes de UI ────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "blue",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: "blue" | "green" | "purple" | "amber" | "red";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {label}
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900 font-display">
            {value}
          </p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function DistributionBar({
  label,
  items,
  colorClass,
}: {
  label: string;
  items: { name: string; value: number; color: string }[];
  colorClass?: string;
}) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        {label}
      </p>
      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.name}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-600 font-medium capitalize">{item.name}</span>
              <span className="text-slate-400">
                {item.value} ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${item.color}`}
                style={{ width: `${total > 0 ? (item.value / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AdminOverviewPage() {
  const { user } = useUser();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<AdminStats>("/admin/stats");
      setStats(res.data);
    } catch {
      setError("Não foi possível carregar as estatísticas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const planItems = stats
    ? [
        { name: "Grátis", value: stats.plan_distribution.free ?? 0, color: "bg-slate-400" },
        { name: "Standard", value: stats.plan_distribution.standard ?? 0, color: "bg-brand-500" },
        { name: "Pro", value: stats.plan_distribution.pro ?? 0, color: "bg-amber-500" },
      ]
    : [];

  const userTypeItems = stats
    ? [
        { name: "Alunos", value: stats.user_type_distribution.student ?? 0, color: "bg-blue-500" },
        { name: "Professores", value: stats.user_type_distribution.teacher ?? 0, color: "bg-purple-500" },
      ]
    : [];

  const essayTypeItems = stats
    ? [
        { name: "ENEM", value: stats.essay_type_distribution.enem ?? 0, color: "bg-emerald-500" },
        { name: "Vestibular", value: stats.essay_type_distribution.vestibular ?? 0, color: "bg-cyan-500" },
      ]
    : [];

  const statusItems = stats
    ? [
        { name: "Concluídas", value: stats.status_distribution.completed ?? 0, color: "bg-green-500" },
        { name: "Pendentes", value: stats.status_distribution.pending ?? 0, color: "bg-amber-400" },
        { name: "Processando", value: stats.status_distribution.processing ?? 0, color: "bg-blue-400" },
        { name: "Erro", value: stats.status_distribution.error ?? 0, color: "bg-red-400" },
      ]
    : [];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-900">
            Visão Geral
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Bem-vindo, {user?.full_name?.split(" ")[0]}. Aqui está o resumo da plataforma.
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* Erro */}
      {error && (
        <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading && !stats ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      ) : stats ? (
        <>
          {/* Stats principais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total de Usuários"
              value={stats.total_users.toLocaleString("pt-BR")}
              sub={`${stats.active_users} ativos`}
              icon={Users}
              color="blue"
            />
            <StatCard
              label="Redações Hoje"
              value={stats.essays_today}
              sub={`${stats.essays_week} esta semana`}
              icon={FileText}
              color="purple"
            />
            <StatCard
              label="Correções Concluídas"
              value={stats.corrections_completed.toLocaleString("pt-BR")}
              sub={`${stats.corrections_today} hoje`}
              icon={CheckCircle2}
              color="green"
            />
            <StatCard
              label="Novos Usuários"
              value={stats.new_users_today}
              sub={`${stats.new_users_week} esta semana`}
              icon={TrendingUp}
              color="amber"
            />
          </div>

          {/* Stats secundários */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total de Redações"
              value={stats.total_essays.toLocaleString("pt-BR")}
              icon={FileText}
              color="purple"
            />
            <StatCard
              label="Pendentes / Processando"
              value={(stats.status_distribution.pending ?? 0) + (stats.status_distribution.processing ?? 0)}
              sub="precisam de atenção"
              icon={Clock}
              color="amber"
            />
            <StatCard
              label="Erros de Correção"
              value={stats.status_distribution.error ?? 0}
              sub={stats.status_distribution.error ? "requer investigação" : "tudo ok"}
              icon={AlertCircle}
              color="red"
            />
            <StatCard
              label="Usuários Inativos"
              value={stats.total_users - stats.active_users}
              sub="contas suspensas"
              icon={Users}
              color="red"
            />
          </div>

          {/* Distribuições */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <DistributionBar label="Distribuição de Planos" items={planItems} />
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <DistributionBar label="Tipo de Usuário" items={userTypeItems} />
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <DistributionBar label="Tipo de Redação" items={essayTypeItems} />
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <DistributionBar label="Status das Redações" items={statusItems} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
