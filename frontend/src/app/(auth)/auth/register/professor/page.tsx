"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, PenLine, ArrowLeft } from "lucide-react";
import { api, getApiError } from "@/lib/api/client";

const teacherSchema = z.object({
  full_name: z
    .string()
    .min(3, "Nome muito curto")
    .refine((v) => v.trim().split(/\s+/).length >= 2, "Digite nome e sobrenome"),
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
  { message: "As senhas não coincidem", path: ["confirm_password"] }
);

type TeacherFormData = z.infer<typeof teacherSchema>;

export default function RegisterTeacherPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<TeacherFormData>({
    resolver: zodResolver(teacherSchema),
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
    } catch (err: unknown) {
      const message = getApiError(err).detail;
      setError("root", {
        message: typeof message === "string"
          ? message
          : "Erro ao criar conta. Tente novamente.",
      });
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10
                        w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <span className="text-3xl">✉️</span>
          </div>
          <h2 className="font-display font-bold text-2xl text-slate-900 mb-3">
            Verifique seu email!
          </h2>
          <p className="text-slate-500 leading-relaxed">
            Enviamos um link de confirmação. Clique nele para ativar sua conta de professor.
          </p>
          <Link
            href="/auth/login"
            className="inline-block mt-6 text-brand-700 font-semibold hover:text-brand-800"
          >
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <div className="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center">
          <PenLine className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="font-display font-bold text-xl text-slate-900">Redator</span>
      </Link>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/auth/register"
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-display font-bold text-xl text-slate-900">
              Criar conta de professor
            </h1>
            <p className="text-sm text-slate-400">Acompanhe suas turmas e alunos</p>
          </div>
        </div>

        {errors.root && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl mb-5">
            {errors.root.message}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Nome completo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nome completo
            </label>
            <input
              {...register("full_name")}
              type="text"
              autoComplete="name"
              placeholder="Maria da Silva"
              className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors
                bg-white placeholder:text-slate-300
                ${errors.full_name
                  ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                  : "border-slate-200 focus:border-brand-400 focus:ring-brand-50"
                } focus:ring-2`}
            />
            {errors.full_name && (
              <p className="text-xs text-red-600 mt-1.5">{errors.full_name.message}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input
              {...register("email")}
              type="email"
              autoComplete="email"
              placeholder="professor@escola.com"
              className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors
                bg-white placeholder:text-slate-300
                ${errors.email
                  ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                  : "border-slate-200 focus:border-brand-400 focus:ring-brand-50"
                } focus:ring-2`}
            />
            {errors.email && (
              <p className="text-xs text-red-600 mt-1.5">{errors.email.message}</p>
            )}
          </div>

          {/* Escola (opcional) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Escola / Instituição <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              {...register("school_name")}
              type="text"
              placeholder="Ex: Colégio Estadual Central"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                         outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-50
                         transition-colors bg-white placeholder:text-slate-300"
            />
          </div>

          {/* Disciplina (opcional) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Disciplina <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              {...register("discipline")}
              type="text"
              placeholder="Ex: Língua Portuguesa, Redação"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                         outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-50
                         transition-colors bg-white placeholder:text-slate-300"
            />
          </div>

          {/* Senha */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Senha</label>
            <div className="relative">
              <input
                {...register("password")}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                className={`w-full px-4 py-2.5 pr-11 rounded-xl border text-sm outline-none
                  transition-colors bg-white placeholder:text-slate-300
                  ${errors.password
                    ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                    : "border-slate-200 focus:border-brand-400 focus:ring-brand-50"
                  } focus:ring-2`}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-600 mt-1.5">{errors.password.message}</p>
            )}
          </div>

          {/* Confirmar senha */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Confirmar senha
            </label>
            <div className="relative">
              <input
                {...register("confirm_password")}
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                className={`w-full px-4 py-2.5 pr-11 rounded-xl border text-sm outline-none
                  transition-colors bg-white placeholder:text-slate-300
                  ${errors.confirm_password
                    ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                    : "border-slate-200 focus:border-brand-400 focus:ring-brand-50"
                  } focus:ring-2`}
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirm_password && (
              <p className="text-xs text-red-600 mt-1.5">{errors.confirm_password.message}</p>
            )}
          </div>

          {/* Termos */}
          <div className="flex items-start gap-3">
            <input
              {...register("terms")}
              type="checkbox"
              id="terms"
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand-600
                         focus:ring-brand-500 cursor-pointer"
            />
            <label htmlFor="terms" className="text-sm text-slate-600 cursor-pointer leading-relaxed">
              Li e aceito os{" "}
              <Link href="/terms" className="text-brand-700 hover:underline font-medium">Termos de Uso</Link>
              {" "}e a{" "}
              <Link href="/privacy" className="text-brand-700 hover:underline font-medium">Política de Privacidade</Link>
            </label>
          </div>
          {errors.terms && (
            <p className="text-xs text-red-600 -mt-2">{errors.terms.message}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-700 hover:bg-brand-800 disabled:opacity-60
                       text-white font-semibold py-3 rounded-xl transition-colors
                       flex items-center justify-center gap-2 mt-2"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Criando conta...</>
            ) : (
              "Criar conta de professor"
            )}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-5">
          Já tem conta?{" "}
          <Link href="/auth/login" className="text-brand-700 font-medium hover:text-brand-800">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
