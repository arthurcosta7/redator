/**
 * types/admin.ts — Tipos do painel administrativo
 */
import type { AdminRole } from "./user";

// ─── Permissões por role ──────────────────────────────────────────────────────

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  analyst: "Analista",
  support: "Suporte",
  licensed_teacher: "Professor licenciado",
};

export const ADMIN_ROLE_COLORS: Record<AdminRole, string> = {
  superadmin: "bg-red-100 text-red-700 border-red-200",
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  analyst: "bg-blue-100 text-blue-700 border-blue-200",
  support: "bg-emerald-100 text-emerald-700 border-emerald-200",
  licensed_teacher: "bg-amber-100 text-amber-800 border-amber-200",
};

/** Verifica se uma role pode gerenciar usuários */
export function canManageUsers(role: AdminRole): boolean {
  return ["superadmin", "admin", "support"].includes(role);
}

/** Verifica se uma role pode alterar planos */
export function canChangePlan(role: AdminRole): boolean {
  return ["superadmin", "admin"].includes(role);
}

/** Verifica se uma role pode deletar usuários */
export function canDeleteUsers(role: AdminRole): boolean {
  return role === "superadmin";
}

/** Verifica se uma role pode gerenciar a equipe admin */
export function canManageTeam(role: AdminRole): boolean {
  return role === "superadmin";
}

/** Verifica se uma role pode ver analytics completos */
export function canViewAnalytics(role: AdminRole): boolean {
  return ["superadmin", "admin", "analyst"].includes(role);
}

// ─── Estatísticas ─────────────────────────────────────────────────────────────

export interface AdminStats {
  total_users: number;
  active_users: number;
  new_users_today: number;
  new_users_week: number;
  total_essays: number;
  essays_today: number;
  essays_week: number;
  corrections_completed: number;
  corrections_today: number;
  plan_distribution: Record<string, number>;
  user_type_distribution: Record<string, number>;
  essay_type_distribution: Record<string, number>;
  status_distribution: Record<string, number>;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface AdminAnalyticsDay {
  date: string;
  essays_submitted: number;
  corrections_completed: number;
  new_users: number;
}

export interface AdminAnalytics {
  daily: AdminAnalyticsDay[];
}

// ─── Usuários ────────────────────────────────────────────────────────────────

export interface AdminUserItem {
  id: string;
  full_name: string;
  email: string;
  user_type: string;
  plan: string;
  is_active: boolean;
  is_email_verified: boolean;
  admin_role: AdminRole | null;
  created_at: string;
  essay_count: number;
}

export interface AdminUserDetail extends AdminUserItem {
  school_name: string | null;
  discipline: string | null;
  grade: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  last_essay_at: string | null;
}

export interface AdminUsersResponse {
  items: AdminUserItem[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// ─── Redações ─────────────────────────────────────────────────────────────────

export interface AdminEssayItem {
  id: string;
  title: string | null;
  essay_type: string;
  input_type: string;
  status: string;
  word_count: number | null;
  created_at: string;
  user_id: string;
  user_name: string;
  user_email: string;
  total_score: number | null;
  max_score: number | null;
}

export interface AdminEssaysResponse {
  items: AdminEssayItem[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// ─── Equipe ───────────────────────────────────────────────────────────────────

export interface AdminTeamMember {
  id: string;
  full_name: string;
  email: string;
  admin_role: AdminRole;
  is_active: boolean;
  created_at: string;
}
