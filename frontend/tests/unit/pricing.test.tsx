import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pricing } from "@/components/marketing/pricing";

describe("Pricing", () => {
  it("mostra planos e limites reais de aluno", () => {
    render(<Pricing />);
    expect(screen.getByRole("heading", { name: "Free" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Standard" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pro" })).toBeInTheDocument();
    expect(screen.getByText("1 correção por dia")).toBeInTheDocument();
    expect(screen.getByText("3 correções por dia")).toBeInTheDocument();
    expect(screen.getByText("10 correções por dia")).toBeInTheDocument();
  });

  it("alterna mensal e trimestral mantendo links de checkout", async () => {
    const user = userEvent.setup();
    render(<Pricing />);
    await user.click(screen.getByRole("button", { name: "Trimestral" }));

    expect(screen.getByRole("button", { name: "Trimestral" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("R$ 47,99 cobrados a cada 3 meses")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Assinar Standard" })).toHaveAttribute(
      "href",
      expect.stringContaining("periodo%3Dtrimestral"),
    );
  });

  it("troca para ofertas de professor sem misturar planos de aluno", async () => {
    const user = userEvent.setup();
    render(<Pricing />);
    await user.click(screen.getByRole("button", { name: "Para professores" }));

    expect(screen.getByRole("heading", { name: "Professor Free" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pacote de alunos" })).toBeInTheDocument();
    expect(screen.getByText("Até 3 alunos ativos por turma")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Standard" })).not.toBeInTheDocument();
  });
});
