import { describe, expect, it } from "vitest";
import { applyMovement, monthTotals, stockSummary } from "./stock";
import type { Product } from "./types";

const prod = (o: Partial<Product>): Product => ({
  id: "p", name: "Capuccino", category: "", description: "", sku: "", unit: "un", costCents: 600, priceCents: 1500,
  stock: 60, minStock: 30, photo: null, active: true, createdAt: "", expiresOn: null, ...o,
});

describe("movimentação", () => {
  it("entrada soma e faz o custo médio", () => {
    const p = applyMovement(prod({}), { kind: "in", qty: 40, unitCostCents: 800, expiresOn: null });
    expect(p.stock).toBe(100);
    expect(p.costCents).toBe(680);
    expect(applyMovement(prod({}), { kind: "in", qty: 10, unitCostCents: null, expiresOn: null }).costCents).toBe(600);
  });
  it("saída subtrai e não passa do estoque", () => {
    expect(applyMovement(prod({}), { kind: "out", qty: 2.5, unitCostCents: null, expiresOn: null }).stock).toBe(57.5);
    expect(() => applyMovement(prod({}), { kind: "out", qty: 61, unitCostCents: null, expiresOn: null })).toThrow(/maior que o estoque/);
    expect(() => applyMovement(prod({}), { kind: "in", qty: 0, unitCostCents: null, expiresOn: null })).toThrow();
  });
  it("guarda a validade mais próxima e limpa quando zera", () => {
    let p = applyMovement(prod({ stock: 0 }), { kind: "in", qty: 5, unitCostCents: null, expiresOn: "2026-12-20" });
    p = applyMovement(p, { kind: "in", qty: 5, unitCostCents: null, expiresOn: "2026-12-01" });
    expect(p.expiresOn).toBe("2026-12-01");
    p = applyMovement(p, { kind: "in", qty: 5, unitCostCents: null, expiresOn: "2027-01-10" });
    expect(p.expiresOn).toBe("2026-12-01");
    expect(applyMovement(p, { kind: "out", qty: 15, unitCostCents: null, expiresOn: null }).expiresOn).toBeNull();
  });
});

describe("resumo", () => {
  it("baixo, validade em 30 dias e valor a custo", () => {
    const list = [prod({}), prod({ id: "b", stock: 10, expiresOn: "2026-12-05" }), prod({ id: "c", stock: 0, expiresOn: "2026-11-20" })];
    expect(stockSummary(list, "2026-11-13")).toEqual({ low: 2, expiring: 1, valueCents: 42000 });
  });
  it("totais do mês", () => {
    const m = (kind: "in" | "out", qty: number, c: number) => ({ id: "", productId: "", productName: "", kind, qty, unitCostCents: c, note: "", expiresOn: null, occurredOn: "", createdAt: "" });
    expect(monthTotals([m("in", 10, 600), m("out", 3, 600)])).toEqual({ inQty: 10, inCents: 6000, outQty: 3, outCents: 1800 });
  });
});
