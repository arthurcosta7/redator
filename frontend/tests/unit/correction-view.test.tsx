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
      strengths: ["A concordância está correta no trecho de abertura."],
      improvements: ["Revise a vírgula que separa sujeito e predicado no segundo parágrafo."],
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
  insights: {
    general_feedback: "Boa argumentação, com espaço para detalhar a proposta.",
    main_strengths: [
      {
        title: "Tese clara e pertinente",
        evidence: "A educação midiática fortalece a cidadania.",
        explanation: "O trecho delimita a discussão e apresenta uma posição que pode ser defendida.",
        repeat_strategy: "Formule a tese com tema, posicionamento e os eixos que serão desenvolvidos.",
      },
    ],
    priority_improvements: [
      {
        title: "Detalhar o agente da proposta",
        evidence: "É preciso conscientizar a população.",
        impact: "Sem um responsável definido, a intervenção perde executabilidade e detalhamento.",
        how_to_improve: "Escolha uma instituição com competência real e descreva sua responsabilidade.",
        rewrite_example: "O Ministério da Educação deve promover oficinas de leitura crítica nas escolas.",
        practice: "Crie três propostas diferentes indicando agente, ação, meio e finalidade.",
      },
    ],
    next_essay_checklist: [
      "Conferir se cada argumento contém causa, mecanismo e consequência.",
      "Verificar agente, ação, meio e finalidade da intervenção.",
    ],
    writing_level: "intermediário",
  },
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
    expect(screen.getByText("O que você acertou")).toBeVisible();
    expect(screen.getByText("A concordância está correta no trecho de abertura.")).toBeVisible();
    expect(screen.getByText("O que corrigir agora")).toBeVisible();
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

  it("renderiza o formato estruturado de insights dos planos pagos", async () => {
    const user = userEvent.setup();
    render(<CorrectionView essay={essay} correction={correction} />);
    await user.click(screen.getByRole("button", { name: "Insights" }));
    expect(screen.getByText("Nível intermediário")).toBeInTheDocument();
    expect(screen.getByText("Tese clara e pertinente")).toBeInTheDocument();
    expect(screen.getByText("Por que está certo")).toBeInTheDocument();
    expect(screen.getByText("Detalhar o agente da proposta")).toBeInTheDocument();
    expect(screen.getByText("Por que prejudica a nota")).toBeInTheDocument();
    expect(screen.getByText("Exemplo de reescrita")).toBeInTheDocument();
    expect(screen.getByText("Checklist para a próxima redação")).toBeInTheDocument();
    expect(
      screen.queryByText("Insights detalhados disponíveis nos planos Standard e Pro.")
    ).not.toBeInTheDocument();
  });

  it("mantém compatibilidade com insights antigos e diferencia ausência de acesso", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CorrectionView
        essay={essay}
        correction={{ ...correction, insights: ["Insight legado."] }}
      />
    );
    await user.click(screen.getByRole("button", { name: "Insights" }));
    expect(screen.getByText("Insight legado.")).toBeInTheDocument();

    const freeCorrection = {
      ...correction,
      insights: undefined,
      highlights: undefined,
    };
    rerender(<CorrectionView essay={essay} correction={freeCorrection} />);
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
    expect(screen.getByText("Nenhum trecho grifado")).toBeInTheDocument();
  });
});
