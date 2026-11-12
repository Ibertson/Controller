import { describe, expect, it } from "vitest";
import { bioProblem, cleanSlug, defaultBio, instagramUrl, randomSlug, safeUrl, switchTemplate, validSlug, whatsappUrl } from "./bio";

describe("link bio", () => {
  it("endereço", () => {
    expect(cleanSlug("Emp Mag Juvino!")).toBe("emp-mag-juvino-");
    expect(cleanSlug("São João")).toBe("sao-joao");
    expect(validSlug("emp-mag")).toBe(true);
    expect(validSlug("ab")).toBe(false);
    expect(validSlug("emp-")).toBe(false);
    expect(validSlug(randomSlug())).toBe(true);
  });
  it("links de contato", () => {
    expect(whatsappUrl("(11) 99999-8888")).toMatch(/^https:\/\/wa\.me\/5511999998888\?text=/);
    expect(whatsappUrl("123")).toBeNull();
    expect(instagramUrl("@loja.x")).toBe("https://instagram.com/loja.x");
    expect(instagramUrl("https://instagram.com/loja_x/")).toBe("https://instagram.com/loja_x");
    expect(safeUrl("loja.com.br/catalogo")).toBe("https://loja.com.br/catalogo");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
  });
  it("troca de modelo mantém o que foi escrito", () => {
    const d = defaultBio(null, "vitrine");
    const s = switchTemplate(d, "sabor");
    expect(s.servicesTitle).toBe("Cardápio");
    expect(s.cta).toBe("Fazer pedido");
    const custom = switchTemplate({ ...d, cta: "Fale comigo" }, "sabor");
    expect(custom.cta).toBe("Fale comigo");
  });
  it("confere antes de salvar", () => {
    const data = { ...defaultBio(null), name: "Loja" };
    expect(bioProblem({ slug: "loja", published: true, data })).toBeNull();
    expect(bioProblem({ slug: "loja", published: true, data: { ...data, links: [{ id: "1", label: "X", url: "javascript:1" }] } })).toMatch(/link/);
    expect(bioProblem({ slug: "lo", published: true, data })).toMatch(/endereço/);
  });
});
