import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navbar } from "@/components/marketing/navbar";

describe("Navbar", () => {
  it("abre e fecha o menu móvel com atributos acessíveis", async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    const toggle = screen.getByRole("button", { name: "Abrir menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Fechar menu" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("link", { name: "Entrar" })).toHaveLength(2);
  });

  it("faz scroll suave, atualiza a URL e fecha o menu", async () => {
    const user = userEvent.setup();
    const target = document.createElement("section");
    target.id = "professores";
    const scrollIntoView = vi.spyOn(target, "scrollIntoView");
    document.body.appendChild(target);
    const pushState = vi.spyOn(window.history, "pushState");

    render(<Navbar />);
    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    await user.click(screen.getAllByRole("link", { name: "Para professores" }).at(-1)!);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(pushState).toHaveBeenCalledWith(null, "", "#professores");
    expect(screen.queryByRole("button", { name: "Fechar menu" })).not.toBeInTheDocument();
    target.remove();
  });

  it("respeita preferência por movimento reduzido", async () => {
    vi.mocked(window.matchMedia).mockReturnValueOnce({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    const target = document.createElement("section");
    target.id = "planos";
    const scrollIntoView = vi.spyOn(target, "scrollIntoView");
    document.body.appendChild(target);

    render(<Navbar />);
    await userEvent.click(screen.getByRole("link", { name: "Planos" }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    target.remove();
  });
});
