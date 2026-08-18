import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HighlightedText } from "@/components/dashboard/highlighted-text";

describe("HighlightedText", () => {
  it("renderiza texto sem legenda quando não há grifes", () => {
    render(<HighlightedText text="Texto sem marcações" highlights={[]} />);
    expect(screen.getByText("Texto sem marcações")).toBeInTheDocument();
    expect(screen.queryByText(/Clique nos trechos/)).not.toBeInTheDocument();
  });

  it("ordena, limita posições e abre o comentário do trecho", async () => {
    const user = userEvent.setup();
    render(
      <HighlightedText
        text="Argumento bem construído."
        highlights={[
          { start: 10, end: 14, type: "negative", comment: "Revise este ponto" },
          { start: 0, end: 9, type: "positive", comment: "Boa escolha" },
          { start: 20, end: 500, type: "suggestion", comment: "Pode detalhar" },
        ]}
      />,
    );

    await user.click(screen.getByText("Argumento"));
    expect(screen.getByText("Boa escolha")).toBeVisible();
    expect(screen.getAllByText("✓ Ponto forte")).toHaveLength(2);
    expect(screen.getByText("✗ Atenção")).toBeVisible();
    expect(screen.getByText("→ Sugestão")).toBeVisible();
  });

  it("não duplica texto quando há grifes sobrepostos", () => {
    const { container } = render(
      <HighlightedText
        text="abcdefghij"
        highlights={[
          { start: 1, end: 5, type: "positive", comment: "primeiro" },
          { start: 3, end: 8, type: "negative", comment: "segundo" },
        ]}
      />,
    );
    expect(container.querySelector("p")?.textContent).toBe("abcdefghij");
  });
});
