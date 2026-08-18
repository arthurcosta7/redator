"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAxiosError } from "axios";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Loader2,
  MailWarning,
  PenLine,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const EMAIL_NOT_VERIFIED_MSG = "Verifique seu email antes de fazer login.";

const loginSchema = z.object({
  email: z.string().email("Digite um email válido"),
  password: z.string().min(1, "Digite sua senha"),
  remember_me: z.boolean(),
});

type LoginFormData = z.infer<typeof loginSchema>;

function BrandPanel() {
  return (
    <aside className="relative hidden min-h-dvh overflow-hidden bg-ink text-paper lg:flex lg:flex-col lg:justify-between">
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
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 px-2 text-sm text-paper/70 transition-colors hover:text-paper"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Voltar ao site
        </Link>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-2xl px-10 pb-8 xl:px-14">
        <p className="max-w-xl font-display text-4xl font-semibold leading-[1.08] tracking-[-0.02em] xl:text-5xl">
          Continue de onde parou — com cada correção guardada no seu histórico.
        </p>

        <div className="mt-12 rotate-[-1.5deg] border border-paper/20 bg-[#fffaf0] p-7 text-ink shadow-[0_24px_70px_rgba(0,0,0,.28)] xl:p-9">
          <div className="flex items-center justify-between border-b border-ink/15 pb-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">Última correção</p>
              <p className="mt-1 font-display text-xl font-semibold">Desafios da educação brasileira</p>
            </div>
            <p className="font-display text-4xl font-semibold text-accent">760</p>
          </div>
          <div className="caderno mt-5 px-3 py-2 font-display text-[15px] leading-8 text-ink-soft">
            <p>
              Segundo dados do <span className="bg-[var(--good-bg)] px-1 text-[var(--good-fg)]">IBGE (2023)</span>, o acesso à educação ainda revela desigualdades profundas. Por isso, políticas públicas precisam considerar a realidade de cada região.
            </p>
          </div>
          <div className="mt-5 flex items-center gap-2 text-sm text-[var(--good-fg)]">
            <Check className="size-4" strokeWidth={2.5} aria-hidden />
            Repertório pertinente e bem conectado ao argumento
          </div>
        </div>
      </div>

      <p className="relative z-10 px-10 py-8 font-mono text-[10px] uppercase tracking-[0.16em] text-paper/45 xl:px-14">
        Correção por competência · histórico de evolução · feedback no texto
      </p>
    </aside>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember_me: false },
  });

  const redirect = searchParams.get("redirect");
  const registerHref = redirect
    ? `/auth/register/aluno?redirect=${encodeURIComponent(redirect)}`
    : "/auth/register";

  const onSubmit = async (data: LoginFormData) => {
    try {
      const res = await api.post<{ user_type: string }>("/auth/login", data);

      if (redirect && redirect.startsWith("/")) {
        router.push(redirect);
      } else if (res.data.user_type === "teacher") {
        router.push("/dashboard/professor");
      } else {
        router.push("/dashboard/aluno");
      }
    } catch (error: unknown) {
      const detail = isAxiosError(error) ? error.response?.data?.detail : undefined;
      setError("root", {
        message: typeof detail === "string"
          ? detail
          : "Não foi possível entrar. Confira seus dados e tente novamente.",
      });
    }
  };

  return (
    <div className="grid min-h-dvh bg-paper lg:grid-cols-[minmax(0,1.08fr)_minmax(28rem,0.92fr)]">
      <BrandPanel />

      <section className="relative flex min-h-dvh items-center justify-center px-5 py-10 sm:px-10 lg:bg-[#fffdf9] xl:px-16">
        <Link
          href="/"
          className="absolute left-5 top-5 inline-flex min-h-11 items-center gap-2 text-sm text-ink-muted transition-colors hover:text-ink lg:hidden"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Voltar
        </Link>

        <div className="page-enter w-full max-w-md">
          <Link href="/" className="mb-10 mt-8 inline-flex items-center gap-3 lg:hidden" aria-label="Página inicial do Redator">
            <span className="flex size-9 items-center justify-center border border-ink-line text-accent">
              <PenLine className="size-4" strokeWidth={2.25} aria-hidden />
            </span>
            <span className="font-display text-2xl font-semibold text-ink">Redator</span>
          </Link>

          <header>
            <h1 className="font-display text-4xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-5xl">
              Bem-vindo de volta.
            </h1>
            <p className="mt-3 text-base leading-relaxed text-ink-muted">
              Ainda não tem uma conta?{" "}
              <Link href={registerHref} className="link-underline font-semibold text-accent hover:text-accent-deep">
                Comece grátis
              </Link>
            </p>
          </header>

          {errors.root && (
            errors.root.message === EMAIL_NOT_VERIFIED_MSG ? (
              <div role="alert" className="mt-7 border border-amber-300 bg-amber-50 px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <MailWarning className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Email ainda não verificado</p>
                    <p className="mt-1 text-sm leading-relaxed text-amber-800">
                      Confira sua caixa de entrada ou{" "}
                      <Link href="/auth/resend-verification" className="font-semibold underline underline-offset-2 hover:text-amber-950">
                        solicite um novo link
                      </Link>.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div role="alert" className="mt-7 border border-red-300 bg-red-50 px-4 py-3.5 text-sm leading-relaxed text-red-800">
                {errors.root.message}
              </div>
            )
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6" noValidate>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-ink-soft">Email</label>
              <input
                {...register("email")}
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="seu@email.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={cn(
                  "min-h-12 w-full border bg-transparent px-4 text-base text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/60",
                  errors.email
                    ? "border-red-400 focus:border-red-600 focus:ring-2 focus:ring-red-100"
                    : "border-ink-line focus:border-accent focus:ring-2 focus:ring-accent/10"
                )}
              />
              {errors.email && <p id="email-error" className="mt-2 text-sm text-red-700">{errors.email.message}</p>}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-4">
                <label htmlFor="password" className="text-sm font-semibold text-ink-soft">Senha</label>
                <Link href="/auth/forgot-password" className="link-underline text-sm font-medium text-accent hover:text-accent-deep">
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <input
                  {...register("password")}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  className={cn(
                    "min-h-12 w-full border bg-transparent px-4 pr-14 text-base text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/60",
                    errors.password
                      ? "border-red-400 focus:border-red-600 focus:ring-2 focus:ring-red-100"
                      : "border-ink-line focus:border-accent focus:ring-2 focus:ring-accent/10"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-ink-muted transition-colors hover:text-ink"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
                </button>
              </div>
              {errors.password && <p id="password-error" className="mt-2 text-sm text-red-700">{errors.password.message}</p>}
            </div>

            <label htmlFor="remember_me" className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink-soft">
              <input
                {...register("remember_me")}
                type="checkbox"
                id="remember_me"
                className="size-4 border-ink-line accent-accent focus:ring-accent"
              />
              Manter minha sessão por 7 dias
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-ink px-5 font-semibold text-paper transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Entrando…
                </>
              ) : (
                "Entrar na minha conta"
              )}
            </button>
          </form>

          <p className="mt-8 border-t border-ink-line pt-5 text-sm leading-relaxed text-ink-muted">
            Ao entrar, você acessa suas correções, turmas e histórico no mesmo lugar.
          </p>
        </div>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-paper">
          <Loader2 className="size-6 animate-spin text-accent" aria-label="Carregando login" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
