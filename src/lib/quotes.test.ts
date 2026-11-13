import { describe, expect, it } from "vitest";
import { DEFAULT_QUOTE_CATALOG, calcBudget, cleanCatalog, effectiveStatus, filterQuotes, formatNumber, itemsFromCalc, nextNumber, quoteTotals, searchCatalog, statusCounts, whatsappShare } from "./quotes";
import type { Quote } from "./types";

const quote = (o: Partial<Quote>): Quote => ({
  id: crypto.randomUUID(), number: 1, kind: "personalizado", category: "", title: "", clientName: "Ana", clientPhone: "", clientEmail: "",
  issuedOn: "2026-11-10", validUntil: "2026-11-25", status: "enviado", items: [], discountCents: 0, notes: "", token: crypto.randomUUID(),
  viewedAt: null, company: { name: "Emp", cnpj: null, email: "", city: "", uf: "" }, createdAt: "", ...o,
});

describe("catálogo", () => {
  it("busca por categoria inteira ou só pelas subcategorias, sem acento", () => {
    expect(searchCatalog(DEFAULT_QUOTE_CATALOG, "marmoraria")[0].items.length).toBe(8);
    const r = searchCatalog(DEFAULT_QUOTE_CATALOG, "pintura");
    expect(r.map((c) => c.name)).toEqual(["Construção & Reforma", "Estética Automotiva"]);
    expect(r[0].items).toEqual(["Pintura interna", "Pintura externa"]);
    expect(searchCatalog(DEFAULT_QUOTE_CATALOG, "climatizacao")[0].name).toBe("Climatização");
  });
  it("limpa nomes vazios e repetidos antes de salvar", () => {
    const r = cleanCatalog([{ id: "a", name: " Pets ", icon: "tag", items: ["Banho", " banho", "", "Tosa"] }, { id: "b", name: "pets", icon: "tag", items: [] }, { id: "c", name: "", icon: "tag", items: ["x"] }]);
    expect(r).toEqual([{ id: "a", name: "Pets", icon: "tag", items: ["Banho", "Tosa"] }]);
  });
});

describe("orçamento", () => {
  it("totais com desconto limitado ao subtotal", () => {
    const items = [{ id: "1", description: "a", qty: 2, unitCents: 1500 }, { id: "2", description: "b", qty: 1.5, unitCents: 1000 }];
    expect(quoteTotals({ items, discountCents: 500 })).toEqual({ subtotal: 4500, discount: 500, total: 4000 });
    expect(quoteTotals({ items, discountCents: 99999 }).total).toBe(0);
  });
  it("vence só quem aguarda resposta e passou da validade", () => {
    expect(effectiveStatus({ status: "visualizado", validUntil: "2026-11-01" }, "2026-11-13")).toBe("vencido");
    expect(effectiveStatus({ status: "aprovado", validUntil: "2026-11-01" }, "2026-11-13")).toBe("aprovado");
    expect(effectiveStatus({ status: "enviado", validUntil: "2026-11-13" }, "2026-11-13")).toBe("enviado");
  });
  it("numera, filtra e conta", () => {
    const list = [quote({ number: 1, clientName: "José Souza" }), quote({ number: 2, status: "aprovado", issuedOn: "2026-10-02" }), quote({ number: 7, validUntil: "2026-11-01" })];
    expect(nextNumber(list)).toBe(8);
    expect(formatNumber(7)).toBe("ORC-0007");
    const now = "2026-11-13";
    expect(filterQuotes(list, { q: "jose", status: "all", month: "all" }, now).length).toBe(1);
    expect(filterQuotes(list, { q: "ORC-0002", status: "all", month: "all" }, now)[0].number).toBe(2);
    expect(filterQuotes(list, { q: "", status: "vencido", month: "all" }, now)[0].number).toBe(7);
    expect(filterQuotes(list, { q: "", status: "all", month: "current" }, now).map((q) => q.number)).toEqual([1, 7]);
    expect(statusCounts(list, now)).toMatchObject({ enviado: 1, aprovado: 1, vencido: 1 });
  });
  it("link do WhatsApp com DDI do Brasil", () => {
    expect(whatsappShare("(11) 98765-4321", "oi")).toBe("https://wa.me/5511987654321?text=oi");
  });
});

describe("calculadora", () => {
  it("margem sobre o custo, impostos sobre o valor com margem e desconto no fim", () => {
    expect(calcBudget({ materials: 100000, labor: 50000, marginPct: 20, taxPct: 10, discount: 8000 })).toEqual({ subtotal: 150000, margin: 30000, taxes: 18000, total: 190000 });
  });
  it("vira itens que somam o mesmo valor", () => {
    let n = 0;
    const items = itemsFromCalc({ materials: 33333, labor: 10001, marginPct: 17, taxPct: 6.5, discount: 0 }, () => String(++n));
    const r = calcBudget({ materials: 33333, labor: 10001, marginPct: 17, taxPct: 6.5, discount: 0 });
    expect(items.map((i) => i.description)).toEqual(["Materiais", "Mão de obra"]);
    expect(items.reduce((t, i) => t + i.unitCents, 0)).toBe(r.total);
  });
});
