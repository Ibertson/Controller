import { describe, expect, it } from "vitest";
import { categoriesOver, projection, topSlices, yearKpis, yearMonths, yearsWithData } from "./analytics";
import type { Snapshot, Transaction } from "./types";

const tx = (id: string, kind: "income" | "expense", amountCents: number, occurredOn: string, categoryId: string | null = null) =>
  ({ id, kind, amountCents, occurredOn, categoryId, statementMonth: null, isPaid: true }) as unknown as Transaction;
const snap = (transactions: Transaction[]) => ({ transactions, categories: [{ id: "c1", name: "Vendas", parentId: null }, { id: "c2", name: "Aluguel", parentId: null }] }) as unknown as Snapshot;

describe("Analytics", () => {
  const s = snap([
    tx("a", "income", 100000, "2026-08-05", "c1"), tx("b", "income", 50000, "2026-09-05", "c1"), tx("c", "income", 150000, "2026-10-05"),
    tx("d", "expense", 60000, "2026-08-10", "c2"), tx("e", "expense", 30000, "2026-10-10", "c2"), tx("f", "expense", 10000, "2025-03-10"),
    tx("g", "income", 200000, "2026-11-02", "c1"),
  ]);
  it("meses do ano", () => {
    expect(yearMonths(2026)[0]).toBe("2026-01-01");
    expect(yearMonths(2026)[11]).toBe("2026-12-01");
  });
  it("indicadores do ano", () => {
    expect(yearKpis(s, 2026)).toEqual({ incomeCents: 500000, expenseCents: 90000, profitCents: 410000, margin: 82, expensePct: 18, salesCount: 4, ticketCents: 125000 });
    expect(yearKpis(s, 2024)).toEqual({ incomeCents: 0, expenseCents: 0, profitCents: 0, margin: 0, expensePct: 0, salesCount: 0, ticketCents: 0 });
  });
  it("anos com lançamentos", () => {
    expect(yearsWithData(s, 2026)).toEqual([2026, 2025]);
  });
  it("projeção pela média dos 3 meses fechados", () => {
    const p = projection(s, 2026, "2026-11-01");
    expect(p.baseMonths).toEqual(["2026-08-01", "2026-09-01", "2026-10-01"]);
    expect(p.baseIncomeCents).toBe(100000);
    expect(p.baseExpenseCents).toBe(30000);
    expect(p.firstProjected).toBe(11);
    expect(p.months[10]).toMatchObject({ incomeCents: 200000, projected: false });
    expect(p.months[11]).toMatchObject({ incomeCents: 100000, expenseCents: 30000, balanceCents: 70000, projected: true });
    expect(projection(s, 2025, "2026-11-01").firstProjected).toBe(12);
    expect(projection(s, 2027, "2026-11-01").firstProjected).toBe(0);
  });
  it("categorias somadas e agrupadas", () => {
    expect(categoriesOver(s, yearMonths(2026), "income")).toEqual([{ id: "c1", label: "Vendas", cents: 350000 }, { id: "outros", label: "Outros", cents: 150000 }]);
    const many = Array.from({ length: 8 }, (_, i) => ({ id: String(i), label: String(i), cents: 100 - i }));
    const top = topSlices(many, 4);
    expect(top).toHaveLength(4);
    expect(top[3]).toEqual({ id: "__rest", label: "Outras", cents: 97 + 96 + 95 + 94 + 93 });
  });
});
