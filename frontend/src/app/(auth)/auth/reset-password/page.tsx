"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, PenLine, CheckCircle2, AlertCircle } from "lucide-react";
import { api, getApiError } from "@/lib/api/client";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Precisa de pelo menos uma letra maiúscula")
      .regex(/[a-z]/, "Precisa de pelo menos uma letra minúscula")
      .regex(/\d/, "Precisa de pelo menos um número"),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "As senhas não coincidem",
    path: ["confirm_password"],
  });

type FormData = z.infer<typeof schema>;

// ─── Componente interno que usa useSearchParams ───────────────────────────────
// Separado porque useSearchParams exige Suspense no Next.js 15

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Token ausente na URL
  if (!token) {
    return (
      <div className="bg-white rounded-2xl border border-red-100 shadow-card p-10 w-full max-w-md text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
        <h2 className="font-display font-bold text-xl text-slate-900 mb-2">
          Link inválido
        </h2>
        <p className="text-slate-500 text-sm">
          Este link de redefinição é inválido ou está incompleto.
        </p>
        <Link
          href="/auth/forgot-password"
          className="mt-5 inline-block text-brand-700 font-semibold text-sm hover:text-brand-800"
        >
          Solicitar novo link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 w-full max-w-md text-center">
        <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="font-display font-bold text-2xl text-slate-900 mb-3">
          Senha redefinida!
        </h2>
        <p className="text-slate-500 text-sm leading-relaxed">
          Sua senha foi alterada com sucesso. Faça login com sua nova senha.
        </p>
        <Link
          href="/auth/login"
          className="inline-block mt-6 bg-brand-700 text-white font-semibold px-6 py-2.5
                     rounded-xl hover:bg-brand-800 transition-colors text-sm"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  const onSubmit = async (data: FormData) => {
    try {
      await api.post("/auth/reset-password", {
        token,
        new_password: data.password,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = getApiError(err).detail;
      if (typeof msg === "string" && msg.toLowerCase().includes("expirado")) {
        setError("root", {
          message: "Este link expirou. Solicite um novo link de redefinição.",
        });
      } else {
        setError("root", {
          message:
            typeof msg === "string"
              ? msg
              : "Erro ao redefinir senha. O link pode ter expirado.",
        });
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-8 w-full max-w-md">
      <div className="mb-6">
        <h1 className="font-display font-bold text-xl text-slate-900">
          Nova senha
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Defina sua nova senha de acesso
        </p>
      </div>

      {errors.root && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm
                        px-4 py-3 rounded-xl mb-5 flex gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p>{errors.root.message}</p>
            {errors.root.message?.includes("expirou") && (
              <Link
                href="/auth/forgot-password"
                className="text-red-700 underline font-medium text-xs mt-1 block"
              >
                Solicitar novo link →
              </Link>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Nova senha */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Nova senha
          </label>
          <div className="relative">
            <input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              className={`w-full px-4 py-2.5 pr-11 rounded-xl border text-sm outline-none
                          transition-colors bg-white placeholder:text-slate-300
                          ${
                            errors.password
                              ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                              : "border-slate-200 focus:border-brand-400 focus:ring-brand-50"
                          } focus:ring-2`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-red-600 mt-1.5">{errors.password.message}</p>
          )}
        </div>

        {/* Confirmar senha */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Confirmar nova senha
          </label>
          <div className="relative">
            <input
              {...register("confirm_password")}
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              className={`w-full px-4 py-2.5 pr-11 rounded-xl border text-sm outline-none
                          transition-colors bg-white placeholder:text-slate-300
                          ${
                            errors.confirm_password
                              ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                              : "border-slate-200 focus:border-brand-400 focus:ring-brand-50"
                          } focus:ring-2`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showConfirm ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.confirm_password && (
            <p className="text-xs text-red-600 mt-1.5">
              {errors.confirm_password.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-brand-700 hover:bg-brand-800 disabled:opacity-60
                     text-white font-semibold py-3 rounded-xl transition-colors
                     flex items-center justify-center gap-2 mt-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Redefinindo…
            </>
          ) : (
            "Redefinir senha"
          )}
        </button>
      </form>
    </div>
  );
}

// ─── Page — envolve o form em Suspense (obrigatório para useSearchParams) ─────

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <div className="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center">
          <PenLine className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="font-display font-bold text-xl text-slate-900">Redator</span>
      </Link>

      <Suspense
        fallback={
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-8 w-full max-w-md flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
