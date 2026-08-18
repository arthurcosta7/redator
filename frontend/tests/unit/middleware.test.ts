import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

function request(path: string, authenticated = false) {
  return new NextRequest(`https://redator.test${path}`, {
    headers: authenticated ? { cookie: "access_token=token-de-teste" } : undefined,
  });
}

describe("middleware de rotas", () => {
  it("redireciona visitante ao login preservando o destino", () => {
    const response = middleware(request("/dashboard/aluno/historico"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://redator.test/auth/login?redirect=%2Fdashboard%2Faluno%2Fhistorico",
    );
  });

  it("permite dashboard quando há cookie de acesso", () => {
    const response = middleware(request("/dashboard/aluno", true));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("afasta usuário autenticado das telas de autenticação", () => {
    const response = middleware(request("/auth/register", true));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://redator.test/dashboard/aluno");
  });

  it("mantém páginas públicas acessíveis", () => {
    const response = middleware(request("/"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
