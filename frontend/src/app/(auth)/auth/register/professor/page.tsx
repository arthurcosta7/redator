"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";

import {
  RegistrationField,
  RegistrationPasswordField,
  registrationInputClassName,
} from "@/components/auth/registration-fields";
import { RegistrationShell } from "@/components/auth/registration-shell";
import { api, getApiError } from "@/lib/api/client";

const teacherSchema = z.object({
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
    .regex(/\d/, "Precisa de pelo menos um número"),
  confirm_password: z.string(),
  school_name: z.string().max(200).optional(),
  discipline: z.string().max(100).optional(),
  terms: z.boolean().refine(Boolean, "Aceite os termos para continuar"),
}).refine(
  (data) => data.password === data.confirm_password,
  { message: "As senhas não coincidem", path: ["confirm_password"] },
);

type TeacherFormData = z.infer<typeof teacherSchema>;

export default function RegisterTeacherPage() {
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<TeacherFormData>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      full_name: "",
      email: "",
      school_name: "",
      discipline: "",
      password: "",
      confirm_password: "",
      terms: false,
    },
  });

  const onSubmit = async (data: TeacherFormData) => {
    try {
      await api.post("/auth/register/teacher", {
        full_name: data.full_name.trim(),
        email: data.email.toLowerCase(),
        password: data.password,
        school_name: data.school_name || null,
        discipline: data.discipline || null,
      });
      setSuccess(true);
    } catch (error: unknown) {
      const message = getApiError(error).detail;
      setError("root", {
        message: typeof message === "string" ? message : "Erro ao criar conta. Tente novamente.",
      });
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
            Enviamos um link de confirmação. Abra o email para ativar sua conta de professor e acessar suas turmas.
          </p>
          <Link href="/auth/login" className="mt-7 inline-flex min-h-12 items-center justify-center bg-ink px-6 font-semibold text-paper transition-colors hover:bg-ink-soft">
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
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-5xl">Crie sua conta de professor.</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-muted">
          Organize turmas e acompanhe a evolução dos alunos. Já tem uma conta?{" "}
          <Link href="/auth/login" className="link-underline font-semibold text-accent hover:text-accent-deep">Entrar</Link>
        </p>
      </header>

      {errors.root && (
        <div role="alert" className="mt-7 border border-red-300 bg-red-50 px-4 py-3.5 text-sm leading-relaxed text-red-800">
          {errors.root.message}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
        <RegistrationField id="teacher-full-name" label="Nome completo" error={errors.full_name}>
          <input
            {...register("full_name")}
            id="teacher-full-name"
            type="text"
            autoComplete="name"
            placeholder="Maria da Silva"
            aria-invalid={Boolean(errors.full_name)}
            aria-describedby={errors.full_name ? "teacher-full-name-error" : undefined}
            className={registrationInputClassName(Boolean(errors.full_name))}
          />
        </RegistrationField>

        <RegistrationField id="teacher-email" label="Email" error={errors.email}>
          <input
            {...register("email")}
            id="teacher-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="professor@escola.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "teacher-email-error" : undefined}
            className={registrationInputClassName(Boolean(errors.email))}
          />
        </RegistrationField>

        <RegistrationField id="teacher-school" label="Escola / Instituição" optional error={errors.school_name}>
          <input
            {...register("school_name")}
            id="teacher-school"
            type="text"
            autoComplete="organization"
            placeholder="Ex.: Colégio Estadual Central"
            aria-invalid={Boolean(errors.school_name)}
            aria-describedby={errors.school_name ? "teacher-school-error" : undefined}
            className={registrationInputClassName(Boolean(errors.school_name))}
          />
        </RegistrationField>

        <RegistrationField id="teacher-discipline" label="Disciplina" optional error={errors.discipline}>
          <input
            {...register("discipline")}
            id="teacher-discipline"
            type="text"
            autoComplete="off"
            placeholder="Ex.: Língua Portuguesa ou Redação"
            aria-invalid={Boolean(errors.discipline)}
            aria-describedby={errors.discipline ? "teacher-discipline-error" : undefined}
            className={registrationInputClassName(Boolean(errors.discipline))}
          />
        </RegistrationField>

        <RegistrationPasswordField
          registration={register("password")}
          id="teacher-password"
          label="Senha"
          autoComplete="new-password"
          error={errors.password}
        />

        <RegistrationPasswordField
          registration={register("confirm_password")}
          id="teacher-confirm-password"
          label="Confirmar senha"
          autoComplete="new-password"
          error={errors.confirm_password}
        />

        <div>
          <div className="flex items-start gap-3">
            <input
              {...register("terms")}
              type="checkbox"
              id="teacher-terms"
              aria-invalid={Boolean(errors.terms)}
              aria-describedby={errors.terms ? "teacher-terms-error" : undefined}
              className="mt-1 size-4 shrink-0 cursor-pointer border-ink-line accent-accent focus:ring-accent"
            />
            <label htmlFor="teacher-terms" className="cursor-pointer text-sm leading-relaxed text-ink-soft">
              Li e aceito os <Link href="/terms" className="font-semibold text-accent hover:text-accent-deep">Termos de Uso</Link> e a{" "}
              <Link href="/privacy" className="font-semibold text-accent hover:text-accent-deep">Política de Privacidade</Link>.
            </label>
          </div>
          {errors.terms && <p id="teacher-terms-error" className="mt-2 text-sm text-red-700">{errors.terms.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-ink px-5 font-semibold text-paper transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? <><Loader2 className="size-4 animate-spin" aria-hidden />Criando conta…</> : "Criar conta de professor"}
        </button>
      </form>
    </RegistrationShell>
  );
}
