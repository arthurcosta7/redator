import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { api, getApiError } from "@/lib/api/client";

describe("cliente da API", () => {
  it("usa a base v1, cookies e timeout defensivo", () => {
    expect(api.defaults.baseURL).toMatch(/\/api\/v1$/);
    expect(api.defaults.withCredentials).toBe(true);
    expect(api.defaults.timeout).toBe(30_000);
  });

  it("normaliza apenas erros de campo válidos", () => {
    const error = new axios.AxiosError("invalid", "422", undefined, undefined, {
      data: {
        detail: "Dados inválidos",
        errors: [
          { field: "email", message: "Email inválido" },
          { field: 123, message: "ignorar" },
          null,
        ],
      },
      status: 422,
      statusText: "Unprocessable Entity",
      headers: {},
      config: { headers: new axios.AxiosHeaders() },
    });

    expect(getApiError(error)).toEqual({
      detail: "Dados inválidos",
      status: 422,
      errors: [{ field: "email", message: "Email inválido" }],
    });
    expect(getApiError(new Error("local"))).toEqual({ errors: [] });
  });

  it("não tenta refresh para falha de login", async () => {
    const mock = new MockAdapter(api);
    mock.onPost("/auth/login").reply(401, { detail: "Credenciais inválidas" });
    mock.onPost("/auth/refresh").reply(200);

    await expect(api.post("/auth/login", {})).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(mock.history.post.filter((request) => request.url === "/auth/refresh")).toHaveLength(0);
    mock.restore();
  });

  it("não tenta refresh em uma rota pública de autenticação", async () => {
    const mock = new MockAdapter(api);
    mock.onPost("/auth/verify-email/token").reply(401);
    mock.onPost("/auth/refresh").reply(200);

    await expect(api.post("/auth/verify-email/token")).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(mock.history.post.filter((request) => request.url === "/auth/refresh")).toHaveLength(0);
    mock.restore();
  });

  it("renova uma vez e repete uma requisição expirada", async () => {
    const mock = new MockAdapter(api);
    let attempts = 0;
    mock.onGet("/users/me").reply(() => {
      attempts += 1;
      return attempts === 1 ? [401] : [200, { id: "user-1" }];
    });
    mock.onPost("/auth/refresh").reply(200);

    await expect(api.get("/users/me")).resolves.toMatchObject({ status: 200 });
    expect(attempts).toBe(2);
    expect(mock.history.post.filter((request) => request.url === "/auth/refresh")).toHaveLength(1);
    mock.restore();
  });
});
