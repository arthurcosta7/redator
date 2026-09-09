"use client";

/** Cadastro de aluno com validação equivalente às regras públicas do backend. */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Check, Circle, Loader2, MailCheck } from "lucide-react";

import {
  RegistrationField,
  RegistrationPasswordField,
  registrationInputClassName,
} from "@/components/auth/registration-fields";
import { RegistrationShell } from "@/components/auth/registration-shell";
import { api, getApiError } from "@/lib/api/client";

const studentSchema = z.object({
  full_name: z
    .string()
    .min(3, "Nome muito curto")
    .refine((value) => value.trim().split(/\s+/).length >= 2, "Digite nome e sobrenome"),
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Precisa de pelo menos uma letra maiúscula")
    .regex(/[a-z]/, "Precisa de pelo menos uma letra minúscula")
    .regex(/\d/, "Precisa de pelo menos um número")
    .regex(/[^\p{L}\p{N}\s]/u, "Precisa de pelo menos um caractere especial"),
  confirm_password: z.string(),
  grade: z.string().optional(),
  terms: z.boolean().refine(Boolean, "Aceite os termos para continuar"),
}).refine(
  (data) => data.password === data.confirm_password,
  { message: "As senhas não coincidem", path: ["confirm_password"] },
);

type StudentFormData = z.infer<typeof studentSchema>;

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ caracteres", pass: password.length >= 8 },
    { label: "Maiúscula", pass: /[A-Z]/.test(password) },
    { label: "Minúscula", pass: /[a-z]/.test(password) },
    { label: "Número", pass: /\d/.test(password) },
    { label: "Caractere especial", pass: /[^\p{L}\p{N}\s]/u.test(password) },
  ];
  const strength = checks.filter((check) => check.pass).length;

  if (!password) return null;

  return (
    <div className="mt-3" aria-label={`${strength} de 5 requisitos de senha atendidos`}>
      <div className="flex gap-1.5" aria-hidden>
        {checks.map((check) => (
          <span key={check.label} className={`h-1 flex-1 ${check.pass ? "bg-accent" : "bg-ink/10"}`} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
        {checks.map((check) => {
          const Icon = check.pass ? Check : Circle;
          return (
            <span key={check.label} className={`flex items-center gap-1.5 text-xs ${check.pass ? "text-[var(--good-fg)]" : "text-ink-muted"}`}>
              <Icon className="size-3.5" strokeWidth={check.pass ? 2.5 : 1.75} aria-hidden />
              {check.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function RegisterStudentForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  // O destino é apenas repassado ao login, que decide se deve navegar até ele.
  const loginHref = redirect ? `/auth/login?redirect=${encodeURIComponent(redirect)}` : "/auth/login";
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: { full_name: "", email: "", grade: "", password: "", confirm_password: "", terms: false },
  });

  const password = watch("password", "");

  const onSubmit = async (data: StudentFormData) => {
    try {
      await api.post("/auth/register/student", {
        // confirm_password e terms são controles locais e não pertencem ao
        // contrato persistido da API.
        full_name: data.full_name.trim(),
        email: data.email.toLowerCase(),
        password: data.password,
        grade: data.grade || null,
      });
      setSuccess(true);
    } catch (error: unknown) {
      const { detail: message, errors: fieldErrors } = getApiError(error);
      if (typeof message === "string") {
        setError("root", { message });
      } else if (fieldErrors.length > 0) {
        fieldErrors.forEach((fieldError) => {
          setError(fieldError.field as keyof StudentFormData, { message: fieldError.message });
        });
      } else {
        setError("root", { message: "Erro ao criar conta. Tente novamente." });
      }
    }
  };

  if (success) {
    return (
      <RegistrationShell contentClassName="max-w-md">
        <div className="border border-ink-line bg-paper p-7 text-center sm:p-9">
          <span className="mx-auto flex size-14 items-center justify-center bg-[var(--good-bg)] text-[var(--good-fg)]">
            <MailCheck className="size-7" strokeWidth={2} aria-hidden />
          </span>
          <h1 className="mt-6 font-display text-3xl font-semibold text-ink">Verifique seu email.</h1>
          <p className="mt-3 leading-relaxed text-ink-muted">
            Enviamos um link de confirmação. Abra o email para ativar sua conta de aluno e começar a usar o Redator.
          </p>
          <Link href={loginHref} className="mt-7 inline-flex min-h-12 items-center justify-center bg-ink px-6 font-semibold text-paper transition-colors hover:bg-ink-soft">
            Ir para o login
          </Link>
        </div>
      </RegistrationShell>
    );
  }

  return (
    <RegistrationShell topAligned>
      <Link href="/auth/register" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Escolher outro perfil
      </Link>

      <header>
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-5xl">Crie sua conta de aluno.</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-muted">
          Comece gratuitamente, sem cartão. Já tem uma conta?{" "}
          <Link href={loginHref} className="link-underline font-semibold text-accent hover:text-accent-deep">Entrar</Link>
        </p>
      </header>

      {errors.root && (
        <div role="alert" className="mt-7 border border-red-300 bg-red-50 px-4 py-3.5 text-sm leading-relaxed text-red-800">
          {errors.root.message}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
        <RegistrationField id="student-full-name" label="Nome completo" error={errors.full_name}>
          <input
            {...register("full_name")}
            id="student-full-name"
            type="text"
            autoComplete="name"
            placeholder="João da Silva"
            aria-invalid={Boolean(errors.full_name)}
            aria-describedby={errors.full_name ? "student-full-name-error" : undefined}
            className={registrationInputClassName(Boolean(errors.full_name))}
          />
        </RegistrationField>

        <RegistrationField id="student-email" label="Email" error={errors.email}>
          <input
            {...register("email")}
            id="student-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="joao@email.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "student-email-error" : undefined}
            className={registrationInputClassName(Boolean(errors.email))}
          />
        </RegistrationField>

        <RegistrationField id="student-grade" label="Série / Ano" optional>
          <input
            {...register("grade")}
            id="student-grade"
            type="text"
            autoComplete="off"
            placeholder="Ex.: 3º ano EM ou 1º ano de cursinho"
            className={registrationInputClassName()}
          />
        </RegistrationField>

        <div>
          <RegistrationPasswordField
            registration={register("password")}
            id="student-password"
            label="Senha"
            autoComplete="new-password"
            error={errors.password}
          />
          <PasswordStrength password={password} />
        </div>

        <RegistrationPasswordField
          registration={register("confirm_password")}
          id="student-confirm-password"
          label="Confirmar senha"
          autoComplete="new-password"
          error={errors.confirm_password}
        />

        <div>
          <div className="flex items-start gap-3">
            <input
              {...register("terms")}
              type="checkbox"
              id="student-terms"
              aria-invalid={Boolean(errors.terms)}
              aria-describedby={errors.terms ? "student-terms-error" : undefined}
              className="mt-1 size-4 shrink-0 cursor-pointer border-ink-line accent-accent focus:ring-accent"
            />
            <label htmlFor="student-terms" className="cursor-pointer text-sm leading-relaxed text-ink-soft">
              Li e aceito os <Link href="/terms" className="font-semibold text-accent hover:text-accent-deep">Termos de Uso</Link> e a{" "}
              <Link href="/privacy" className="font-semibold text-accent hover:text-accent-deep">Política de Privacidade</Link>.
            </label>
          </div>
          {errors.terms && <p id="student-terms-error" className="mt-2 text-sm text-red-700">{errors.terms.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-ink px-5 font-semibold text-paper transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? <><Loader2 className="size-4 animate-spin" aria-hidden />Criando conta…</> : "Criar conta grátis"}
        </button>
      </form>
    </RegistrationShell>
  );
}

export default function RegisterStudentPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center bg-paper"><Loader2 className="size-6 animate-spin text-accent" aria-label="Carregando cadastro" /></div>}>
      <RegisterStudentForm />
    </Suspense>
  );
}
