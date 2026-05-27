/**
 * turma.ts — Tipos TypeScript para turmas de professores
 */

export type TurmaMembroStatus = "pending" | "active" | "removed";

export interface Turma {
  id: string;
  name: string;
  description?: string | null;
  member_count: number;
  active_member_count: number;
  essay_count: number;
  created_at: string;
}

export interface TurmaMembro {
  id: string;
  turma_id: string;
  user_id?: string | null;
  display_name?: string | null;
  email?: string | null;
  status: TurmaMembroStatus;
  joined_at: string;
  essay_count: number;
  completed_count: number;
  avg_score_pct?: number | null;
  last_essay_at?: string | null;
}

export interface TurmaDetail extends Turma {
  members: TurmaMembro[];
}

export interface TurmaEssay {
  id: string;
  title?: string | null;
  essay_type: string;
  status: string;
  word_count?: number | null;
  total_score?: number | null;
  max_score?: number | null;
  created_at: string;
  student_id?: string | null;
  student_name: string;
}

export interface TurmaEssaysResponse {
  items: TurmaEssay[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface StudentAnalytics {
  member_id: string;
  user_id?: string | null;
  display_name: string;
  email?: string | null;
  status: TurmaMembroStatus;
  essay_count: number;
  completed_count: number;
  avg_score_pct?: number | null;
  last_essay_at?: string | null;
}

export interface TurmaAnalyticsSummary {
  id: string;
  name: string;
  active_members: number;
  essay_count: number;
  completed_count: number;
  avg_score_pct?: number | null;
}

export interface ProfessorOverviewAnalytics {
  turma_count: number;
  active_member_count: number;
  total_essay_count: number;
  essays_this_week: number;
  avg_score_pct?: number | null;
  turmas: TurmaAnalyticsSummary[];
}

export interface TurmaFullAnalytics {
  turma_id: string;
  turma_name: string;
  active_members: number;
  total_essays: number;
  completed_essays: number;
  avg_score_pct?: number | null;
  students: StudentAnalytics[];
}

export interface StudentFullAnalytics {
  member_id: string;
  user_id?: string | null;
  display_name: string;
  email?: string | null;
  turma_id: string;
  turma_name: string;
  essay_count: number;
  completed_count: number;
  avg_score_pct?: number | null;
  essays: TurmaEssay[];
}

export interface PendingInvite {
  member_id: string;
  turma_id: string;
  turma_name: string;
  teacher_name: string;
  created_at: string;
}
