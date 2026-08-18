import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RegistrationField,
  RegistrationPasswordField,
  registrationInputClassName,
} from "@/components/auth/registration-fields";

describe("campos de registro", () => {
  it("associa erro, descrição e estado inválido ao input", () => {
    render(
      <RegistrationField
        id="email"
        label="Email"
        error={{ type: "validate", message: "Digite um email válido" }}
      >
        <input id="email" aria-invalid="true" aria-describedby="email-error" />
      </RegistrationField>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", expect.stringContaining("email-error"));
    expect(screen.getByText("Digite um email válido")).toBeInTheDocument();
    expect(registrationInputClassName(true)).toContain("border-red-400");
  });

  it("alterna a visibilidade da senha", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationPasswordField
        id="senha"
        label="Senha"
        autoComplete="new-password"
        registration={{ name: "senha", onBlur: vi.fn(), onChange: vi.fn(), ref: vi.fn() }}
      />,
    );
    const input = screen.getByLabelText("Senha");
    expect(input).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar senha" })).toHaveAttribute("aria-pressed", "true");
  });
});
