import { describe, expect, it } from "vitest";
import { addToCart, cartTotals, changeDue, daySales, formatSaleNumber, nextSaleNumber, productByCode, registerState, saleDescription, searchProducts, setQty } from "./pos";
import type { CashRegister, PosSale, Product } from "./types";

const P = (id: string, name: string, stock: number, price = 1500, extra: Partial<Product> = {}) =>
  ({ id, name, category: "Mercadorias", description: "", sku: "", unit: "un", costCents: 500, priceCents: price, stock, minStock: 0, photo: null, active: true, createdAt: "", ...extra }) as Product;

describe("Ponto de Venda", () => {
  it("busca e código de barras", () => {
    const list = [P("a", "Capuccino", 60, 1500, { sku: "789100" }), P("b", "Café expresso", 10), P("c", "Antigo", 5, 100, { active: false })];
    expect(searchProducts(list, "cafe").map((p) => p.id)).toEqual(["b"]);
    expect(searchProducts(list, "").map((p) => p.id)).toEqual(["b", "a"]);
    expect(productByCode(list, "789100")?.id).toBe("a");
    expect(productByCode(list, "7891")).toBeUndefined();
  });
  it("carrinho respeita o estoque", () => {
    const cap = P("a", "Capuccino", 2);
    let r = addToCart([], cap);
    r = addToCart(r.cart, cap);
    expect(r.cart[0].qty).toBe(2);
    expect(addToCart(r.cart, cap).error).toMatch(/Só há 2/);
    expect(addToCart([], P("z", "Zerado", 0)).error).toMatch(/sem estoque/);
    expect(setQty(r.cart, "a", 9)[0].qty).toBe(2);
    expect(setQty(r.cart, "a", 0)).toEqual([]);
  });
  it("totais, desconto e troco", () => {
    expect(cartTotals([{ qty: 2, unitCents: 1500 }, { qty: 1, unitCents: 350 }], 500)).toEqual({ subtotal: 3350, discount: 500, total: 2850, units: 3 });
    expect(cartTotals([{ qty: 1, unitCents: 1000 }], 5000).total).toBe(0);
    expect(changeDue(2850, 5000)).toBe(2150);
    expect(changeDue(2850, 2000)).toBeNull();
    expect(changeDue(2850, null)).toBe(0);
  });
  it("numeração, descrição, caixa e vendas do dia", () => {
    expect(formatSaleNumber(3)).toBe("VEN-0003");
    expect(nextSaleNumber([{ number: 2 }, { number: 7 }])).toBe(8);
    expect(saleDescription(3, [{ productId: "a", name: "Capuccino", qty: 2, unitCents: 1500 }])).toBe("Venda VEN-0003: Capuccino x2");
    const regs = [{ day: "2026-11-14", status: "open" }, { day: "2026-11-13", status: "closed" }] as CashRegister[];
    expect(registerState(regs, "2026-11-14")).toBe("aberto");
    expect(registerState(regs, "2026-11-13")).toBe("fechado");
    expect(registerState(regs, "2026-11-12")).toBe("nao_iniciado");
    const sales = [{ number: 1, soldOn: "2026-11-14", status: "concluida", totalCents: 100 }, { number: 2, soldOn: "2026-11-14", status: "cancelada", totalCents: 50 }, { number: 3, soldOn: "2026-11-13", status: "concluida", totalCents: 70 }] as PosSale[];
    expect(daySales(sales, "2026-11-14")).toMatchObject({ count: 1, totalCents: 100 });
    expect(daySales(sales, "2026-11-14").sales.map((s) => s.number)).toEqual([2, 1]);
  });
});
