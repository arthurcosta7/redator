"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  FilePlus2,
  ScrollText,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useUser } from "@/contexts/UserContext";
import type {
  MonthlyCreditsResponse,
  EssayListItem,
  EssayListResponse,
} from "@/types/essay";
import { PLAN_LABELS } from "@/types/user";

function EssayStatus({ status }: { status: EssayListItem["status"] }) {
  const labels = {
    pending: "Pendente",
    processing: "Em correção",
    completed: "Concluída",
    error: "Falhou",
  };
  const colors = {
    pending: "text-ink-muted",
    processing: "text-accent animate-pulse",
    completed: "text-emerald-700",
    error: "text-red-700",
  };

  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-[1180px] animate-pulse space-y-8" aria-label="Carregando painel">
      <div className="h-20 max-w-xl rounded bg-ink/5" />
      <div className="h-64 rounded-xl bg-ink/10" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="h-80 rounded-xl bg-ink/5" />
        <div className="h-64 rounded-xl bg-ink/5" />
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  const { user, isLoading: userLoading } = useUser();
  const [essays, setEssays] = useState<EssayListItem[]>([]);
  const [essayTotal, setEssayTotal] = useState(0);
  const [credits, setCredits] = useState<MonthlyCreditsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [essayRes, limitRes] = await Promise.all([
          api.get<EssayListResponse>("/essays?per_page=5"),
          api.get<MonthlyCreditsResponse>("/essays/credits"),
        ]);
        setEssays(essayRes.data.items);
        setEssayTotal(essayRes.data.total);
        setCredits(limitRes.data);
      } catch {
        // O interceptor apresenta erros globais de conexão.
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (userLoading || loading) return <DashboardSkeleton />;

  const completedEssays = essays.filter((essay) => essay.status === "completed");
  const average = completedEssays.length
    ? Math.round(
        (completedEssays.reduce(
          (sum, essay) => sum + (essay.total_score ?? 0) / (essay.max_score || 1000),
          0,
        ) /
          completedEssays.length) *
          100,
      )
    : null;
  const used = credits?.used ?? 0;
  const limit = credits?.limit ?? 0;
  const isUnlimited = limit >= 9999 || limit === Infinity;
  const canSubmit = credits ? credits.remaining > 0 : true;
  const usagePercentage = isUnlimited || limit === 0
    ? 0
    : Math.min(100, Math.round((used / limit) * 100));
  const firstName = user?.full_name.split(" ")[0] ?? "estudante";

  return (
    <div className="mx-auto max-w-[1180px] space-y-8 lg:space-y-10">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-deep">
            Seu espaço de escrita
          </p>
          <h1 className="mt-2 max-w-2xl font-display text-3xl font-semibold tracking-[-0.025em] text-ink sm:text-4xl">
            Bom te ver, {firstName}.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">
            Continue de onde parou ou envie um novo texto para descobrir o próximo ponto de melhoria.
          </p>
        </div>
        <Link
          href="/dashboard/aluno/historico"
          className="link-underline w-fit text-sm font-medium text-ink-soft hover:text-ink"
        >
          Abrir histórico
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

      <section className="relative overflow-hidden rounded-xl bg-ink text-paper shadow-[0_24px_60px_rgba(45,29,18,0.14)]">
        <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-accent/25 blur-3xl" aria-hidden />
        <div className="relative grid lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="px-6 py-8 sm:px-9 sm:py-10 lg:px-11">
            <div className="mb-8 flex h-10 w-10 items-center justify-center rounded bg-paper/10">
              <FilePlus2 className="h-5 w-5 text-accent-200" strokeWidth={1.8} />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/55">
              Próximo passo
            </p>
            <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold leading-tight tracking-[-0.025em] sm:text-4xl">
              Transforme seu próximo rascunho em um plano claro de melhoria.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-paper/65">
              Receba nota por competência, comentários nos trechos e prioridades para a próxima versão.
            </p>
            {canSubmit ? (
              <Link
                href="/dashboard/aluno/nova-redacao"
                className="mt-7 inline-flex items-center gap-2 rounded bg-paper px-5 py-3 text-sm font-semibold text-ink transition duration-200 hover:bg-accent-100 active:translate-y-px"
              >
                Enviar nova redação <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="mt-7 inline-flex rounded bg-paper/10 px-5 py-3 text-sm font-semibold text-paper/45">
                Créditos do mês utilizados
              </span>
            )}
          </div>

          <div className="border-t border-paper/10 bg-paper/[0.04] px-6 py-8 sm:px-9 lg:border-l lg:border-t-0 lg:px-7 lg:py-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/50">
              Créditos deste mês
            </p>
            <p className="mt-4 font-display text-5xl font-semibold tabular-nums">
              {used}
              <span className="ml-2 text-xl font-normal text-paper/45">
                / {isUnlimited ? "∞" : limit || "—"}
              </span>
            </p>
            <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-paper/10">
              <div
                className="h-full rounded-full bg-accent-300 transition-[width] duration-500"
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-paper/55">
              Plano {user ? PLAN_LABELS[user.plan] : ""}. Renovação mensal
              {credits?.rollover ? ` · ${credits.rollover} acumulados` : ""}.
            </p>
            {!canSubmit && (
              <div className="mt-5 space-y-2">
                <p className="text-xs leading-5 text-paper/70">
                  {credits?.weakest_competency
                    ? `Você evoluiu, mas ${credits.weakest_competency.name} ainda limita sua nota. Continue com mais correções e um plano direcionado.`
                    : "Continue o treino com mais correções e um plano direcionado."}
                </p>
                <Link href="/dashboard/aluno/plano" className="inline-block text-xs font-semibold text-accent-200 hover:text-paper">Conhecer o Standard →</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-10">
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">Atividade recente</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-ink">Suas redações</h2>
            </div>
            {essays.length > 0 && (
              <Link href="/dashboard/aluno/historico" className="text-xs font-semibold text-accent-deep hover:text-accent">
                Ver todas →
              </Link>
            )}
          </div>

          {essays.length === 0 ? (
            <div className="product-surface rounded-xl border px-6 py-12 sm:px-10">
              <ScrollText className="h-7 w-7 text-accent" strokeWidth={1.6} />
              <h3 className="mt-5 font-display text-xl font-semibold text-ink">Seu histórico começa com um texto.</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-ink-muted">
                Envie uma redação para receber o primeiro diagnóstico e acompanhar sua evolução daqui em diante.
              </p>
              <Link href="/dashboard/aluno/nova-redacao" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent-deep">
                Enviar a primeira <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="product-surface overflow-hidden rounded-xl border">
              {essays.map((essay, index) => {
                const available = essay.status === "completed";
                const content = (
                  <>
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-paper-deep font-mono text-[10px] font-semibold text-accent-deep">
                      {essay.essay_type === "enem" ? "EN" : "VT"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{essay.title || "Redação sem título"}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {essay.word_count} palavras · {new Date(essay.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </p>
                    </div>
                    <div className="text-right">
                      {available && essay.total_score !== null ? (
                        <>
                          <p className="font-display text-xl font-semibold tabular-nums text-ink">
                            {essay.total_score}<span className="text-xs font-normal text-ink-muted">/{essay.max_score ?? 1000}</span>
                          </p>
                          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-emerald-700">Ver análise</span>
                        </>
                      ) : (
                        <EssayStatus status={essay.status} />
                      )}
                    </div>
                  </>
                );

                return available ? (
                  <Link
                    key={essay.id}
                    href={`/dashboard/aluno/correcao/${essay.id}`}
                    className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-paper-deep/60 ${index ? "border-t border-ink-line" : ""}`}
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={essay.id} className={`flex items-center gap-4 px-5 py-4 ${index ? "border-t border-ink-line" : ""}`}>
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside className="space-y-8 lg:border-l lg:border-ink-line lg:pl-8">
          <section>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">Seu ritmo</p>
            <div className="mt-4 divide-y divide-ink-line border-y border-ink-line">
              <div className="py-4">
                <p className="font-display text-3xl font-semibold tabular-nums text-ink">{essayTotal}</p>
                <p className="mt-1 text-xs text-ink-muted">redações no histórico</p>
              </div>
              <div className="py-4">
                <p className="font-display text-3xl font-semibold tabular-nums text-ink">{average !== null ? `${average}%` : "—"}</p>
                <p className="mt-1 text-xs text-ink-muted">média das correções recentes</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg bg-accent-50 px-5 py-5">
            <TrendingUp className="h-5 w-5 text-accent-deep" strokeWidth={1.8} />
            <h3 className="mt-4 font-display text-lg font-semibold text-ink">
              {credits?.weakest_competency?.name ?? "Encontre seu padrão"}
            </h3>
            <p className="mt-2 text-xs leading-5 text-ink-muted">
              {credits?.weakest_competency
                ? `Esta é sua prioridade atual. ${credits.latest_score_delta === null ? "Use a próxima redação para criar uma comparação." : credits.latest_score_delta >= 0 ? `Sua nota recente avançou ${credits.latest_score_delta} ponto(s) percentual(is).` : `Sua nota recente variou ${credits.latest_score_delta} ponto(s) percentual(is); revise o diagnóstico.`}`
                : "Compare competências e descubra onde sua próxima hora de estudo terá mais impacto."}
            </p>
            <Link href="/dashboard/aluno/insights" className="mt-4 inline-block text-xs font-semibold text-accent-deep hover:text-accent">
              Abrir insights →
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
