import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "token-de-verificacao-com-tamanho-valido" }),
}));

vi.mock("@/lib/api/client", () => ({
  api: { post },
}));

import VerifyEmailPage from "@/app/(auth)/auth/verify-email/[token]/page";

describe("verificação de email", () => {
  beforeEach(() => {
    post.mockReset();
  });

  it("consome o token uma única vez mesmo sob StrictMode", async () => {
    post.mockResolvedValue({ data: { message: "Email verificado com sucesso!" } });

    render(
      <StrictMode>
        <VerifyEmailPage />
      </StrictMode>
    );

    expect(await screen.findByText("Email verificado!")).toBeInTheDocument();
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(
      "/auth/verify-email/token-de-verificacao-com-tamanho-valido"
    );
  });
});
