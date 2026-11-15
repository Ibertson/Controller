import { describe, expect, it } from "vitest";
import { dueDate, effectiveRate, guideExpense, rbt12, simplesGuide, yearProgress } from "./fiscal";
import { emptySnapshot } from "./data/seed";
import { buildTransactions } from "./transactions";
import type { Snapshot } from "./types";

let n = 0;
const id = () => `id${++n}`;
const biz = (): Snapshot => emptySnapshot(id, { name: "Loja", cnpj: null, activity: "Comércio", companyType: "me_simples" });
function income(s: Snapshot, day: string, cents: number, description = "Venda") {
  const acc = s.accounts[0]?.id ?? null;
  s.transactions.push(...buildTransactions({ kind: "income", amountCents: cents, occurredOn: day, description, accountId: acc, isPaid: true }, { workspaceId: s.workspace.id, newId: id, now: "2026-01-01T00:00:00Z" }));
}

describe("alíquota efetiva", () => {
  it("primeira faixa usa a nominal", () => {
    expect(effectiveRate(1, 10_000_000)?.effective).toBe(4);
    expect(effectiveRate(3, 0)?.effective).toBe(6);
  });
  it("segunda faixa desconta a parcela", () => {
    // Anexo I, RBT12 R$ 300.000: (300000 × 7,3% − 5940) / 300000 = 5,32%
    const r = effectiveRate(1, 30_000_000)!;
    expect(r.faixa).toBe(2);
    expect(r.effective).toBe(5.32);
    // RBT12 R$ 240.000: 4,825% exatos; a guia usa o valor sem arredondar
    expect(effectiveRate(1, 24_000_000)?.exact).toBeCloseTo(4.825, 6);
  });
  it("acima de 4,8 milhões não calcula", () => {
    expect(effectiveRate(1, 480_000_001)).toBeNull();
  });
});

describe("guia do Simples", () => {
  it("vence dia 20 do mês seguinte, ou na segunda", () => {
    expect(dueDate("2026-11-01")).toBe("2026-12-21"); // 20/12/2026 é domingo
    expect(dueDate("2026-09-01")).toBe("2026-10-20");
    expect(dueDate("2026-05-01")).toBe("2026-06-22"); // sábado
  });
  it("empresa nova usa a média dos meses × 12", () => {
    const s = biz();
    income(s, "2026-09-10", 1_000_000);
    income(s, "2026-10-10", 2_000_000);
    income(s, "2026-11-05", 3_000_000);
    expect(rbt12(s, "2026-11-01")).toEqual({ cents: 18_000_000, proportional: true });
    const g = simplesGuide(s, "2026-11-01", 1);
    expect(g.revenueCents).toBe(3_000_000);
    expect(g.valueCents).toBe(120_000); // 4% de R$ 30.000
    expect(rbt12(s, "2026-09-01")).toEqual({ cents: 12_000_000, proportional: true });
  });
  it("acha a guia já lançada pela referência", () => {
    const s = biz();
    s.transactions.push(...buildTransactions({ kind: "expense", amountCents: 5000, occurredOn: "2026-12-21", description: "DAS Simples Nacional 11/2026", accountId: s.accounts[0].id, isPaid: false, dueOn: "2026-12-21" }, { workspaceId: s.workspace.id, newId: id, now: "2026-01-01T00:00:00Z" }));
    expect(guideExpense(s, "2026-11-01")?.amountCents).toBe(5000);
    expect(guideExpense(s, "2026-10-01")).toBeUndefined();
  });
});

describe("meta de faturamento anual", () => {
  it("soma o ano até o mês corrente e projeta", () => {
    const s = biz();
    income(s, "2026-01-15", 6_000_000);
    income(s, "2026-02-15", 3_000_000);
    income(s, "2025-12-15", 9_900_000);
    const y = yearProgress(s, 2026, "2026-03-10", 36_000_000);
    expect(y.billedCents).toBe(9_000_000);
    expect(y.availableCents).toBe(27_000_000);
    expect(y.projectionCents).toBe(36_000_000);
    expect(y.pct).toBe(25);
    expect(y.months.map((m) => m.pct)).toEqual([16.7, 25, 25]);
  });
});
