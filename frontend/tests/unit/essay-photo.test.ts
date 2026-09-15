import { buildEssayPhotoFormData } from "@/lib/api/essay-photo";

describe("upload de foto da redação", () => {
  it("usa o contrato multipart esperado pelo backend", () => {
    const photo = new File(["imagem"], "redacao.jpg", { type: "image/jpeg" });

    const payload = buildEssayPhotoFormData({
      photo,
      essayType: "enem",
      theme: "  Desafios da educação brasileira  ",
      title: "  Minha redação  ",
    });

    expect(payload.get("photo")).toBe(photo);
    expect(payload.get("file")).toBeNull();
    expect(payload.get("essay_type")).toBe("enem");
    expect(payload.get("theme")).toBe("Desafios da educação brasileira");
    expect(payload.get("title")).toBe("Minha redação");
  });

  it("omite título vazio", () => {
    const photo = new File(["imagem"], "redacao.png", { type: "image/png" });
    const payload = buildEssayPhotoFormData({
      photo,
      essayType: "vestibular",
      theme: "Tema válido",
      title: "   ",
    });

    expect(payload.has("title")).toBe(false);
  });
});
