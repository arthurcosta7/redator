"use client";

import { useEffect, useState } from "react";
import {
  Users,
  GraduationCap,
  Check,
  CreditCard,
  Loader2,
  Zap,
  BookOpen,
  ClipboardList,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useUser } from "@/contexts/UserContext";
import { PLAN_LABELS } from "@/types/user";

interface SlotInfo {
  slots_total: number;
  slots_used: number;
  slots_free_per_turma: number;
  is_paid: boolean;
}

// ─── Barra de slots ───────────────────────────────────────────────────────────

function SlotBar({ used, total }: { used: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.min((used / total) * 100, 100);
  const color = pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-amber-400" : "bg-brand-500";
  return (
    <div className="space-y-1">
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full w-full origin-left ${color} rounded-full`} style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <p className="text-xs text-slate-400">{used} de {total} slots usados</p>
    </div>
  );
}

// ─── Features do plano de professor ──────────────────────────────────────────

const FREE_FEATURES = [
  { icon: Users,         label: "Turmas ilimitadas" },
  { icon: ClipboardList, label: "Tarefas com tema e prazos" },
  { icon: Sparkles,      label: "Geração de temas por IA (Haiku)" },
  { icon: BookOpen,      label: "Correção automática das entregas" },
  { icon: BarChart3,     label: "Analytics geral por turma e aluno" },
];

const PAID_ONLY_FEATURES = [
  { icon: BarChart3, label: "Insights detalhados por tarefa — distribuição de notas, média por competência e ranking dos alunos em cada entrega" },
];

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ProfessorPlanoPage() {
  const { user } = useUser();
  const [slots, setSlots] = useState<SlotInfo | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(true);

  useEffect(() => {
    api
      .get<SlotInfo>("/professor/slots")
      .then((r) => setSlots(r.data))
      .catch(() => {})
      .finally(() => setLoadingSlots(false));
  }, []);

  const freeLimit = slots?.slots_free_per_turma ?? 3;
  const isPaid = slots?.is_paid ?? false;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-display font-bold text-2xl text-slate-900">Meu Plano</h2>
        <p className="text-slate-500 text-sm mt-1">
          Gerencie seu plano de professor e pacotes de alunos.
        </p>
      </div>

      {/* Status atual */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-6 h-6 text-brand-700" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-bold text-lg text-slate-900">
                Plano Professor {isPaid ? "— Pacote Ativo" : "— Gratuito"}
              </h3>
              {isPaid && (
                <span className="text-xs font-medium bg-brand-50 text-brand-700 px-2.5 py-0.5 rounded-full">
                  Pago
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {isPaid
                ? `Você tem ${slots!.slots_total} slots de alunos no total entre todas as turmas.`
                : `Plano gratuito: até ${freeLimit} alunos ativos por turma.`}
            </p>
          </div>
        </div>

        {/* Barra de uso de slots */}
        {loadingSlots ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando uso...
          </div>
        ) : isPaid && slots ? (
          <SlotBar used={slots.slots_used} total={slots.slots_total} />
        ) : slots ? (
          <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-600">
            <span className="font-semibold text-slate-800">{slots.slots_used}</span> alunos ativos
            {" "}(sem limite de total no plano free — limite de {freeLimit} por turma)
          </div>
        ) : null}

        {/* Features gratuitas */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Incluso no plano gratuito
          </p>
          <ul className="space-y-2">
            {FREE_FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-start gap-2 text-sm text-slate-600">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Features exclusivas de pacote pago */}
        <div className={`rounded-xl p-4 space-y-2 ${isPaid ? "bg-brand-50 border border-brand-100" : "bg-slate-50 border border-slate-100 opacity-70"}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5 ${isPaid ? "text-brand-700" : "text-slate-400"}`}>
            <Sparkles className="w-3.5 h-3.5" />
            {isPaid ? "Disponível no seu plano" : "Exclusivo para pacote pago"}
          </p>
          <ul className="space-y-2">
            {PAID_ONLY_FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className={`flex items-start gap-2 text-sm ${isPaid ? "text-brand-800" : "text-slate-400"}`}>
                {isPaid
                  ? <Check className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
                  : <Icon className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />}
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Pacote de alunos */}
      <div className="bg-white rounded-2xl border border-brand-100 ring-2 ring-brand-50 shadow-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-600" />
              Pacote de Alunos
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Cada pacote adiciona <span className="font-semibold text-slate-700">10 slots</span> de alunos
              válidos para todas as turmas.
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold font-display text-slate-900">R$ 11,99</p>
            <p className="text-xs text-slate-400">/mês por pacote</p>
          </div>
        </div>

        <ul className="space-y-2">
          {[
            "10 alunos extras (acumulável — compre quantos pacotes precisar)",
            "Alunos distribuídos livremente entre suas turmas",
            "Entregas de tarefas não descontam o limite diário dos alunos",
            "Correções de tarefas sempre usam o modelo mais avançado",
            "Insights por tarefa: distribuição de notas, média por competência e ranking dos alunos em cada entrega",
          ].map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
              <Check className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>

        <button
          onClick={() => alert("Checkout do pacote de alunos em breve!")}
          className="w-full py-3 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <CreditCard className="w-4 h-4" />
          {isPaid ? "Comprar mais um pacote (+10 alunos)" : "Comprar pacote — R$ 11,99/mês"}
        </button>
      </div>

      {/* Plano pessoal de correções */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-3">
        <h3 className="font-display font-semibold text-slate-900">Seu Plano de Correções</h3>
        <p className="text-sm text-slate-500">
          Como professor, você também pode corrigir suas próprias redações.
          Seu plano atual determina quantas correções pessoais você pode fazer por dia.
        </p>
        <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Plano {user ? PLAN_LABELS[user.plan] : "…"}
            </p>
            <p className="text-xs text-slate-400">
              {user?.plan === "free"
                ? "1 correção pessoal por dia"
                : user?.plan === "standard"
                ? "3 correções pessoais por dia"
                : "10 correções pessoais por dia"}
            </p>
          </div>
          {user?.plan === "free" && (
            <a
              href={`/checkout/standard?periodo=mensal`}
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 transition-colors"
            >
              Fazer upgrade →
            </a>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4 text-sm text-slate-500">
        <Zap className="w-4 h-4 text-brand-500 flex-shrink-0" />
        <p>Pagamentos seguros via Stripe. Cancele quando quiser. Os dados do cartão nunca passam pelos nossos servidores.</p>
      </div>
    </div>
  );
}
