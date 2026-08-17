"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, PenLine, MailWarning } from "lucide-react";
import { api } from "@/lib/api/client";

const EMAIL_NOT_VERIFIED_MSG = "Verifique seu email antes de fazer login.";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Digite sua senha"),
  // Sem .default() para evitar conflito de tipos com @hookform/resolvers v5
  // O default é definido no useForm({ defaultValues })
  remember_me: z.boolean(),
});

type LoginFormData = z.infer<typeof loginSchema>;

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
    defaultValues: { remember_me: false },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      const res = await api.post<{ user_type: string }>("/auth/login", data);
      // Redireciona para a URL de retorno ou para o dashboard padrão
      const redirect = searchParams.get("redirect");
      if (redirect && redirect.startsWith("/")) {
        router.push(redirect);
      } else if (res.data.user_type === "teacher") {
        router.push("/dashboard/professor");
      } else {
        router.push("/dashboard/aluno");
      }
    } catch (err: any) {
      const message = err?.response?.data?.detail;
      setError("root", {
        message: typeof message === "string"
          ? message
          : "Erro ao fazer login. Tente novamente.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-8 group">
        <div className="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center">
          <PenLine className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="font-display font-bold text-xl text-slate-900">Redator</span>
      </Link>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-8
                      w-full max-w-md">
        <div className="mb-6">
          <h1 className="font-display font-bold text-2xl text-slate-900 mb-1">
            Entrar na sua conta
          </h1>
          <p className="text-sm text-slate-400">
            Bem-vindo de volta ao Redator
          </p>
        </div>

        {/* Erro global */}
        {errors.root && (
          errors.root.message === EMAIL_NOT_VERIFIED_MSG ? (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-5">
              <div className="flex items-start gap-3">
                <MailWarning className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-800 font-medium">
                    Email não verificado
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Verifique sua caixa de entrada ou{" "}
                    <Link
                      href="/auth/resend-verification"
                      className="font-semibold underline hover:text-amber-900"
                    >
                      solicite um novo link
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm
                            px-4 py-3 rounded-xl mb-5">
              {errors.root.message}
            </div>
          )
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email
            </label>
            <input
              {...register("email")}
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none
                          transition-colors bg-white placeholder:text-slate-300
                          ${errors.email
                            ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                            : "border-slate-200 focus:border-brand-400 focus:ring-brand-50"
                          } focus:ring-2`}
            />
            {errors.email && (
              <p className="text-xs text-red-600 mt-1.5">{errors.email.message}</p>
            )}
          </div>

          {/* Senha */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Senha
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-xs text-brand-700 hover:text-brand-800 font-medium"
              >
                Esqueceu a senha?
              </Link>
            </div>
            <div className="relative">
              <input
                {...register("password")}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className={`w-full px-4 py-2.5 pr-11 rounded-xl border text-sm outline-none
                            transition-colors bg-white placeholder:text-slate-300
                            ${errors.password
                              ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                              : "border-slate-200 focus:border-brand-400 focus:ring-brand-50"
                            } focus:ring-2`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400
                           hover:text-slate-600 transition-colors"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-600 mt-1.5">{errors.password.message}</p>
            )}
          </div>

          {/* Lembrar de mim */}
          <div className="flex items-center gap-2">
            <input
              {...register("remember_me")}
              type="checkbox"
              id="remember_me"
              className="w-4 h-4 rounded border-slate-300 text-brand-600
                         focus:ring-brand-500 cursor-pointer"
            />
            <label htmlFor="remember_me" className="text-sm text-slate-600 cursor-pointer">
              Lembrar de mim por 7 dias
            </label>
          </div>

          {/* Submit */}
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
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-5">
          Não tem conta?{" "}
          <Link
            href={searchParams.get("redirect")
              ? `/auth/register/aluno?redirect=${encodeURIComponent(searchParams.get("redirect")!)}`
              : "/auth/register"
            }
            className="text-brand-700 font-medium hover:text-brand-800"
          >
            Criar conta grátis
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
