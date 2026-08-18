export type AppealStatus = "pending" | "in_review" | "upheld" | "corrected";

export interface CorrectionAppeal {
  id: string;
  correction_id: string;
  essay_id: string;
  essay_title: string;
  essay_type: string;
  status: AppealStatus;
  student_reason: string;
  original_total_score: number;
  corrected_total_score: number | null;
  max_score: number;
  reviewer_explanation: string | null;
  reviewer_name: string | null;
  allow_anonymized_improvement: boolean;
  created_at: string;
  reviewed_at: string | null;
}

export interface AppealListResponse {
  items: CorrectionAppeal[];
  total: number;
}

export interface ReviewerAppealDetail extends CorrectionAppeal {
  essay_theme: string | null;
  essay_content: string;
  original_competencies: Array<{
    number: number;
    name: string;
    score: number;
    max_score: number;
    feedback?: string;
  }>;
  original_highlights: unknown[];
  original_insights: Record<string, unknown>;
  original_ai_model: string | null;
}
