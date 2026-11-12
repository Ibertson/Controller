import { describe, expect, it } from "vitest";
import { formatHours, parseHours, roundPrice, searchServices, serviceCategoryOptions, serviceTotals, suggestPrices } from "./services";
import type { Service } from "./types";

const svc = (o: Partial<Service>): Service => ({
  id: crypto.randomUUID(), name: "Serviço", category: "Serviços", description: "", priceCents: 10000, hours: 1, active: true, createdAt: "2026-11-12", ...o,
});

describe("duração", () => {
  it("lê vírgula ou ponto e recusa zero e texto", () => {
    expect(parseHours("2,5")).toBe(2.5);
    expect(parseHours("3")).toBe(3);
    expect(parseHours("0")).toBeNull();
    expect(parseHours("abc")).toBeNull();
  });
  it("mostra horas e minutos", () => {
    expect(formatHours(2.5)).toBe("2h30");
    expect(formatHours(1)).toBe("1h");
    expect(formatHours(0.25)).toBe("15min");
  });
});

describe("sugestões de preço", () => {
  it("usa o valor por hora dos serviços da mesma categoria", () => {
    const list = [svc({ category: "Serviços", priceCents: 20000, hours: 2 }), svc({ category: "Comissões", priceCents: 90000, hours: 1 })];
    const s = suggestPrices(list, { category: "Serviços", hours: 3, priceCents: null })!;
    expect(s).toEqual({ economic: 21000, recommended: 30000, premium: 42000, basis: "similar" });
  });
  it("sem a categoria usa todos; sem histórico usa o valor digitado; sem nada não sugere", () => {
    expect(suggestPrices([svc({ priceCents: 10000, hours: 1 })], { category: "Vendas", hours: 2, priceCents: null })?.basis).toBe("mine");
    expect(suggestPrices([], { category: "", hours: null, priceCents: 65000 })).toEqual({ economic: 45500, recommended: 65000, premium: 91000, basis: "typed" });
    expect(suggestPrices([], { category: "", hours: 2, priceCents: null })).toBeNull();
  });
  it("arredonda para valores redondos", () => {
    expect(roundPrice(4567)).toBe(4600);
    expect(roundPrice(45678)).toBe(45500);
    expect(roundPrice(123456)).toBe(123000);
  });
});

describe("lista", () => {
  it("totais, busca e categorias", () => {
    const list = [svc({ name: "Consultoria", priceCents: 30000, hours: 2 }), svc({ name: "Instalação elétrica", priceCents: 10000, hours: 1, active: false })];
    expect(serviceTotals(list)).toEqual({ count: 2, active: 1, avgPriceCents: 30000, avgHourlyCents: 15000 });
    expect(searchServices(list, "instalacao").map((s) => s.name)).toEqual(["Instalação elétrica"]);
    expect(serviceCategoryOptions(["Aulas"]).map((c) => c.name)).toEqual(["Vendas", "Serviços", "Comissões", "Outros", "Aulas"]);
  });
});
