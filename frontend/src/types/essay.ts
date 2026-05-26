/**
 * types/essay.ts — Tipos compartilhados para redações e correções
 */

export type EssayType = "enem" | "vestibular";
export type EssayStatus = "pending" | "processing" | "completed" | "error";
export type EssayInputType = "text" | "photo";

// ─── ENEM ────────────────────────────────────────────────────────────────────

export interface ENEMCompetency {
  number: number;          // 1 a 5
  name: string;            // "Competência 1 — Domínio da norma culta"
  score: number;           // 0, 40, 80, 120, 160 ou 200
  max_score: 200;
  feedback: string;
}

// ─── Vestibular ──────────────────────────────────────────────────────────────

export interface VestibularCriterion {
  name: string;            // "Conteúdo", "Estrutura", "Expressão", "Coesão"
  score: number;           // 0 a 25
  max_score: 25;
  feedback: string;
}

// ─── Highlights ──────────────────────────────────────────────────────────────

export type HighlightType = "positive" | "negative" | "suggestion";

export interface TextHighlight {
  start: number;           // Índice inicial no texto original
  end: number;             // Índice final no texto original
  type: HighlightType;
  comment: string;
}

// ─── Correção ────────────────────────────────────────────────────────────────

export interface Correction {
  id: string;
  essay_id: string;
  total_score: number;     // ENEM: 0–1000 | Vestibular: 0–100
  max_score: number;       // 1000 ou 100
  general_feedback: string;

  // ENEM — 5 competências
  competencies?: ENEMCompetency[];

  // Vestibular — 4 critérios
  criteria?: VestibularCriterion[];

  highlights: TextHighlight[];
  insights: string[];

  created_at: string;
}

// ─── Redação ─────────────────────────────────────────────────────────────────

export interface Essay {
  id: string;
  title: string | null;
  essay_type: EssayType;
  status: EssayStatus;
  input_type: EssayInputType;
  content: string;
  word_count: number;
  created_at: string;
  updated_at: string;
  correction?: Correction;
}

// ─── Responses da API ────────────────────────────────────────────────────────

export interface EssayListItem {
  id: string;
  title: string | null;
  essay_type: EssayType;
  status: EssayStatus;
  input_type: EssayInputType;
  word_count: number;
  total_score: number | null;
  max_score: number | null;
  created_at: string;
}

export interface EssayListResponse {
  items: EssayListItem[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface DailyLimitResponse {
  used: number;
  limit: number;
  resets_at: string; // ISO timestamp
}
