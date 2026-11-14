import { describe, expect, it } from "vitest";
import { filterOrders, formatOrderNumber, isLate, nextOrderNumber, orderSummary, orderTotals } from "./orders";
import type { Order } from "./types";

const o = (x: Partial<Order>): Order => ({
  id: "o", number: 1, clientId: null, clientName: "", orderedOn: "2026-11-14", deliveryOn: null, notes: "", items: [], discountCents: 0, status: "novo", createdAt: "", ...x,
});
const item = (qty: number, unitCents: number) => ({ id: "i", productId: null, serviceId: null, name: "x", description: "", qty, unitCents });

describe("Pedidos", () => {
  it("numera PED-0001 em diante", () => {
    expect(formatOrderNumber(7)).toBe("PED-0007");
    expect(nextOrderNumber([])).toBe(1);
    expect(nextOrderNumber([{ number: 3 }, { number: 9 }])).toBe(10);
  });
  it("soma itens e tira o desconto sem ficar negativo", () => {
    expect(orderTotals([item(2, 1500), item(1.5, 1000)], 500)).toEqual({ subtotal: 4500, discount: 500, total: 4000 });
    expect(orderTotals([item(1, 100)], 500).total).toBe(0);
  });
  it("resumo ignora cancelados no valor", () => {
    const list = [o({ id: "a", items: [item(1, 1000)] }), o({ id: "b", status: "entregue", items: [item(1, 2000)] }), o({ id: "c", status: "cancelado", items: [item(1, 9999)] })];
    expect(orderSummary(list)).toEqual({ count: 3, open: 1, totalCents: 3000 });
  });
  it("busca por número ou cliente sem acento", () => {
    const list = [o({ id: "a", number: 7, clientName: "José Araújo" }), o({ id: "b", number: 12, clientName: "Maria" })];
    expect(filterOrders(list, "jose", "all").map((x) => x.id)).toEqual(["a"]);
    expect(filterOrders(list, "PED-0012", "all").map((x) => x.id)).toEqual(["b"]);
    expect(filterOrders(list, "7", "all").map((x) => x.id)).toEqual(["a"]);
    expect(filterOrders(list, "", "all").map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("atrasado só se aberto e a entrega passou", () => {
    expect(isLate(o({ deliveryOn: "2026-11-10" }), "2026-11-14")).toBe(true);
    expect(isLate(o({ deliveryOn: "2026-11-10", status: "entregue" }), "2026-11-14")).toBe(false);
  });
});
