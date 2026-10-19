import type { Snapshot, Transaction } from "./types";

/** Saldo atual de cada conta: saldo inicial + movimentos pagos (mesma regra da visão account_balances). */
export function accountBalances(s: Snapshot): Map<string, number> {
  const out = new Map(s.accounts.map((a) => [a.id, a.initialBalanceCents]));
  for (const t of s.transactions) {
    if (!t.isPaid) continue;
    const add = (id: string | null, v: number) => { if (id && out.has(id)) out.set(id, out.get(id)! + v); };
    if (t.kind === "income") add(t.accountId, t.amountCents);
    else if (t.kind === "expense" || t.kind === "card_payment") add(t.accountId, -t.amountCents);
    else if (t.kind === "transfer") { add(t.accountId, -t.amountCents); add(t.toAccountId, t.amountCents); }
  }
  return out;
}

export function totalBalance(s: Snapshot): number {
  let sum = 0;
  for (const [, v] of accountBalances(s)) sum += v;
  return sum;
}

/** Em que mês um lançamento conta para o orçamento: cartão pelo mês da fatura, o resto pela data. */
export function budgetMonth(t: Transaction): string {
  return t.statementMonth ?? t.occurredOn.slice(0, 8) + "01";
}

export function monthTransactions(s: Snapshot, month: string): Transaction[] {
  return s.transactions.filter((t) => budgetMonth(t) === month);
}

export interface MonthTotals { incomeCents: number; expenseCents: number; pendingExpenseCents: number; pendingIncomeCents: number; }

export function monthTotals(s: Snapshot, month: string): MonthTotals {
  const r: MonthTotals = { incomeCents: 0, expenseCents: 0, pendingExpenseCents: 0, pendingIncomeCents: 0 };
  for (const t of monthTransactions(s, month)) {
    if (t.kind === "income") { r.incomeCents += t.amountCents; if (!t.isPaid) r.pendingIncomeCents += t.amountCents; }
    if (t.kind === "expense") { r.expenseCents += t.amountCents; if (!t.isPaid) r.pendingExpenseCents += t.amountCents; }
  }
  return r;
}

/** Sobra prevista: saldo hoje + o que ainda vai entrar − o que ainda vai sair no mês (contas a pagar e faturas do mês). */
export function projectedLeftover(s: Snapshot, month: string): number {
  const totals = monthTotals(s, month);
  const cardThisMonth = monthTransactions(s, month)
    .filter((t) => t.kind === "expense" && t.cardId).reduce((a, t) => a + t.amountCents, 0);
  const cardPaid = s.transactions
    .filter((t) => t.kind === "card_payment" && t.statementMonth === month).reduce((a, t) => a + t.amountCents, 0);
  return totalBalance(s) + totals.pendingIncomeCents - totals.pendingExpenseCents - Math.max(0, cardThisMonth - cardPaid);
}

export interface CategoryUsage { categoryId: string; spentCents: number; limitCents: number | null; ratio: number | null; }

export function categoryUsage(s: Snapshot, month: string): CategoryUsage[] {
  const spent = new Map<string, number>();
  for (const t of monthTransactions(s, month)) {
    if (t.kind === "expense" && t.categoryId) spent.set(t.categoryId, (spent.get(t.categoryId) ?? 0) + t.amountCents);
  }
  return s.categories
    .filter((c) => c.kind === "expense" && !c.archived && (spent.has(c.id) || c.monthlyLimitCents))
    .map((c) => {
      const spentCents = spent.get(c.id) ?? 0;
      return { categoryId: c.id, spentCents, limitCents: c.monthlyLimitCents, ratio: c.monthlyLimitCents ? spentCents / c.monthlyLimitCents : null };
    })
    .sort((a, b) => (b.ratio ?? -1) - (a.ratio ?? -1) || b.spentCents - a.spentCents);
}

/** Contas a pagar não pagas que vencem até `days` dias depois de hoje (inclui atrasadas). */
export function upcomingBills(s: Snapshot, todayStr: string, days = 3): Transaction[] {
  const [y, m, d] = todayStr.split("-").map(Number);
  const limit = new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  return s.transactions
    .filter((t) => !t.isPaid && t.kind === "expense" && t.dueOn && t.dueOn <= limit)
    .sort((a, b) => a.dueOn!.localeCompare(b.dueOn!));
}

