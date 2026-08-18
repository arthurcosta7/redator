import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppealPanel } from "@/components/dashboard/appeal-panel";
import { api } from "@/lib/api/client";
import type { Correction } from "@/types/essay";

const correction: Correction = {
  id: "correction-1",
  essay_id: "essay-1",
  total_score: 720,
  max_score: 1000,
  general_feedback: "Bom desenvolvimento.",
  highlights: [],
  insights: [],
  created_at: "2026-08-18T12:00:00Z",
};

describe("AppealPanel", () => {
  it("carrega sem contestação e valida o tamanho antes de enviar", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { items: [], total: 0 } });
    const post = vi.spyOn(api, "post");
    const user = userEvent.setup();
    render(<AppealPanel correction={correction} />);

    await user.click(await screen.findByRole("button", { name: /Contestar correção/ }));
    const submit = screen.getByRole("button", { name: "Enviar contestação" });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText("Motivo da contestação"), "Curto");
    expect(submit).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it("envia motivo e consentimento e mostra o estado retornado", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { items: [], total: 0 } });
    vi.spyOn(api, "post").mockResolvedValue({
      data: {
        id: "appeal-1",
        correction_id: correction.id,
        essay_id: correction.essay_id,
        essay_title: "Teste",
        essay_type: "enem",
        status: "pending",
        student_reason: "A competência três ignorou o segundo argumento desenvolvido.",
        original_total_score: 720,
        corrected_total_score: null,
        max_score: 1000,
        reviewer_explanation: null,
        reviewer_name: null,
        allow_anonymized_improvement: true,
        created_at: "2026-08-18T12:00:00Z",
        reviewed_at: null,
      },
    });
    const user = userEvent.setup();
    render(<AppealPanel correction={correction} />);

    await user.click(await screen.findByRole("button", { name: /Contestar correção/ }));
    const reason = "A competência três ignorou o segundo argumento desenvolvido.";
    await user.type(screen.getByLabelText("Motivo da contestação"), reason);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Enviar contestação" }));

    await screen.findByText("Aguardando professor");
    expect(api.post).toHaveBeenCalledWith("/appeals", {
      correction_id: correction.id,
      reason,
      allow_anonymized_improvement: true,
    });
  });

  it("mostra falha de consulta sem liberar formulário prematuramente", async () => {
    vi.spyOn(api, "get").mockRejectedValue(new Error("offline"));
    render(<AppealPanel correction={correction} />);
    expect(await screen.findByText("Não foi possível consultar o estado da contestação.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText("Carregando contestação")).not.toBeInTheDocument());
  });
});
