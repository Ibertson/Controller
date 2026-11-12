import { describe, expect, it } from "vitest";
import { PRODUCT_CATEGORIES, catalogTotals, categoryOptions, lowStock, marginPct, parseQty, searchProducts } from "./products";
import type { Product } from "./types";

const p = (o: Partial<Product>): Product => ({
  id: "1", name: "Camisa", category: "Roupas", description: "", sku: "", unit: "un", costCents: 3000, priceCents: 5000,
  stock: 10, minStock: 0, photo: null, active: true, createdAt: "2026-11-12", ...o,
});

describe("produtos", () => {
  it("margem sobre o preço de venda", () => {
    expect(marginPct({ costCents: 3000, priceCents: 5000 })).toBe(40);
    expect(marginPct({ costCents: 3000, priceCents: 0 })).toBeNull();
  });
  it("totais do catálogo", () => {
    const t = catalogTotals([p({}), p({ id: "2", stock: 2.5, priceCents: 1000, costCents: 400, minStock: 3 }), p({ id: "3", stock: -1 })]);
    expect(t).toEqual({ count: 3, units: 12.5, valueCents: 52500, costCents: 31000, low: 1 });
  });
  it("estoque baixo e quantidade", () => {
    expect(lowStock({ stock: 3, minStock: 3 })).toBe(true);
    expect(lowStock({ stock: 0, minStock: 0 })).toBe(false);
    expect(parseQty("1,5")).toBe(1.5);
    expect(parseQty("")).toBe(0);
    expect(parseQty("abc")).toBeNull();
  });
  it("busca sem acento", () => {
    expect(searchProducts([p({ name: "Pão de queijo" }), p({ id: "2", name: "Café", sku: "X1" })], "pao")).toHaveLength(1);
    expect(searchProducts([p({ name: "Pão" }), p({ id: "2", name: "Café", sku: "X1" })], "x1")[0].name).toBe("Café");
  });
});

describe("categoryOptions", () => {
  it("lista as fixas e acrescenta as próprias e a atual sem repetir", () => {
    const o = categoryOptions(["Uniformes", "vendas"], "Bebidas");
    expect(o.slice(0, PRODUCT_CATEGORIES.length).map((c) => c.name)).toEqual(PRODUCT_CATEGORIES.map((c) => c.name));
    expect(o.slice(PRODUCT_CATEGORIES.length).map((c) => c.name)).toEqual(["Uniformes", "Bebidas"]);
  });
});
