import { expect, test } from "@playwright/test";

const today = new Date().toISOString().slice(0, 10);
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  full_name: "Equipe Comercial",
  email: "comercial@example.test",
  user_type: "student",
  plan: "free",
  is_email_verified: true,
  created_at: new Date().toISOString(),
  admin_role: "sales",
  has_stripe_subscription: false,
  teacher_student_slots: 0,
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const json = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (path.endsWith("/users/me")) return json(user);
    if (path.endsWith("/marketing/dashboard")) return json({
      clicks: 120, signups: 18, paid_conversions: 5, first_payment_cents: 9495,
      lead_status: { new: 2, contacted: 1, negotiating: 1, converted: 0, lost: 0 },
      daily: Array.from({ length: 30 }, (_, index) => ({
        date: new Date(Date.now() - (29 - index) * 86400000).toISOString().slice(0, 10),
        clicks: index % 8 + 1, signups: index % 3, paid: index % 11 === 0 ? 1 : 0, leads: index % 7 === 0 ? 1 : 0,
      })),
    });
    if (path.endsWith("/marketing/sellers")) return json([{ id: user.id, name: user.full_name }]);
    if (path.endsWith("/marketing/referrals") && method === "GET") return json([{
      id: "22222222-2222-4222-8222-222222222222", owner_id: user.id,
      owner_name: user.full_name, url: "https://redator.online/r/" + "a".repeat(48),
      is_active: true, clicks: 120, signups: 18, paid_conversions: 5, first_payment_cents: 9495,
    }]);
    if (path.endsWith("/marketing/leads") && method === "GET") return json({
      items: [{ id: "33333333-3333-4333-8333-333333333333", owner_id: user.id,
        owner_name: user.full_name, name: "Contato Exemplo", email: "contato@example.test",
        phone: null, notes: "", status: "new", created_at: today, updated_at: today }],
      total: 1,
    });
    if (method === "POST" || method === "PATCH") return json({}, 201);
    return json({ detail: "Unexpected API call" }, 404);
  });
});

test("dashboard de marketing mostra o funil e permite navegar pelo CRM", async ({ page }, testInfo) => {
  await page.goto("/marketing");
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
  await expect(page.getByText("Assinaturas confirmadas")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Funil de indicação" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Atividade dos últimos 30 dias" })).toBeVisible();
  if (process.env.MARKETING_VISUAL_CAPTURE) {
    await page.screenshot({ path: `test-results/marketing-${testInfo.project.name}.png`, fullPage: true });
  }

  if (testInfo.project.name.startsWith("mobile")) {
    const menuButton = page.getByRole("button", { name: "Abrir menu" });
    await menuButton.click();
    await expect(page.locator('[aria-controls="marketing-nav"]')).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("dialog", { name: "Menu de marketing" })).toBeVisible();
  }
  await page.getByRole("button", { name: "Leads", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contatos" })).toBeVisible();
  await expect(page.getByText("Contato Exemplo")).toBeVisible();
  await page.getByRole("button", { name: "Editar" }).click();
  await expect(page.getByRole("button", { name: "Salvar alterações" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Contato Exemplo" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Contato Exemplo" })).toHaveCount(0);
});
