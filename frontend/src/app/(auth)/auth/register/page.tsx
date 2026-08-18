import Link from "next/link";
import { ArrowRight, BookOpen, GraduationCap } from "lucide-react";

import { RegistrationShell } from "@/components/auth/registration-shell";

export default function RegisterTypePage() {
  return (
    <RegistrationShell contentClassName="max-w-md">
      <header>
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-5xl">
          Como você vai usar o Redator?
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ink-muted">
          Escolha seu perfil. Os recursos e o painel serão preparados para a sua rotina.
        </p>
      </header>

      <div className="mt-8 space-y-3">
          <Link
            href="/auth/register/aluno"
            className="group flex min-h-28 items-center gap-5 border border-ink-line bg-transparent p-5 transition-[border-color,background-color] hover:border-accent hover:bg-accent-50"
          >
            <span className="flex size-12 shrink-0 items-center justify-center border border-accent/25 bg-accent-50 text-accent">
              <GraduationCap className="size-6" strokeWidth={1.8} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-semibold text-ink">Sou aluno</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">Quero corrigir redações e acompanhar minha evolução.</p>
            </div>
            <ArrowRight className="size-5 shrink-0 text-ink-muted transition-transform group-hover:translate-x-1 group-hover:text-accent" aria-hidden />
          </Link>

          <Link
            href="/auth/register/professor"
            className="group flex min-h-28 items-center gap-5 border border-ink-line bg-transparent p-5 transition-[border-color,background-color] hover:border-accent hover:bg-accent-50"
          >
            <span className="flex size-12 shrink-0 items-center justify-center border border-accent/25 bg-accent-50 text-accent">
              <BookOpen className="size-6" strokeWidth={1.8} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-semibold text-ink">Sou professor</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">Quero organizar turmas e acompanhar meus alunos.</p>
            </div>
            <ArrowRight className="size-5 shrink-0 text-ink-muted transition-transform group-hover:translate-x-1 group-hover:text-accent" aria-hidden />
          </Link>
      </div>

      <p className="mt-8 border-t border-ink-line pt-5 text-sm text-ink-muted">
        Já tem uma conta?{" "}
        <Link href="/auth/login" className="link-underline font-semibold text-accent hover:text-accent-deep">Entrar</Link>
      </p>
    </RegistrationShell>
  );
}
