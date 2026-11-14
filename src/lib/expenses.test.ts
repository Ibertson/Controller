import { describe, expect, it } from "vitest";
import { byCategory, distinct, emptyAdvanced, expenseDescription, expenseRows, expenseSummary, filterExpenses, findCategoryByName, receiptError, splitCents, type ExpenseFilter } from "./expenses";
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

describe("Registrar Despesa", () => {
  it("divide o total e põe a sobra na primeira parcela", () => {
    expect(splitCents(100000, 3)).toEqual([33334, 33333, 33333]);
    expect(splitCents(500, 2)).toEqual([250, 250]);
  });
  it("monta a descrição com categoria e fornecedor", () => {
    expect(expenseDescription("Aluguel", " Imobiliária Sol ")).toBe("Aluguel · Imobiliária Sol");
    expect(expenseDescription("Energia", "")).toBe("Energia");
    expect(expenseDescription("", "")).toBe("Despesa");
  });
  it("acha a categoria sem diferenciar acento e maiúscula", () => {
    const cats = [
      { id: "a", workspaceId: "w", name: "agua", icon: "", kind: "expense", monthlyLimitCents: null, archived: false },
      { id: "b", workspaceId: "w", name: "Água", icon: "", kind: "income", monthlyLimitCents: null, archived: false },
    ] as Category[];
    expect(findCategoryByName(cats, "Água")?.id).toBe("a");
    expect(findCategoryByName(cats, "Energia")).toBeUndefined();
  });
  it("aceita só PDF, JPG ou PNG até 5MB", () => {
    expect(receiptError({ type: "application/pdf", size: 1000 })).toBeNull();
    expect(receiptError({ type: "image/gif", size: 1000 })).toMatch(/PDF/);
    expect(receiptError({ type: "image/png", size: 6 * 1024 * 1024 })).toMatch(/5MB/);
  });
});
