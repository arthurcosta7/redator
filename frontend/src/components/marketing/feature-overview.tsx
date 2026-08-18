import type { LucideIcon } from "lucide-react";
import { FileCheck2, ListChecks, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type FeaturePanelProps = {
  children: React.ReactNode;
  className?: string;
};

function FeaturePanel({ children, className }: FeaturePanelProps) {
  return (
    <article
      className={cn(
        "relative overflow-hidden border border-ink-line bg-paper",
        className
      )}
    >
      <span aria-hidden className="absolute -left-px -top-px size-2 border-l-2 border-t-2 border-accent" />
      <span aria-hidden className="absolute -right-px -top-px size-2 border-r-2 border-t-2 border-accent" />
      <span aria-hidden className="absolute -bottom-px -left-px size-2 border-b-2 border-l-2 border-accent" />
      <span aria-hidden className="absolute -bottom-px -right-px size-2 border-b-2 border-r-2 border-accent" />
      {children}
    </article>
  );
}

function PanelHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <header className="p-6 sm:p-8">
      <div className="flex items-center gap-2 text-sm font-medium text-ink-muted">
        <Icon className="size-4 text-accent" aria-hidden />
        <span>{title}</span>
      </div>
      <h3 className="mt-7 max-w-md font-display text-2xl font-semibold leading-[1.12] text-ink sm:text-3xl">
        {description}
      </h3>
    </header>
  );
}

const competencies = [
  { label: "C1", score: "160", width: "80%" },
  { label: "C2", score: "180", width: "90%" },
  { label: "C3", score: "140", width: "70%" },
  { label: "C4", score: "160", width: "80%" },
  { label: "C5", score: "120", width: "60%" },
];

function CorrectionPreview() {
  return (
    <div className="relative border-t border-dashed border-ink-line px-6 pb-8 pt-7 sm:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_120%_at_50%_0%,transparent_35%,rgba(241,236,226,0.9)_100%)]" />
      <div className="relative caderno border border-ink-line p-5 font-display text-[15px] leading-8 text-ink-soft shadow-card sm:p-6 sm:text-base">
        <p>
          Segundo dados do <span className="grife-good">IBGE (2023)</span>, o acesso à educação ainda revela desigualdades profundas. Por isso, políticas públicas precisam considerar a realidade de cada região.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 font-sans text-xs">
          <span className="bg-[var(--good-bg)] px-2 py-1 text-[var(--good-fg)]">repertório pertinente</span>
          <span className="bg-accent-50 px-2 py-1 text-accent-deep">argumento a aprofundar</span>
        </div>
      </div>
    </div>
  );
}

function CompetencyPreview() {
  return (
    <div className="relative border-t border-dashed border-ink-line px-6 pb-8 pt-7 sm:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(85%_100%_at_75%_30%,transparent_30%,rgba(241,236,226,0.9)_100%)]" />
      <div className="relative border border-ink-line bg-[#fffdf9] p-5 shadow-card sm:p-6">
        <div className="mb-5 flex items-end justify-between border-b border-ink-line pb-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">Resultado ENEM</p>
            <p className="mt-1 font-display text-3xl font-semibold text-ink">760</p>
          </div>
          <span className="font-mono text-xs text-ink-muted">/ 1000</span>
        </div>
        <ul className="space-y-3" aria-label="Pontuação por competência">
          {competencies.map((item) => (
            <li key={item.label} className="grid grid-cols-[2rem_1fr_2.5rem] items-center gap-3">
              <span className="font-mono text-[11px] text-ink-muted">{item.label}</span>
              <span className="h-1.5 overflow-hidden bg-paper-deep">
                <span className="block h-full bg-accent" style={{ width: item.width }} />
              </span>
              <span className="text-right font-mono text-[11px] text-ink-soft">{item.score}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const connections = [
  { first: "Texto", second: "Critérios", result: "Diagnóstico", pattern: "lines" },
  { first: "Grifes", second: "Notas", result: "Clareza", pattern: "solid" },
  { first: "Treino", second: "Histórico", result: "Evolução", pattern: "lines" },
  { first: "Turma", second: "Relatório", result: "Decisão", pattern: "solid" },
] as const;

function ConnectionDiagram({
  first,
  second,
  result,
  pattern,
}: (typeof connections)[number]) {
  return (
    <div className="min-w-[8.5rem] text-center">
      <div className="mx-auto flex size-[5.5rem] items-center justify-center border border-ink-line bg-paper-deep/70">
        <div className="flex -space-x-3" aria-hidden>
          <span
            className={cn(
              "size-9 rounded-full border border-accent bg-paper",
              pattern === "lines" && "bg-[repeating-linear-gradient(-45deg,rgba(181,69,27,.4),rgba(181,69,27,.4)_1px,transparent_1px,transparent_4px)]"
            )}
          />
          <span className="z-10 size-9 rounded-full border border-ink bg-paper/80" />
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold text-ink">{result}</p>
      <p className="mt-1 text-xs text-ink-muted">{first} + {second}</p>
    </div>
  );
}

export function FeatureOverview() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <FeaturePanel>
        <PanelHeading
          icon={FileCheck2}
          title="Correção no próprio texto"
          description="Cada observação aparece exatamente onde a sua escrita pede atenção."
        />
        <CorrectionPreview />
      </FeaturePanel>

      <FeaturePanel>
        <PanelHeading
          icon={ListChecks}
          title="Critérios explicados"
          description="A nota deixa de ser um número solto e mostra onde você ganhou ou perdeu pontos."
        />
        <CompetencyPreview />
      </FeaturePanel>

      <FeaturePanel className="p-6 sm:p-8 lg:col-span-2">
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-ink-muted">
            <TrendingUp className="size-4 text-accent" aria-hidden />
            <span>Do diagnóstico à evolução</span>
          </div>
          <h3 className="mt-5 font-display text-2xl font-semibold leading-tight text-ink sm:text-3xl">
            O feedback conecta o que você escreveu ao próximo passo de forma concreta.
          </h3>
        </div>

        <div
          className="scrollbar-hide mt-9 flex snap-x gap-5 overflow-x-auto pb-2 sm:justify-center sm:gap-8"
          role="region"
          aria-label="Etapas do feedback"
          tabIndex={0}
        >
          {connections.map((connection) => (
            <div key={connection.result} className="snap-center">
              <ConnectionDiagram {...connection} />
            </div>
          ))}
        </div>
      </FeaturePanel>
    </div>
  );
}
