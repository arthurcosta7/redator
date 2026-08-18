import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Check, PenLine } from "lucide-react";

import { cn } from "@/lib/utils";

function RegistrationBrandPanel() {
  const benefits = [
    "Nota explicada por competência",
    "Grifes diretamente no texto",
    "Histórico para acompanhar a evolução",
  ];

  return (
    <aside className="relative hidden h-dvh overflow-hidden bg-ink text-paper lg:sticky lg:top-0 lg:flex lg:flex-col lg:justify-between">
      <div aria-hidden className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(250,247,242,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(250,247,242,.14)_1px,transparent_1px)] [background-size:4rem_4rem]" />
      <div aria-hidden className="absolute -bottom-40 -right-28 size-[34rem] rounded-full border border-paper/10" />
      <div aria-hidden className="absolute -bottom-24 -right-12 size-[24rem] rounded-full border border-accent/50" />

      <div className="relative z-10 flex items-center justify-between px-10 py-8 xl:px-14">
        <Link href="/" className="inline-flex items-center gap-3" aria-label="Voltar para a página inicial do Redator">
          <span className="flex size-9 items-center justify-center border border-paper/25 text-accent-light">
            <PenLine className="size-4" strokeWidth={2.25} aria-hidden />
          </span>
          <span className="font-display text-2xl font-semibold">Redator</span>
        </Link>
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 px-2 text-sm text-paper/70 transition-colors hover:text-paper">
          <ArrowLeft className="size-4" aria-hidden />
          Voltar ao site
        </Link>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-2xl px-10 pb-8 xl:px-14">
        <p className="max-w-xl font-display text-4xl font-semibold leading-[1.08] tracking-[-0.02em] xl:text-5xl">
          Comece uma rotina de escrita com retorno claro em cada etapa.
        </p>

        <div className="mt-12 rotate-[-1.5deg] border border-paper/20 bg-[#fffaf0] p-7 text-ink shadow-[0_24px_70px_rgba(0,0,0,.28)] xl:p-9">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">Sua conta no Redator</p>
          <p className="mt-2 font-display text-2xl font-semibold">Feedback que acompanha a prática.</p>
          <div className="mt-6 border-t border-ink/15 pt-5">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3 border-b border-ink/10 py-3 last:border-b-0">
                <span className="flex size-7 shrink-0 items-center justify-center bg-[var(--good-bg)] text-[var(--good-fg)]">
                  <Check className="size-4" strokeWidth={2.5} aria-hidden />
                </span>
                <span className="text-sm font-medium text-ink-soft">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="relative z-10 px-10 py-8 font-mono text-[10px] uppercase tracking-[0.16em] text-paper/45 xl:px-14">
        Para alunos e professores · configuração por perfil
      </p>
    </aside>
  );
}

export function RegistrationShell({
  children,
  contentClassName,
  topAligned = false,
}: {
  children: ReactNode;
  contentClassName?: string;
  topAligned?: boolean;
}) {
  return (
    <div className="grid min-h-dvh bg-paper lg:grid-cols-[minmax(0,1.08fr)_minmax(28rem,0.92fr)]">
      <RegistrationBrandPanel />

      <section
        className={cn(
          "relative flex min-h-dvh justify-center px-5 py-10 sm:px-10 lg:bg-[#fffdf9] xl:px-16",
          topAligned ? "items-start lg:py-14 xl:py-16" : "items-center",
        )}
      >
        <Link href="/" className="absolute left-5 top-5 inline-flex min-h-11 items-center gap-2 text-sm text-ink-muted transition-colors hover:text-ink lg:hidden">
          <ArrowLeft className="size-4" aria-hidden />
          Voltar
        </Link>

        <div className={cn("page-enter w-full max-w-lg", contentClassName)}>
          <Link href="/" className="mb-10 mt-8 inline-flex items-center gap-3 lg:hidden" aria-label="Página inicial do Redator">
            <span className="flex size-9 items-center justify-center border border-ink-line text-accent">
              <PenLine className="size-4" strokeWidth={2.25} aria-hidden />
            </span>
            <span className="font-display text-2xl font-semibold text-ink">Redator</span>
          </Link>
          {children}
        </div>
      </section>
    </div>
  );
}
