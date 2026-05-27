"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, RefreshCw, TrendingUp } from "lucide-react";
import { api } from "@/lib/api/client";
import type { AdminAnalytics, AdminAnalyticsDay } from "@/types/admin";

// ─── Gráfico de barras SVG ────────────────────────────────────────────────────

function BarChart({
  data,
  valueKey,
  color,
  label,
  maxValue,
}: {
  data: AdminAnalyticsDay[];
  valueKey: keyof AdminAnalyticsDay;
  color: string;
  label: string;
  maxValue: number;
}) {
  const W = 800;
  const H = 140;
  const PADDING = { top: 10, bottom: 28, left: 30, right: 10 };
  const barW = Math.max(2, (W - PADDING.left - PADDING.right) / data.length - 2);
  const chartH = H - PADDING.top - PADDING.bottom;
  const chartW = W - PADDING.left - PADDING.right;

  // Mostra apenas algumas labels no eixo X para não sobrecarregar
  const labelStep = Math.ceil(data.length / 8);

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{label}</p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: H }}
        aria-label={label}
      >
        {/* Linhas de grade */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = PADDING.top + chartH * (1 - frac);
          const val = Math.round(maxValue * frac);
          return (
            <g key={frac}>
              <line
                x1={PADDING.left}
                x2={W - PADDING.right}
                y1={y}
                y2={y}
                stroke="#f1f5f9"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 4}
                y={y + 4}
                textAnchor="end"
                fontSize={9}
                fill="#94a3b8"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Barras */}
        {data.map((d, i) => {
          const val = Number(d[valueKey]) || 0;
          const barH = maxValue > 0 ? (val / maxValue) * chartH : 0;
          const x = PADDING.left + (chartW / data.length) * i + 1;
          const y = PADDING.top + chartH - barH;

          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                fill={color}
                rx={2}
                opacity={0.85}
              />
              {/* Label do eixo X (a cada N dias) */}
              {i % labelStep === 0 && (
                <text
                  x={x + barW / 2}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize={8}
                  fill="#94a3b8"
                >
                  {d.date.slice(5)} {/* "MM-DD" */}
                </text>
              )}
              {/* Tooltip simulado: valor acima da barra se > 0 */}
              {val > 0 && barH > 14 && (
                <text
                  x={x + barW / 2}
                  y={y - 2}
                  textAnchor="middle"
                  fontSize={8}
                  fill={color}
                  opacity={0.8}
                >
                  {val}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Cards de totais ─────────────────────────────────────────────────────────

function SummaryRow({ data }: { data: AdminAnalyticsDay[] }) {
  const totalEssays = data.reduce((s, d) => s + d.essays_submitted, 0);
  const totalCorrections = data.reduce((s, d) => s + d.corrections_completed, 0);
  const totalUsers = data.reduce((s, d) => s + d.new_users, 0);
  const avgEssays = data.length > 0 ? (totalEssays / data.length).toFixed(1) : "0";

  const items = [
    { label: "Redações no período", value: totalEssays, sub: `Média: ${avgEssays}/dia` },
    { label: "Correções concluídas", value: totalCorrections, sub: `Taxa: ${totalEssays > 0 ? Math.round((totalCorrections / totalEssays) * 100) : 0}%` },
    { label: "Novos usuários", value: totalUsers, sub: `Média: ${data.length > 0 ? (totalUsers / data.length).toFixed(1) : 0}/dia` },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map((item) => (
        <div key={item.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold font-display text-slate-900">{item.value.toLocaleString("pt-BR")}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">{item.label}</p>
          <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const fetchAnalytics = async (d = days) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<AdminAnalytics>(`/admin/analytics?days=${d}`);
      setAnalytics(res.data);
    } catch {
      setError("Não foi possível carregar os dados de analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(days);
  }, [days]);

  const maxEssays = analytics
    ? Math.max(1, ...analytics.daily.map((d) => d.essays_submitted))
    : 1;
  const maxCorrections = analytics
    ? Math.max(1, ...analytics.daily.map((d) => d.corrections_completed))
    : 1;
  const maxUsers = analytics
    ? Math.max(1, ...analytics.daily.map((d) => d.new_users))
    : 1;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-900">Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Tendências e dados de uso da plataforma</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Seletor de período */}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-brand-400 bg-white"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={14}>Últimos 14 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={60}>Últimos 60 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
          <button
            onClick={() => fetchAnalytics(days)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading && !analytics ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      ) : analytics ? (
        <>
          {/* Resumo do período */}
          <SummaryRow data={analytics.daily} />

          {/* Gráfico: Redações enviadas */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <BarChart
              data={analytics.daily}
              valueKey="essays_submitted"
              color="#7c3aed"
              label={`Redações enviadas — últimos ${days} dias`}
              maxValue={maxEssays}
            />
          </div>

          {/* Gráfico: Correções concluídas */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <BarChart
              data={analytics.daily}
              valueKey="corrections_completed"
              color="#10b981"
              label={`Correções concluídas — últimos ${days} dias`}
              maxValue={maxCorrections}
            />
          </div>

          {/* Gráfico: Novos usuários */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <BarChart
              data={analytics.daily}
              valueKey="new_users"
              color="#3b82f6"
              label={`Novos usuários — últimos ${days} dias`}
              maxValue={maxUsers}
            />
          </div>

          {/* Tabela de dados brutos */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-500" />
                Dados por dia
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-50 bg-slate-50">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Data</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Redações</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Correções</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Novos usuários</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[...analytics.daily].reverse().map((day) => (
                    <tr key={day.date} className="hover:bg-slate-50/50">
                      <td className="px-5 py-2.5 text-slate-600 font-medium">
                        {new Date(day.date + "T00:00:00").toLocaleDateString("pt-BR", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={day.essays_submitted > 0 ? "text-purple-700 font-semibold" : "text-slate-300"}>
                          {day.essays_submitted}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={day.corrections_completed > 0 ? "text-emerald-700 font-semibold" : "text-slate-300"}>
                          {day.corrections_completed}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <span className={day.new_users > 0 ? "text-blue-700 font-semibold" : "text-slate-300"}>
                          {day.new_users}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
