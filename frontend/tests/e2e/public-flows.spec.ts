import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("landing carrega conteúdo principal sem erro de console", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /Criar conta|Começar/i }).first()).toBeVisible();
  await expect(page.locator("#planos")).toBeAttached();
  expect(errors).toEqual([]);
});

test("navbar navega por scroll e atualiza o hash", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
  }
  await page.getByRole("link", { name: "Planos" }).first().click();
  await expect(page).toHaveURL(/#planos$/);
  await expect(page.locator("#planos")).toBeInViewport({ ratio: 0.15 });
});

test("pricing separa ofertas de aluno e professor", async ({ page }) => {
  await page.goto("/#planos");
  const pricing = page.locator("#planos");
  await expect(pricing.getByRole("heading", { name: "Standard" })).toBeVisible();
  await expect(pricing.getByText("10 correções por dia")).toBeVisible();

  await pricing.getByRole("button", { name: "Para professores" }).click();
  await expect(pricing.getByRole("heading", { name: "Professor Free" })).toBeVisible();
  await expect(pricing.getByText("Até 3 alunos ativos por turma")).toBeVisible();
  await expect(pricing.getByRole("heading", { name: "Standard" })).toHaveCount(0);
});

test("seleção de cadastro direciona para cada perfil", async ({ page }) => {
  await page.goto("/auth/register");
  await expect(page.getByRole("heading", { name: "Como você vai usar o Redator?" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Sou aluno/ })).toHaveAttribute("href", "/auth/register/aluno");
  await expect(page.getByRole("link", { name: /Sou professor/ })).toHaveAttribute("href", "/auth/register/professor");
});

test("login valida campos antes de chamar a API", async ({ page }) => {
  let apiCalls = 0;
  await page.route("**/api/v1/auth/login", async (route) => {
    apiCalls += 1;
    await route.fulfill({ status: 500 });
  });
  await page.goto("/auth/login");
  await page.getByRole("button", { name: "Entrar na minha conta" }).click();
  await expect(page.getByText("Digite um email válido")).toBeVisible();
  await expect(page.getByText("Digite sua senha")).toBeVisible();
  expect(apiCalls).toBe(0);
});

test("rota protegida redireciona visitante e preserva o destino", async ({ page }) => {
  await page.goto("/dashboard/aluno/historico");
  await expect(page).toHaveURL(/\/auth\/login\?redirect=%2Fdashboard%2Faluno%2Fhistorico$/);
});

test("login de professor usa resposta da API para escolher o dashboard", async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const body = url.pathname.endsWith("/users/me")
      ? {
          id: "teacher-e2e",
          full_name: "Professor Teste",
          email: "professor@teste.com",
          user_type: "teacher",
          plan: "free",
          is_email_verified: true,
          school_name: "Escola Teste",
          discipline: "Português",
          created_at: "2026-08-18T12:00:00Z",
          admin_role: null,
          has_stripe_subscription: false,
          teacher_student_slots: 0,
        }
      : {};
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.route("**/api/v1/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "set-cookie": "access_token=e2e-token; Path=/; HttpOnly; SameSite=Strict" },
      body: JSON.stringify({ user_type: "teacher" }),
    });
  });

  await page.goto("/auth/login");
  await page.context().addCookies([
    { name: "access_token", value: "e2e-token", domain: "127.0.0.1", path: "/" },
  ]);
  await page.getByLabel("Email").fill("professor@teste.com");
  await page.getByLabel("Senha", { exact: true }).fill("SenhaSegura123!");
  await page.getByRole("button", { name: "Entrar na minha conta" }).click();
  await expect(page).toHaveURL(/\/dashboard\/professor$/);
});

test("landing não possui violações críticas ou sérias de acessibilidade", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(blocking, blocking.map((item) => `${item.id}: ${item.help}`).join("\n")).toEqual([]);
});
