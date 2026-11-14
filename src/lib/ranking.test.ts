import { describe, expect, it } from "vitest";
import { monthDates, productRanking, rangeDates, rankBy } from "./ranking";
import type { Order, Product } from "./types";

const prod = (id: string, name: string, costCents: number) => ({ id, name, costCents }) as Product;
const item = (productId: string | null, qty: number, unitCents: number, name = "x") => ({ id: Math.random().toString(), productId, serviceId: null, name, description: "", qty, unitCents });
const order = (id: string, orderedOn: string, items: ReturnType<typeof item>[], discountCents = 0, status = "entregue") =>
  ({ id, number: 1, clientId: null, clientName: "", orderedOn, deliveryOn: null, notes: "", items, discountCents, status, createdAt: "" }) as unknown as Order;

describe("Ranking de produtos", () => {
  it("períodos", () => {
    expect(rangeDates("30", "2026-11-14")).toEqual({ from: "2026-10-15", to: "2026-11-14" });
    expect(rangeDates("7", "2026-11-14")).toEqual({ from: "2026-11-07", to: "2026-11-14" });
    expect(rangeDates("ano", "2026-11-14")).toEqual({ from: "2026-01-01", to: "2026-11-14" });
    expect(monthDates("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
  it("soma pedidos do período, reparte desconto e ignora cancelados e serviços", () => {
    const products = [prod("a", "Bolo", 2000), prod("b", "Café", 0)];
    const orders = [
      order("1", "2026-11-10", [item("a", 2, 5000), item("b", 1, 1000), item(null, 1, 9999)], 1999),
      order("2", "2026-11-12", [item("a", 1, 5000)]),
      order("3", "2026-11-12", [item("a", 5, 5000)], 0, "cancelado"),
      order("4", "2026-09-01", [item("a", 5, 5000)]),
      order("5", "2026-11-13", [item("gone", 3, 1000, "Antigo")]),
    ];
    const r = productRanking(orders, products, "2026-10-15", "2026-11-14");
    // pedido 1: subtotal 20999, desconto 1999 → bolo 10000 − 952 = 9048; café 1000 − 95 = 905
    const bolo = r.items.find((i) => i.key === "a")!;
    expect(bolo).toMatchObject({ qty: 3, revenueCents: 14048, costCents: 6000, profitCents: 8048, noCost: false });
    expect(bolo.margin).toBe(57.3);
    expect(r.items.find((i) => i.key === "b")).toMatchObject({ revenueCents: 905, noCost: true, margin: 100 });
    expect(r.items.find((i) => i.key === "gone")).toMatchObject({ name: "Antigo", qty: 3, revenueCents: 3000, noCost: true });
    expect(r).toMatchObject({ revenueCents: 17953, units: 7, orders: 3, ticketCents: 5984 });
    expect(rankBy(r.items, "qty").map((i) => i.key)).toEqual(["a", "gone", "b"]);
    expect(rankBy(r.items, "revenueCents").map((i) => i.key)).toEqual(["a", "gone", "b"]);
    expect(bolo.share).toBe(78.2);
  });
});
