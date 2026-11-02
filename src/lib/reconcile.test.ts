import { describe, expect, it } from "vitest";
import { accountCardExpenses, accountMovements, balanceAt, checkInvoice, checkStatement, matchRows } from "./reconcile";
import type { Snapshot, Transaction } from "./types";

let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`, workspaceId: "w", kind: "expense", amountCents: 100, occurredOn: "2026-11-05", description: "x",
  categoryId: null, accountId: "a", toAccountId: null, cardId: null, statementMonth: null, personId: null,
  installmentGroupId: null, installmentNumber: null, installmentTotal: null, isPaid: true, dueOn: null, source: "app", createdAt: "", ...p,
});
const snap = (transactions: Transaction[]): Snapshot => ({
  workspace: { id: "w", name: "P", currency: "BRL" },
  accounts: [{ id: "a", workspaceId: "w", name: "A", kind: "checking", initialBalanceCents: 10000, archived: false }],
  cards: [{ id: "k", workspaceId: "w", name: "K", limitCents: 0, closingDay: 10, dueDay: 17, paymentAccountId: "a", archived: false }],
  categories: [], people: [], transactions,
});

describe("conciliação", () => {
  const s = snap([
    tx({ occurredOn: "2026-10-20", amountCents: 2000 }),
    tx({ kind: "income", amountCents: 5000, occurredOn: "2026-11-02" }),
    tx({ amountCents: 1500, occurredOn: "2026-11-10" }),
    tx({ amountCents: 900, occurredOn: "2026-11-11", isPaid: false }),
    tx({ amountCents: 700, accountId: null, cardId: "k", statementMonth: "2026-11-01" }),
    tx({ amountCents: 300, accountId: null, cardId: "k", statementMonth: "2026-12-01" }),
  ]);

  it("calcula saldo do começo do mês e movimentos pagos", () => {
    expect(balanceAt(s, "a", "2026-11-01")).toBe(8000);
    expect(accountMovements(s, "a", "2026-11-01").map((m) => m.amountCents)).toEqual([5000, -1500]);
    expect(accountCardExpenses(s, "a", "2026-11-01")).toBe(700);
  });

  it("confere extrato e fatura", () => {
    expect(checkStatement(8000, 11500, [{ amountCents: 5000 }, { amountCents: -1500 }])).toEqual({ totalCents: 3500, launchedFinalCents: 11500, diffCents: 0, ok: true });
    expect(checkInvoice(1000, [{ amountCents: 700 }])).toEqual({ totalCents: 700, diffCents: 300, ok: false });
  });

  it("casa linhas pelo valor e data mais próxima", () => {
    const items = accountMovements(s, "a", "2026-11-01");
    const r = matchRows([
      { date: "2026-11-03", description: "PIX", amountCents: 5000 },
      { date: "2026-11-25", description: "Tarifa", amountCents: -1500 },
      { date: "2026-11-12", description: "Mercado", amountCents: -1500 },
    ], items);
    expect(r.matched.map((m) => m.row.description)).toEqual(["PIX", "Mercado"]);
    expect(r.onlyStatement.map((x) => x.description)).toEqual(["Tarifa"]);
    expect(r.onlyApp).toEqual([]);
    expect(matchRows([{ date: "2026-11-05", description: "c", amountCents: -700 }], [{ id: "z", date: "2026-11-05", description: "", amountCents: 700, tx: s.transactions[4] }], { abs: true }).matched).toHaveLength(1);
  });
});
