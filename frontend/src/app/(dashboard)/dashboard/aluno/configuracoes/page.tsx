"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, User, Lock, CheckCircle } from "lucide-react";
import { api, getApiError } from "@/lib/api/client";
import { useUser } from "@/contexts/UserContext";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  full_name: z
    .string()
    .min(3, "Nome muito curto")
    .refine((v) => v.trim().split(/\s+/).length >= 2, "Digite nome e sobrenome"),
});

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Digite sua senha atual"),
    new_password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Precisa de uma letra maiúscula")
      .regex(/[a-z]/, "Precisa de uma letra minúscula")
      .regex(/\d/, "Precisa de um número"),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "As senhas não coincidem",
    path: ["confirm_password"],
  });

type ProfileData = z.infer<typeof profileSchema>;
type PasswordData = z.infer<typeof passwordSchema>;

// ─── Componente de campo ──────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}

// ─── Seção: Perfil ────────────────────────────────────────────────────────────

function ProfileSection() {
  const { user, refetch } = useUser();
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: user?.full_name ?? "" },
  });

  const onSubmit = async (data: ProfileData) => {
    setSuccess(false);
    try {
      await api.patch("/users/me", { full_name: data.full_name.trim() });
      await refetch();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = getApiError(err).detail;
      setError("root", { message: typeof msg === "string" ? msg : "Erro ao salvar." });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
          <User className="w-5 h-5 text-brand-700" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Informações pessoais</h3>
          <p className="text-xs text-slate-400">Atualize seu nome de exibição</p>
        </div>
      </div>

      {errors.root && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
          {errors.root.message}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-100 text-green-700 text-sm px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> Perfil atualizado!
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Nome completo" error={errors.full_name?.message}>
          <input
            {...register("full_name")}
            type="text"
            autoComplete="name"
            className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors bg-white
              ${errors.full_name
                ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                : "border-slate-200 focus:border-brand-400 focus:ring-brand-50"
              } focus:ring-2`}
          />
        </Field>

        <Field label="Email">
          <input
            value={user?.email ?? ""}
            disabled
            className="w-full px-4 py-2.5 rounded-xl border border-slate-100 text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
          />
          <p className="text-xs text-slate-400 mt-1">O email não pode ser alterado</p>
        </Field>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Salvar alterações
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Seção: Senha ─────────────────────────────────────────────────────────────

function PasswordSection() {
  const [success, setSuccess] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<PasswordData>({
    resolver: zodResolver(passwordSchema),
  });

  const onSubmit = async (data: PasswordData) => {
    setSuccess(false);
    try {
      await api.patch("/users/me", {
        current_password: data.current_password,
        new_password: data.new_password,
      });
      reset();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = getApiError(err).detail;
      setError("root", { message: typeof msg === "string" ? msg : "Erro ao alterar senha." });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
          <Lock className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Alterar senha</h3>
          <p className="text-xs text-slate-400">Mantenha sua conta segura</p>
        </div>
      </div>

      {errors.root && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
          {errors.root.message}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-100 text-green-700 text-sm px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> Senha alterada com sucesso!
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Senha atual" error={errors.current_password?.message}>
          <div className="relative">
            <input
              {...register("current_password")}
              type={showCurrent ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-sm outline-none transition-colors bg-white
                ${errors.current_password
                  ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                  : "border-slate-200 focus:border-brand-400 focus:ring-brand-50"
                } focus:ring-2`}
            />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
              {showCurrent ? "ocultar" : "mostrar"}
            </button>
          </div>
        </Field>

        <Field label="Nova senha" error={errors.new_password?.message}>
          <div className="relative">
            <input
              {...register("new_password")}
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-sm outline-none transition-colors bg-white
                ${errors.new_password
                  ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                  : "border-slate-200 focus:border-brand-400 focus:ring-brand-50"
                } focus:ring-2`}
            />
            <button type="button" onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
              {showNew ? "ocultar" : "mostrar"}
            </button>
          </div>
        </Field>

        <Field label="Confirmar nova senha" error={errors.confirm_password?.message}>
          <input
            {...register("confirm_password")}
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors bg-white
              ${errors.confirm_password
                ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                : "border-slate-200 focus:border-brand-400 focus:ring-brand-50"
              } focus:ring-2`}
          />
        </Field>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Alterar senha
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ConfiguracoesPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="font-display font-bold text-2xl text-slate-900">Configurações</h2>
        <p className="text-slate-500 text-sm mt-0.5">Gerencie seu perfil e preferências</p>
      </div>

      <ProfileSection />
      <PasswordSection />
    </div>
  );
}
