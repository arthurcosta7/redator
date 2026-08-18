import { render, screen } from "@testing-library/react";
import { VariableFontHover } from "@/components/ui/variable-font-hover";

describe("VariableFontHover", () => {
  it("mantém um nome acessível e separa caracteres Unicode", () => {
    const { container } = render(<VariableFontHover label="Olá 👋" staggerFrom="first" />);
    expect(screen.getByText("Olá 👋", { selector: ".sr-only" })).toBeInTheDocument();
    expect(container.querySelectorAll(".variable-font-hover__glyph")).toHaveLength(5);
    expect(container.querySelector(".variable-font-hover__visual")).toHaveAttribute("aria-hidden", "true");
  });

  it("calcula atrasos simétricos quando parte do centro", () => {
    const { container } = render(
      <VariableFontHover label="ABCD" staggerDuration={0.1} staggerFrom="center" />,
    );
    const glyphs = [...container.querySelectorAll<HTMLElement>(".variable-font-hover__glyph")];
    expect(glyphs.map((glyph) => glyph.style.getPropertyValue("--variable-font-delay"))).toEqual([
      "0.15000000000000002s",
      "0.05s",
      "0.05s",
      "0.15000000000000002s",
    ]);
  });
});
