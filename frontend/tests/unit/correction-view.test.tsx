import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CorrectionView } from "@/components/dashboard/correction-view";
import type { Correction, Essay } from "@/types/essay";

const essay: Essay = {
  id: "essay-1",
  title: "Educação midiática",
  essay_type: "enem",
  status: "completed",
  input_type: "text",
  content: "A educação midiática fortalece a cidadania.",
  word_count: 150,
  created_at: "2026-08-18T12:00:00Z",
  updated_at: "2026-08-18T12:01:00Z",
};

const correction: Correction = {
  id: "correction-1",
  essay_id: essay.id,
  total_score: 760,
  max_score: 1000,
  general_feedback: "Boa argumentação, com espaço para detalhar a proposta.",
  competencies: [
    {
      number: 1,
      name: "Domínio da modalidade escrita",
      score: 160,
      max_score: 200,
      feedback: "Poucos desvios.",
    },
    {
      number: 2,
      name: "Compreensão do tema",
      score: 120,
      max_score: 200,
      feedback: "Aprofunde o repertório.",
    },
  ],
  highlights: [
    { start: 2, end: 20, type: "positive", comment: "Tese clara" },
  ],
  insights: ["Detalhe o agente da proposta.", "Use repertório específico."],
  created_at: "2026-08-18T12:01:00Z",
};

describe("CorrectionView", () => {
  it("renderiza nota, modelo e competências e expande feedback", async () => {
    const user = userEvent.setup();
    render(<CorrectionView essay={essay} correction={correction} />);
    expect(screen.getByText("760")).toBeInTheDocument();
    expect(screen.getByText("Modelo ENEM")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Domínio da modalidade escrita/ }));
    expect(screen.getByText("Poucos desvios.")).toBeVisible();
  });

  it("alterna para o texto e preserva grifes interativas", async () => {
    const user = userEvent.setup();
    render(<CorrectionView essay={essay} correction={correction} />);
    await user.click(screen.getByRole("button", { name: "Texto" }));
    expect(screen.getByText("Texto da Redação")).toBeInTheDocument();
    expect(screen.getByText("1 grife")).toBeInTheDocument();
    await user.click(screen.getByText("educação midiática"));
    expect(screen.getByText("Tese clara")).toBeVisible();
  });

  it("lista insights e mostra fallback de plano quando vazio", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CorrectionView essay={essay} correction={correction} />);
    await user.click(screen.getByRole("button", { name: "Insights" }));
    expect(screen.getByText("Detalhe o agente da proposta.")).toBeInTheDocument();

    rerender(<CorrectionView essay={essay} correction={{ ...correction, insights: [] }} />);
    expect(screen.getByText("Insights detalhados disponíveis nos planos Standard e Pro.")).toBeInTheDocument();
  });

  it("aceita critérios de vestibular e correção sem grifes", async () => {
    const user = userEvent.setup();
    const vestibularEssay = { ...essay, essay_type: "vestibular" as const };
    const vestibularCorrection: Correction = {
      ...correction,
      total_score: 72,
      max_score: 100,
      competencies: undefined,
      criteria: [{ name: "Coesão", score: 18, max_score: 25, feedback: "Boa progressão." }],
      highlights: [],
    };
    render(<CorrectionView essay={vestibularEssay} correction={vestibularCorrection} />);
    expect(screen.getByText("Critérios de Avaliação")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Texto" }));
    expect(screen.getByText("Grifes disponíveis no plano Standard/Pro")).toBeInTheDocument();
  });
});
