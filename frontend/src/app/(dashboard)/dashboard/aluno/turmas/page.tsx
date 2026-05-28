"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Bell,
  CheckCircle2,
  XCircle,
  Loader2,
  GraduationCap,
  Clock,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api/client";
import type { PendingInvite } from "@/types/turma";

// ─── Turmas ativas ────────────────────────────────────────────────────────────

function ActiveTurmaCard({ invite }: { invite: PendingInvite }) {
  return (
    <Link
      href={`/dashboard/aluno/turmas/${invite.turma_id}`}
      className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex items-start gap-4 hover:shadow-card-hover transition-shadow"
    >
      <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
        <Users className="w-5 h-5 text-purple-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-slate-900">{invite.turma_name}</p>
        <p className="text-sm text-slate-500 mt-0.5">Prof. {invite.teacher_name}</p>
        <p className="text-xs text-slate-400 mt-1">
          Membro desde {new Date(invite.created_at).toLocaleDateString("pt-BR", {
            day: "2-digit", month: "long", year: "numeric",
          })}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs font-medium bg-green-50 text-green-700 px-2.5 py-1 rounded-full">
          Ativo
        </span>
        <ChevronRight className="w-4 h-4 text-slate-300" />
      </div>
    </Link>
  );
}

// ─── Card de convite pendente ─────────────────────────────────────────────────

function InviteCard({
  invite,
  onAccept,
  onReject,
}: {
  invite: PendingInvite;
  onAccept: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState<null | "accept" | "reject">(null);

  const handle = async (action: "accept" | "reject") => {
    setLoading(action);
    try {
      if (action === "accept") await onAccept(invite.member_id);
      else await onReject(invite.member_id);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Bell className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-slate-900">{invite.turma_name}</p>
          <p className="text-sm text-slate-600 mt-0.5">
            <span className="font-medium">Prof. {invite.teacher_name}</span> convidou você para a turma.
          </p>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(invite.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit", month: "short", year: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => handle("accept")}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-700
                     disabled:opacity-60 text-white text-sm font-semibold transition-colors"
        >
          {loading === "accept"
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <CheckCircle2 className="w-4 h-4" />}
          Aceitar
        </button>
        <button
          onClick={() => handle("reject")}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-slate-200
                     hover:border-red-200 hover:text-red-600 disabled:opacity-60 text-slate-600 text-sm font-semibold transition-colors"
        >
          {loading === "reject"
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <XCircle className="w-4 h-4" />}
          Recusar
        </button>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AlunoTurmasPage() {
  const [activeTurmas, setActiveTurmas] = useState<PendingInvite[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [activeRes, pendingRes] = await Promise.all([
          api.get<PendingInvite[]>("/professor/minhas-turmas"),
          api.get<PendingInvite[]>("/professor/meus-convites"),
        ]);
        setActiveTurmas(activeRes.data);
        setPendingInvites(pendingRes.data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleAccept = async (memberId: string) => {
    await api.post(`/professor/meus-convites/${memberId}/aceitar`);
    // Move do pendentes para ativos
    const invite = pendingInvites.find((i) => i.member_id === memberId);
    if (invite) {
      setPendingInvites((prev) => prev.filter((i) => i.member_id !== memberId));
      setActiveTurmas((prev) => [invite, ...prev]);
    }
  };

  const handleReject = async (memberId: string) => {
    await api.delete(`/professor/meus-convites/${memberId}`);
    setPendingInvites((prev) => prev.filter((i) => i.member_id !== memberId));
  };

  const isEmpty = activeTurmas.length === 0 && pendingInvites.length === 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-display font-bold text-2xl text-slate-900">Minhas Turmas</h2>
        <p className="text-slate-500 text-sm mt-1">
          Turmas em que você participa e convites pendentes
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">Não foi possível carregar as turmas. Recarregue a página.</p>
        </div>
      ) : isEmpty ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-12 text-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <GraduationCap className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-slate-500 text-sm">
            Você ainda não participa de nenhuma turma.
          </p>
          <p className="text-xs text-slate-400 mt-1.5">
            Peça ao seu professor para enviar um convite com o seu email cadastrado.
          </p>
        </div>
      ) : (
        <>
          {/* Convites pendentes */}
          {pendingInvites.length > 0 && (
            <div>
              <h3 className="font-display font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                Convites Pendentes
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">
                  {pendingInvites.length}
                </span>
              </h3>
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <InviteCard
                    key={invite.member_id}
                    invite={invite}
                    onAccept={handleAccept}
                    onReject={handleReject}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Turmas ativas */}
          {activeTurmas.length > 0 && (
            <div>
              <h3 className="font-display font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                Turmas Ativas
                <span className="text-slate-400 font-normal text-sm">({activeTurmas.length})</span>
              </h3>
              <div className="space-y-3">
                {activeTurmas.map((t) => (
                  <ActiveTurmaCard key={t.member_id} invite={t} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
