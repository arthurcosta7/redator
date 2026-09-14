import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pricing } from "@/components/marketing/pricing";

describe("Pricing", () => {
  it("mostra planos e limites reais de aluno", () => {
    render(<Pricing />);
    expect(screen.getByRole("heading", { name: "Free" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Standard" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pro" })).toBeInTheDocument();
    expect(screen.getByText("4 correções por mês")).toBeInTheDocument();
    expect(screen.getByText("12 correções por mês")).toBeInTheDocument();
    expect(screen.getByText("30 correções por mês")).toBeInTheDocument();
  });

  it("usa somente preços comerciais mensais", () => {
    render(<Pricing />);
    expect(screen.queryByRole("button", { name: "Trimestral" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Escolher Standard" })).toHaveAttribute("href", "/checkout/standard");
  });

  it("troca para ofertas de professor sem misturar planos de aluno", async () => {
    const user = userEvent.setup();
    render(<Pricing />);
    await user.click(screen.getByRole("button", { name: "Para professores" }));

    expect(screen.getByRole("heading", { name: "Professor Free" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Professor 30" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Professor 60" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Professor 100" })).toBeInTheDocument();
    expect(screen.getByText("Até 3 alunos ativos no total")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Standard" })).not.toBeInTheDocument();
  });
});
