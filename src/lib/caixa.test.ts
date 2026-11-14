import { describe, expect, it } from "vitest";
import { cashDifference, cashTotals, dayTitle, monthGrid, sangriaError } from "./caixa";
import type { CashRegister } from "./types";

const reg = (o: Partial<CashRegister> = {}): CashRegister => ({
  id: "c", day: "2026-11-14", openingCents: 5000, movements: [], status: "open", countedCents: null, closedAt: null, notes: "", createdAt: "", ...o,
});
const mv = (kind: "reforco" | "sangria" | "venda", amountCents: number) => ({ id: kind + amountCents, kind, amountCents, reason: "", at: "" });

describe("Caixa Diário", () => {
  it("saldo esperado = abertura + reforços − sangrias + vendas em dinheiro", () => {
    const t = cashTotals(reg({ movements: [mv("reforco", 2000), mv("reforco", 1000), mv("sangria", 1500), mv("venda", 4000)] }));
    expect(t).toMatchObject({ reforcoCents: 3000, reforcoCount: 2, sangriaCents: 1500, sangriaCount: 1, vendaCents: 4000, expectedCents: 10500 });
  });
  it("diferença do fechamento", () => {
    expect(cashDifference(reg())).toBeNull();
    expect(cashDifference(reg({ countedCents: 4800 }))).toBe(-200);
    expect(cashDifference(reg({ countedCents: 5100 }))).toBe(100);
  });
  it("novembro de 2026 começa num domingo e tem 5 semanas", () => {
    const g = monthGrid("2026-11");
    expect(g).toHaveLength(5);
    expect(g[0][0]).toBe("2026-11-01");
    expect(g[4].slice(0, 2)).toEqual(["2026-11-29", "2026-11-30"]);
    expect(g[4][2]).toBeNull();
    expect(monthGrid("2026-12")[0].slice(0, 3)).toEqual([null, null, "2026-12-01"]);
  });
  it("título do dia", () => {
    expect(dayTitle("2026-11-14")).toEqual({ title: "sábado, 14", subtitle: "novembro de 2026" });
  });
  it("sangria não passa do saldo esperado", () => {
    expect(sangriaError(reg(), 5000)).toBeNull();
    expect(sangriaError(reg(), 5001)).toMatch(/maior/);
    expect(sangriaError(reg(), 0)).toMatch(/valor/);
  });
});
