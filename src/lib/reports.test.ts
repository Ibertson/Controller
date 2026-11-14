import { describe, expect, it } from "vitest";
import { buildReport, periodLabel, periodMonths, reportSheets, revenueLimit, type ReportData } from "./reports";
import type { Snapshot, Transaction } from "./types";

const tx = (id: string, kind: "income" | "expense", amountCents: number, occurredOn: string, extra: Partial<Transaction> = {}) =>
  ({ id, kind, amountCents, occurredOn, description: kind === "income" ? "Venda" : "Gasto", categoryId: null, accountId: "a1", personId: null, statementMonth: null, isPaid: true, createdAt: occurredOn, ...extra }) as Transaction;

const snap = {
  categories: [{ id: "imp", name: "Impostos (DAS)", parentId: null }, { id: "al", name: "Aluguel", parentId: null }, { id: "sub", name: "Luz", parentId: "al" }],
  accounts: [{ id: "a1", name: "Conta PJ" }], people: [{ id: "pe", name: "Maria" }],
  transactions: [
    tx("i1", "income", 100000, "2026-11-03", { personId: "pe" }), tx("i2", "income", 50000, "2026-11-10", { isPaid: false }), tx("i3", "income", 30000, "2026-11-20"),
    tx("i0", "income", 200000, "2026-02-10"),
    tx("e1", "expense", 7590, "2026-11-20", { categoryId: "imp" }), tx("e2", "expense", 40000, "2026-11-05", { categoryId: "sub" }),
    tx("e3", "expense", 9000, "2026-10-05", { description: "Guia DAS outubro" }),
  ],
} as unknown as Snapshot;
const data: ReportData = {
  snap, companyType: "mei", clients: [{ id: "c1", name: "Padaria Sol", phone: "", kind: "recorrente", notes: "", deletedAt: null, createdAt: "" }],
  receivables: [{ id: "r", groupId: "g", description: "", amountCents: 30000, dueOn: "2026-11-20", clientId: "c1", installment: 1, installments: 1, receivedOn: "2026-11-20", transactionId: "i3", deletedAt: null, createdAt: "" }],
  details: [{ transactionId: "e2", type: "despesa", supplier: "Imobiliária", employee: "", groupId: null, installment: null, installments: null, paymentMethod: "pix", receiptPath: "x/y.pdf" }],
  prolabore: [{ id: "p", month: "2026-11", amountCents: 20000, revenueCents: 0, expenseTxId: null, personalTxId: null, personalAccountName: "", createdAt: "2026-11-25T10:00:00Z" }],
};
const nov = { kind: "mensal" as const, year: 2026, month: 11, quarter: 4 };

describe("Relatórios", () => {
  it("períodos", () => {
    expect(periodMonths({ kind: "trimestral", year: 2026, month: 1, quarter: 4 })).toEqual(["2026-10-01", "2026-11-01", "2026-12-01"]);
    expect(periodMonths({ kind: "anual", year: 2026, month: 1, quarter: 1 })).toHaveLength(12);
    expect(periodLabel(nov)).toBe("Novembro/2026");
    expect(periodLabel({ kind: "trimestral", year: 2026, month: 1, quarter: 3 })).toBe("3º trimestre/2026");
    expect(revenueLimit("mei")).toBe(8100000);
    expect(revenueLimit("presumido")).toBeNull();
  });
  it("geral: faturamento, despesas, DAS e limite do ano", () => {
    const r = buildReport("geral", data, nov);
    expect(r.kpis.map((k) => k.value.replace(/\s/g, " "))).toEqual(["R$ 1.800,00", "R$ 475,90", "R$ 1.324,10", "R$ 75,90"]);
    expect(r.extra?.pct).toBe(4.7); // 3.800 de 81.000
    const tri = buildReport("geral", data, { kind: "trimestral", year: 2026, month: 1, quarter: 4 });
    expect(tri.sections[0].rows.map((x) => x[4])).toEqual([9000, 7590, 0]);
    expect(tri.sections[0].total).toEqual(["Total", 180000, 56590, 123410, 16590]);
  });
  it("vendas e clientes", () => {
    const v = buildReport("vendas", data, nov);
    expect(v.sections[0].rows.map((x) => x[2])).toEqual(["Maria", "Sem cliente identificado", "Padaria Sol"]);
    expect(v.kpis[3].value.replace(/\s/g, " ")).toBe("R$ 500,00");
    const c = buildReport("clientes", data, nov);
    expect(c.sections[0].rows).toEqual([[1, "Maria", 1, 100000, 55.6], [2, "Sem cliente identificado", 1, 50000, 27.8], [3, "Padaria Sol", 1, 30000, 16.7]]);
  });
  it("despesas por categoria pai, fornecedor e forma", () => {
    const r = buildReport("despesas", data, nov);
    expect(r.sections[0].rows).toEqual([["Aluguel", 1, 40000, 22.2], ["Impostos (DAS)", 1, 7590, 4.2]]);
    expect(r.sections[1].rows[0][0]).toBe("Imobiliária");
    expect(r.sections[2].rows.map((x) => x[0])).toEqual(["PIX", "Não informado"]);
  });
  it("contador e planilha", () => {
    const r = buildReport("contador", data, nov);
    expect(r.sections[1].rows.find((x) => x[1] === "Gasto" && x[6] === "Sim")).toBeTruthy();
    expect(r.sections[3].rows).toEqual([["Novembro/2026", "25/11/2026", 20000]]);
    const sheets = reportSheets(r, "Loja");
    expect(sheets.map((s) => s.name)).toEqual(["Resumo", "Receitas", "Despesas", "DAS pagos", "Pró-labore"]);
    expect(sheets[1].rows[1][5]).toBe(1000);
    expect(sheets[1].money).toEqual([5]);
  });
});
