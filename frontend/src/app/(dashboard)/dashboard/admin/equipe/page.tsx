"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Save,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useUser } from "@/contexts/UserContext";
import { ADMIN_ROLE_LABELS, ADMIN_ROLE_COLORS } from "@/types/admin";
import type { AdminTeamMember } from "@/types/admin";
import type { AdminRole } from "@/types/user";

// ─── Modal de adicionar membro ────────────────────────────────────────────────

function AddMemberModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("support");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/admin/team", { email, admin_role: role });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Erro ao adicionar membro.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-lg text-slate-900">
            Adicionar à Equipe
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
          <p className="text-xs text-amber-800">
            <strong>Atenção:</strong> O usuário já deve ter uma conta no Redator.
            Esta ação concede acesso administrativo à conta existente.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Email do usuário
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@exemplo.com"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Nível de acesso
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-50 transition-colors bg-white"
            >
              <option value="support">Suporte — visualizar e ações de suporte</option>
              <option value="analyst">Analista — somente leitura + analytics</option>
              <option value="admin">Admin — gerenciar usuários e redações</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Superadmin só pode ser definido diretamente no banco de dados.
            </p>
          </div>

          {error && (
            <div className="flex gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-brand-700 hover:bg-brand-800 disabled:opacity-60 rounded-xl transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal de editar role ────────────────────────────────────────────────────

function EditRoleModal({
  member,
  onClose,
  onSuccess,
}: {
  member: AdminTeamMember;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [role, setRole] = useState<AdminRole>(member.admin_role);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.patch(`/admin/team/${member.id}/role`, { admin_role: role });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Erro ao alterar role.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg text-slate-900">
            Alterar Nível
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-4">
          Alterando nível de acesso de <strong>{member.full_name}</strong>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 outline-none focus:border-brand-400 bg-white"
          >
            <option value="support">Suporte</option>
            <option value="analyst">Analista</option>
            <option value="admin">Admin</option>
          </select>

          {error && (
            <div className="flex gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading || role === member.admin_role} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-700 hover:bg-brand-800 disabled:opacity-60 rounded-xl transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AdminTeamPage() {
  const { user } = useUser();
  const [members, setMembers] = useState<AdminTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingMember, setEditingMember] = useState<AdminTeamMember | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchTeam = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<AdminTeamMember[]>("/admin/team");
      setMembers(res.data);
    } catch {
      setError("Erro ao carregar equipe.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleRemove = async (member: AdminTeamMember) => {
    if (
      !confirm(
        `Remover ${member.full_name} da equipe admin? O acesso será revogado imediatamente.`
      )
    ) return;

    setRemovingId(member.id);
    try {
      await api.delete(`/admin/team/${member.id}`);
      setSuccessMsg(`${member.full_name} removido(a) da equipe.`);
      await fetchTeam();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Erro ao remover membro.");
    } finally {
      setRemovingId(null);
    }
  };

  // Ordena: superadmin primeiro, depois por role
  const roleOrder: Record<AdminRole, number> = {
    superadmin: 0,
    admin: 1,
    analyst: 2,
    support: 3,
  };
  const sorted = [...members].sort((a, b) =>
    (roleOrder[a.admin_role] ?? 99) - (roleOrder[b.admin_role] ?? 99)
  );

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-900">Equipe Admin</h1>
          <p className="text-slate-500 text-sm mt-1">
            Gerenciamento dos membros com acesso ao painel.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-700 text-white text-sm font-semibold rounded-xl hover:bg-brand-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Adicionar membro
        </button>
      </div>

      {/* Aviso de responsabilidade */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-red-800 space-y-1">
          <p className="font-semibold">Atenção: Ações aqui têm impacto crítico de segurança.</p>
          <p>Conceder acesso admin a uma conta permite ver dados de todos os usuários.
          Conceda apenas a pessoas de absoluta confiança. Todas as ações são registradas em log.</p>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {successMsg && (
        <div className="flex gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-700">{successMsg}</p>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 text-brand-500 animate-spin" />
          </div>
        ) : !sorted.length ? (
          <div className="text-center py-16 text-slate-400">
            <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum membro encontrado.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {sorted.map((member) => {
              const isMe = member.id === user?.id;
              const isSuperadmin = member.admin_role === "superadmin";

              return (
                <div
                  key={member.id}
                  className={`flex items-center gap-4 px-5 py-4 ${removingId === member.id ? "opacity-50" : ""}`}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                    isSuperadmin
                      ? "bg-gradient-to-br from-red-400 to-red-600"
                      : "bg-gradient-to-br from-brand-400 to-brand-600"
                  }`}>
                    {member.full_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800 text-sm">
                        {member.full_name}
                        {isMe && (
                          <span className="ml-1.5 text-xs text-brand-600 font-medium">(você)</span>
                        )}
                      </p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ADMIN_ROLE_COLORS[member.admin_role]}`}>
                        {ADMIN_ROLE_LABELS[member.admin_role]}
                      </span>
                      {!member.is_active && (
                        <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          Conta inativa
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{member.email}</p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Desde {new Date(member.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>

                  {/* Ações (não aparecem para si mesmo nem para superadmins) */}
                  {!isMe && !isSuperadmin && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setEditingMember(member)}
                        className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        title="Alterar nível"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemove(member)}
                        disabled={removingId === member.id}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remover da equipe"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legenda de permissões */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Permissões por nível
        </p>
        <div className="space-y-2 text-xs text-slate-600">
          {[
            {
              role: "superadmin",
              perms: "Acesso total — gerencia equipe, usuários, redações, analytics e configurações do sistema.",
            },
            {
              role: "admin",
              perms: "Gerencia usuários (plano, banimento, verificação) e redações. Não pode gerenciar outros admins.",
            },
            {
              role: "analyst",
              perms: "Acesso somente leitura — visualiza analytics, estatísticas e dados agregados.",
            },
            {
              role: "support",
              perms: "Visualiza usuários/redações, pode banir/desbanir e verificar emails. Não altera planos.",
            },
          ].map((item) => (
            <div key={item.role} className="flex gap-3">
              <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border self-start ${ADMIN_ROLE_COLORS[item.role as AdminRole]}`}>
                {ADMIN_ROLE_LABELS[item.role as AdminRole]}
              </span>
              <span className="text-slate-500">{item.perms}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modais */}
      {showAdd && (
        <AddMemberModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => { fetchTeam(); setSuccessMsg("Membro adicionado com sucesso."); }}
        />
      )}
      {editingMember && (
        <EditRoleModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSuccess={() => { fetchTeam(); setSuccessMsg("Nível alterado com sucesso."); }}
        />
      )}
    </div>
  );
}
