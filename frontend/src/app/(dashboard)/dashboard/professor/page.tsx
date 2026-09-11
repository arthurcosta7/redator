"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  FilePlus2,
  ScrollText,
  Users,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useUser } from "@/contexts/UserContext";
import type { ProfessorOverviewAnalytics } from "@/types/turma";

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-[1240px] animate-pulse space-y-8" aria-label="Carregando painel">
      <div className="h-20 max-w-2xl rounded bg-ink/5" />
      <div className="h-64 rounded-xl bg-ink/10" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="h-80 rounded-xl bg-ink/5" />
        <div className="h-64 rounded-xl bg-ink/5" />
      </div>
    </div>
  );
}

export default function ProfessorDashboard() {
  const { user, isLoading: userLoading } = useUser();
  const [analytics, setAnalytics] = useState<ProfessorOverviewAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get<ProfessorOverviewAnalytics>("/professor/analytics");
        setAnalytics(response.data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (userLoading || loading) return <DashboardSkeleton />;

  const firstName = user?.full_name.split(" ")[0] ?? "professor";
  const classes = analytics?.turmas ?? [];

  return (
    <div className="mx-auto max-w-[1240px] space-y-8 lg:space-y-10">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-deep">Visão da turma</p>
          <h1 className="mt-2 max-w-2xl font-display text-3xl font-semibold tracking-[-0.025em] text-ink sm:text-4xl">
            Bom trabalho, Prof. {firstName}.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">
            {user?.school_name
              ? `${user.school_name}${user.discipline ? ` · ${user.discipline}` : ""}`
              : "Acompanhe entregas e identifique quem precisa de atenção."}
          </p>
        </div>
        <Link
          href="/dashboard/professor/turmas"
          className="inline-flex w-fit items-center gap-2 rounded bg-ink px-4 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-ink-soft active:translate-y-px"
        >
          <Users className="h-4 w-4" /> Gerenciar turmas
        </Link>
      </header>

      {user && !user.is_email_verified && (
        <aside className="flex gap-3 border-l-2 border-amber-600 bg-amber-50/70 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
          <p className="text-sm text-amber-900">
            <strong>Confirme seu e-mail.</strong> Use o link enviado à sua caixa de entrada para proteger e ativar a conta.
          </p>
        </aside>
      )}

      {error ? (
        <div className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-900">
          Não foi possível carregar os indicadores. Recarregue a página para tentar novamente.
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl bg-ink text-paper shadow-[0_24px_60px_rgba(45,29,18,0.14)]">
          <div className="grid lg:grid-cols-[1.25fr_1fr]">
            <div className="relative px-6 py-8 sm:px-9 sm:py-10 lg:px-11">
              <div className="absolute -left-16 -top-24 h-64 w-64 rounded-full bg-accent/20 blur-3xl" aria-hidden />
              <div className="relative">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/50">Nesta semana</p>
                <div className="mt-5 flex items-end gap-4">
                  <p className="font-display text-7xl font-semibold leading-none tabular-nums sm:text-8xl">
                    {analytics?.essays_this_week ?? 0}
                  </p>
                  <p className="max-w-32 pb-2 text-sm leading-5 text-paper/60">redações entregues pelos alunos</p>
                </div>
                <Link
                  href="/dashboard/professor/analytics"
                  className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-accent-200 transition-colors hover:text-paper"
                >
                  Analisar desempenho <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <dl className="grid grid-cols-2 border-t border-paper/10 bg-paper/[0.04] lg:border-l lg:border-t-0">
              <div className="border-b border-r border-paper/10 p-6 sm:p-8">
                <dt className="text-xs leading-5 text-paper/50">Turmas ativas</dt>
                <dd className="mt-3 font-display text-4xl font-semibold tabular-nums">{analytics?.turma_count ?? 0}</dd>
              </div>
              <div className="border-b border-paper/10 p-6 sm:p-8">
                <dt className="text-xs leading-5 text-paper/50">Alunos ativos</dt>
                <dd className="mt-3 font-display text-4xl font-semibold tabular-nums">{analytics?.active_member_count ?? 0}</dd>
              </div>
              <div className="border-r border-paper/10 p-6 sm:p-8">
                <dt className="text-xs leading-5 text-paper/50">Total de entregas</dt>
                <dd className="mt-3 font-display text-4xl font-semibold tabular-nums">{analytics?.total_essay_count ?? 0}</dd>
              </div>
              <div className="p-6 sm:p-8">
                <dt className="text-xs leading-5 text-paper/50">Média geral</dt>
                <dd className="mt-3 font-display text-4xl font-semibold tabular-nums">
                  {analytics?.avg_score_pct != null ? `${analytics.avg_score_pct}%` : "—"}
                </dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">Acompanhamento</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-ink">Turmas em andamento</h2>
            </div>
            {classes.length > 0 && (
              <Link href="/dashboard/professor/turmas" className="text-xs font-semibold text-accent-deep hover:text-accent">
                Ver todas →
              </Link>
            )}
          </div>

          {classes.length === 0 ? (
            <div className="product-surface rounded-xl border px-6 py-12 sm:px-10">
              <Users className="h-7 w-7 text-accent" strokeWidth={1.6} />
              <h3 className="mt-5 font-display text-xl font-semibold text-ink">Organize a primeira turma.</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-ink-muted">
                Adicione alunos, publique uma proposta e acompanhe somente as redações entregues nas suas tarefas.
              </p>
              <Link href="/dashboard/professor/turmas" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent-deep">
                Criar turma <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="product-surface overflow-hidden rounded-xl border">
              {classes.slice(0, 6).map((turma, index) => (
                <Link
                  key={turma.id}
                  href={`/dashboard/professor/turmas/${turma.id}`}
                  className={`group grid gap-4 px-5 py-5 transition-colors hover:bg-paper-deep/60 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_1.5rem] sm:items-center ${index ? "border-t border-ink-line" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-semibold text-ink">{turma.name}</p>
                    <p className="mt-1 text-xs text-ink-muted">{turma.active_members} alunos ativos</p>
                  </div>
                  <div>
                    <p className="font-display text-xl font-semibold tabular-nums text-ink">{turma.essay_count}</p>
                    <p className="text-[10px] text-ink-muted">entregas</p>
                  </div>
                  <div>
                    <p className="font-display text-xl font-semibold tabular-nums text-ink">
                      {turma.avg_score_pct != null ? `${turma.avg_score_pct}%` : "—"}
                    </p>
                    <p className="text-[10px] text-ink-muted">média</p>
                  </div>
                  <ArrowRight className="hidden h-4 w-4 text-ink-muted transition-transform group-hover:translate-x-1 sm:block" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="lg:border-l lg:border-ink-line lg:pl-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">Acesso rápido</p>
          <nav className="mt-4 divide-y divide-ink-line border-y border-ink-line" aria-label="Ações rápidas">
            <Link href="/dashboard/professor/turmas" className="group flex items-center gap-3 py-4 text-sm font-semibold text-ink transition-colors hover:text-accent-deep">
              <Users className="h-4 w-4 text-accent" strokeWidth={1.8} />
              Nova tarefa para a turma
              <ArrowRight className="ml-auto h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/dashboard/professor/nova-redacao" className="group flex items-center gap-3 py-4 text-sm font-semibold text-ink transition-colors hover:text-accent-deep">
              <FilePlus2 className="h-4 w-4 text-accent" strokeWidth={1.8} />
              Corrigir texto próprio
              <ArrowRight className="ml-auto h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/dashboard/professor/analytics" className="group flex items-center gap-3 py-4 text-sm font-semibold text-ink transition-colors hover:text-accent-deep">
              <BarChart3 className="h-4 w-4 text-accent" strokeWidth={1.8} />
              Comparar desempenho
              <ArrowRight className="ml-auto h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/dashboard/professor/historico" className="group flex items-center gap-3 py-4 text-sm font-semibold text-ink transition-colors hover:text-accent-deep">
              <ScrollText className="h-4 w-4 text-accent" strokeWidth={1.8} />
              Histórico pessoal
              <ArrowRight className="ml-auto h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </nav>
          <p className="mt-5 text-xs leading-5 text-ink-muted">
            As métricas incluem apenas redações entregues nas tarefas das suas turmas.
          </p>
        </aside>
      </div>
    </div>
  );
}
