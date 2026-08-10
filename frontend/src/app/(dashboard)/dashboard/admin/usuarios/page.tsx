"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  User,
  CrownIcon,
  Ban,
  MailCheck,
  ArrowLeftRight,
  ChevronDown,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useUser } from "@/contexts/UserContext";
import { PLAN_LABELS } from "@/types/user";
import { ADMIN_ROLE_LABELS, ADMIN_ROLE_COLORS, canChangePlan, canDeleteUsers } from "@/types/admin";
import type { AdminUserItem, AdminUsersResponse } from "@/types/admin";
import type { AdminRole } from "@/types/user";

// ─── Helpers de UI ────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    free: "bg-slate-100 text-slate-600",
    standard: "bg-brand-50 text-brand-700",
    pro: "bg-amber-50 text-amber-700",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[plan] ?? "bg-slate-100 text-slate-500"}`}>
      {PLAN_LABELS[plan as keyof typeof PLAN_LABELS] ?? plan}
    </span>
  );
}

function StatusBadge({ active, verified }: { active: boolean; verified: boolean }) {
  if (!active) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
      <Ban className="w-3 h-3" /> Banido
    </span>
  );
  if (!verified) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
      <AlertCircle className="w-3 h-3" /> Não verificado
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="w-3 h-3" /> Ativo
    </span>
  );
}

// ─── Modal de detalhes / ações ────────────────────────────────────────────────

function UserActionMenu({
  user,
  adminRole,
  onAction,
}: {
  user: AdminUserItem;
  adminRole: AdminRole;
  onAction: (action: string, userId: string, value?: unknown) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
      >
        Ações <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 w-52 text-sm">
            {/* Verificar email */}
            {!user.is_email_verified && (
              <button
                onClick={() => { onAction("verify_email", user.id, true); setOpen(false); }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
              >
                <MailCheck className="w-4 h-4 text-blue-500" />
                Verificar email
              </button>
            )}

            {/* Trocar tipo de conta (professor ↔ aluno) — só para admin/superadmin */}
            {canChangePlan(adminRole) && (
              <button
                onClick={() => {
                  const novoTipo = user.user_type === "student" ? "teacher" : "student";
                  const label = novoTipo === "teacher" ? "Professor" : "Aluno";
                  if (confirm(`Mudar a conta de ${user.full_name} para ${label}? Os dados específicos do tipo anterior (escola, série, etc.) serão apagados.`)) {
                    onAction("user_type", user.id, novoTipo);
                    setOpen(false);
                  }
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
              >
                <ArrowLeftRight className="w-4 h-4 text-indigo-500" />
                Mudar para {user.user_type === "student" ? "Professor" : "Aluno"}
              </button>
            )}

            {/* Ban / Unban */}
            {user.is_active ? (
              <button
                onClick={() => { onAction("ban", user.id, false); setOpen(false); }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-red-600"
              >
                <Ban className="w-4 h-4" />
                Banir usuário
              </button>
            ) : (
              <button
                onClick={() => { onAction("unban", user.id, true); setOpen(false); }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-green-600"
              >
                <CheckCircle2 className="w-4 h-4" />
                Desbanir usuário
              </button>
            )}

            {/* Alterar plano — apenas alunos têm plano free/standard/pro */}
            {canChangePlan(adminRole) && user.user_type === "student" && (
              <>
                <div className="border-t border-slate-100 my-1" />
                <p className="px-4 py-1 text-xs text-slate-400 font-medium uppercase tracking-wide">
                  Alterar plano
                </p>
                {["free", "standard", "pro"]
                  .filter((p) => p !== user.plan)
                  .map((plan) => (
                    <button
                      key={plan}
                      onClick={() => { onAction("plan", user.id, plan); setOpen(false); }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <CrownIcon className="w-4 h-4 text-amber-500" />
                      Mudar para {PLAN_LABELS[plan as keyof typeof PLAN_LABELS]}
                    </button>
                  ))}
              </>
            )}
            {canChangePlan(adminRole) && user.user_type === "teacher" && (
              <>
                <div className="border-t border-slate-100 my-1" />
                <p className="px-4 py-1 text-xs text-slate-400 font-medium uppercase tracking-wide">
                  Plano de professor
                </p>
                <p className="px-4 py-2 text-xs text-slate-400 italic">
                  Gerenciado via pacotes Stripe (slots de alunos)
                </p>
              </>
            )}

            {/* Deletar (superadmin only, sem admin_role) */}
            {canDeleteUsers(adminRole) && !user.admin_role && (
              <>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => {
                    if (confirm(`Deletar permanentemente ${user.full_name}? Esta ação não pode ser desfeita.`)) {
                      onAction("delete", user.id);
                      setOpen(false);
                    }
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-2 text-red-600"
                >
                  <XCircle className="w-4 h-4" />
                  Deletar conta
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { user: adminUser } = useUser();
  const adminRole = adminUser?.admin_role as AdminRole;

  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "20",
        ...(search && { search }),
        ...(planFilter && { plan: planFilter }),
        ...(typeFilter && { user_type: typeFilter }),
        ...(activeFilter !== "" && { is_active: activeFilter }),
      });
      const res = await api.get<AdminUsersResponse>(`/admin/users?${params}`);
      setData(res.data);
    } catch {
      setError("Erro ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }, [page, search, planFilter, typeFilter, activeFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleAction = async (action: string, userId: string, value?: unknown) => {
    setActionLoading(userId);
    setError(null);
    setSuccessMsg(null);

    try {
      if (action === "delete") {
        await api.delete(`/admin/users/${userId}`);
        setSuccessMsg("Usuário deletado com sucesso.");
      } else {
        const body: Record<string, unknown> = {};
        if (action === "ban" || action === "unban") body.is_active = value;
        if (action === "verify_email") body.is_email_verified = value;
        if (action === "plan") body.plan = value;
        if (action === "user_type") body.user_type = value;
        await api.patch(`/admin/users/${userId}`, body);
        const typeLabel = action === "user_type"
          ? `Tipo alterado para ${value === "teacher" ? "Professor" : "Aluno"} com sucesso.`
          : "Usuário atualizado com sucesso.";
        setSuccessMsg(typeLabel);
      }
      await fetchUsers();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Erro ao executar ação.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-900">
          Usuários
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {data ? `${data.total.toLocaleString("pt-BR")} usuários no total` : "Gerenciamento de usuários"}
        </p>
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

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          {/* Busca */}
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por nome ou email…"
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-50 transition-colors"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-700 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors"
            >
              Buscar
            </button>
          </form>

          {/* Filtro plano */}
          <select
            value={planFilter}
            onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-brand-400 bg-white"
          >
            <option value="">Todos os planos</option>
            <option value="free">Grátis</option>
            <option value="standard">Standard</option>
            <option value="pro">Pro</option>
          </select>

          {/* Filtro tipo */}
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-brand-400 bg-white"
          >
            <option value="">Todos os tipos</option>
            <option value="student">Aluno</option>
            <option value="teacher">Professor</option>
          </select>

          {/* Filtro status */}
          <select
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-brand-400 bg-white"
          >
            <option value="">Todos os status</option>
            <option value="true">Ativos</option>
            <option value="false">Banidos</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 text-brand-500 animate-spin" />
          </div>
        ) : !data?.items.length ? (
          <div className="text-center py-16 text-slate-400">
            <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum usuário encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Usuário
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">
                    Tipo
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Plano
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                    Redações
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden xl:table-cell">
                    Desde
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.items.map((u) => (
                  <tr
                    key={u.id}
                    className={`hover:bg-slate-50/50 transition-colors ${actionLoading === u.id ? "opacity-50" : ""}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate flex items-center gap-1.5">
                            {u.full_name}
                            {u.admin_role && (
                              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${ADMIN_ROLE_COLORS[u.admin_role]}`}>
                                {ADMIN_ROLE_LABELS[u.admin_role]}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-slate-500 capitalize">
                        {u.user_type === "student" ? "Aluno" : "Professor"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <PlanBadge plan={u.plan} />
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <StatusBadge active={u.is_active} verified={u.is_email_verified} />
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell text-slate-500 text-xs">
                      {u.essay_count}
                    </td>
                    <td className="px-4 py-3.5 hidden xl:table-cell text-slate-400 text-xs">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <UserActionMenu
                        user={u}
                        adminRole={adminRole}
                        onAction={handleAction}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {data && data.total > data.per_page && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Página {data.page} de {Math.ceil(data.total / data.per_page)} · {data.total} usuários
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!data.has_more}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
