import { getReferralRegistration } from "@/lib/referral";

describe("atribuição discreta de cadastro", () => {
  const code = "a".repeat(48);

  beforeEach(() => {
    localStorage.clear();
    document.cookie = "redator_ref=; max-age=0; path=/";
  });

  it("não gera identificador quando não há link de indicação", () => {
    expect(getReferralRegistration()).toEqual({});
    expect(localStorage.getItem("redator_device")).toBeNull();
  });

  it("preserva um identificador aleatório para detectar reuso no navegador", () => {
    document.cookie = `redator_ref=${code}; path=/`;
    const first = getReferralRegistration();
    const second = getReferralRegistration();
    expect(first.referral_code).toBe(code);
    expect(first.device_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.device_id).toBe(first.device_id);
  });

  it("ignora código malformado", () => {
    document.cookie = "redator_ref=invalid; path=/";
    expect(getReferralRegistration()).toEqual({});
  });
});
