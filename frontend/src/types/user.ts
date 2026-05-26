/**
 * types/user.ts — Tipos de usuário
 */

export type UserType = "student" | "teacher";
export type UserPlan = "free" | "standard" | "pro";

export interface CurrentUser {
  id: string;
  full_name: string;
  email: string;
  user_type: UserType;
  plan: UserPlan;
  is_email_verified: boolean;
  grade?: string | null;          // Aluno
  school_name?: string | null;    // Professor
  discipline?: string | null;     // Professor
  created_at: string;
}

export const PLAN_LABELS: Record<UserPlan, string> = {
  free: "Grátis",
  standard: "Standard",
  pro: "Pro",
};

export const PLAN_LIMITS: Record<UserPlan, number> = {
  free: 1,
  standard: 3,
  pro: Infinity,
};

export const PLAN_COLORS: Record<UserPlan, string> = {
  free: "text-slate-500 bg-slate-100",
  standard: "text-brand-700 bg-brand-50",
  pro: "text-amber-700 bg-amber-50",
};
