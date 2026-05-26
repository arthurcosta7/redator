"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, PenLine, Mail } from "lucide-react";
import { api } from "@/lib/api/client";

const schema = z.object({
  email: z.string().email("Email inválido"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await api.post("/auth/forgot-password", { email: data.email });
    } catch {
      // SEGURANÇA: Sempre mostramos a mesma mensagem independente do resultado
      // para evitar enumerar quais emails estão cadastrados.
    } finally {
      // Sempre exibimos a tela de sucesso (proteção contra enumeração de emails)
      setSubmittedEmail(data.email);
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10
                        w-full max-w-md text-center">
          <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Mail className="w-7 h-7 text-brand-600" />
          </div>
          <h2 className="font-display font-bold text-2xl text-slate-900 mb-3">
            Verifique seu email
          </h2>
          <p className="text-slate-500 leading-relaxed text-sm">
            Se existe uma conta associada a{" "}
            <span className="font-medium text-slate-700">{submittedEmail}</span>,
            você receberá um link para redefinir sua senha em breve.
          </p>
          <p className="text-xs text-slate-400 mt-4">
            O link expira em 1 hora. Verifique também a pasta de spam.
          </p>
          <Link
            href="/auth/login"
            className="inline-block mt-6 text-brand-700 font-semibold hover:text-brand-800 text-sm"
          >
            Voltar para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <div className="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center">
          <PenLine className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="font-display font-bold text-xl text-slate-900">Redator</span>
      </Link>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-8 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/auth/login"
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-display font-bold text-xl text-slate-900">
              Esqueceu a senha?
            </h1>
            <p className="text-sm text-slate-400">Enviaremos um link de redefinição</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email da sua conta
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
                Enviando…
              </>
            ) : (
              "Enviar link de redefinição"
            )}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-5">
          Lembrou a senha?{" "}
          <Link href="/auth/login" className="text-brand-700 font-medium hover:text-brand-800">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
