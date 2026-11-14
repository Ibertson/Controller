import { describe, expect, it } from "vitest";
import { byCategory, distinct, emptyAdvanced, expenseRows, expenseSummary, filterExpenses, type ExpenseFilter } from "./expenses";
import type { Category, ExpenseDetail, Transaction } from "./types";

const tx = (o: Partial<Transaction>): Transaction => ({
  id: "t", workspaceId: "w", kind: "expense", amountCents: 10000, occurredOn: "2026-11-10", description: "x", categoryId: null, accountId: "a",
  toAccountId: null, cardId: null, statementMonth: null, personId: null, installmentGroupId: null, installmentNumber: null, installmentTotal: null,
  isPaid: true, dueOn: null, source: "app", createdAt: "", ...o,
});
const det = (o: Partial<ExpenseDetail>): ExpenseDetail => ({ transactionId: "t", type: "despesa", supplier: "", employee: "", groupId: null, installment: null, installments: null, ...o });
const T = "2026-11-14";
const base: ExpenseFilter = { type: "all", quick: "all", month: "2026-11", ...emptyAdvanced };

describe("despesas", () => {
  const txs = [
    tx({ id: "1", categoryId: "c1" }),
    tx({ id: "2", amountCents: 50000, categoryId: "c2", occurredOn: "2026-11-05" }),
    tx({ id: "3", amountCents: 300000, occurredOn: "2026-11-05" }),
    tx({ id: "4", amountCents: 2000, isPaid: false, occurredOn: "2026-11-10", dueOn: "2026-11-10" }),
    tx({ id: "5", amountCents: 2000, isPaid: false, occurredOn: "2026-11-20", dueOn: "2026-11-20" }),
    tx({ id: "6", amountCents: 2000, isPaid: false, occurredOn: "2026-12-10", dueOn: "2026-12-10" }),
    tx({ id: "7", kind: "income" }), tx({ id: "8", deletedAt: "x" }),
  ];
  const dets = [det({ transactionId: "2", type: "compra", supplier: "Atacadão" }), det({ transactionId: "3", type: "folha", employee: "Ana" }),
    det({ transactionId: "4", groupId: "g", installment: 1, installments: 3 })];
  const rows = expenseRows(txs, dets, T);
  it("junta lançamento e dados extras", () => {
    expect(rows).toHaveLength(6);
    expect(rows.find((r) => r.t.id === "4")).toMatchObject({ status: "overdue", installment: 1, installments: 3 });
    expect(rows.find((r) => r.t.id === "5")?.status).toBe("pending");
    expect(rows.find((r) => r.t.id === "1")?.type).toBe("despesa");
  });
  it("cartões do topo", () => {
    const month = filterExpenses(rows, base, T);
    expect(expenseSummary(month, rows)).toEqual({ despesaCents: 14000, compraCents: 50000, folhaCents: 300000, folhaCount: 1, pendingCents: 6000, pendingCount: 3, overdueCount: 1 });
  });
  it("filtros", () => {
    expect(filterExpenses(rows, { ...base, type: "compra" }, T).map((r) => r.t.id)).toEqual(["2"]);
    expect(filterExpenses(rows, { ...base, quick: "overdue", month: "2026-01" }, T).map((r) => r.t.id)).toEqual(["4"]);
    expect(filterExpenses(rows, { ...base, quick: "due7" }, T).map((r) => r.t.id)).toEqual(["5"]);
    expect(filterExpenses(rows, { ...base, quick: "due30" }, T).map((r) => r.t.id).sort()).toEqual(["5", "6"]);
    expect(filterExpenses(rows, { ...base, from: "2026-11-01", to: "2026-12-31", status: "pending" }, T)).toHaveLength(3);
    expect(filterExpenses(rows, { ...base, supplier: "Atacadão" }, T).map((r) => r.t.id)).toEqual(["2"]);
    expect(filterExpenses(rows, { ...base, employee: "Ana" }, T).map((r) => r.t.id)).toEqual(["3"]);
  });
  it("por categoria soma subcategoria na mãe", () => {
    const cats = [{ id: "c1", name: "Aluguel", parentId: null }, { id: "c2", name: "Mercadorias", parentId: "c3" }, { id: "c3", name: "Estoque", parentId: null }] as Category[];
    expect(byCategory(filterExpenses(rows, base, T), cats).map((c) => [c.name, c.cents])).toEqual([["Sem categoria", 304000], ["Estoque", 50000], ["Aluguel", 10000]]);
    expect(distinct([" b", "a", "b", ""])).toEqual(["a", "b"]);
  });
});
