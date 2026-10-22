import { categoryFits } from "./categories";
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

/** Id da categoria pai, quando `id` é uma subcategoria cujo pai ainda existe. */
function parentOf(s: Snapshot, id: string): string | null {
  const p = s.categories.find((c) => c.id === id)?.parentId;
  return p && s.categories.some((c) => c.id === p) ? p : null;
}

export interface CategoryUsage { categoryId: string; spentCents: number; limitCents: number | null; ratio: number | null; }

export function categoryUsage(s: Snapshot, month: string): CategoryUsage[] {
  const spent = new Map<string, number>();
  for (const t of monthTransactions(s, month)) {
    if (t.kind !== "expense" || !t.categoryId) continue;
    spent.set(t.categoryId, (spent.get(t.categoryId) ?? 0) + t.amountCents);
    // O gasto da subcategoria também conta no limite da categoria pai.
    const parent = parentOf(s, t.categoryId);
    if (parent) spent.set(parent, (spent.get(parent) ?? 0) + t.amountCents);
  }
  return s.categories
    // Subcategoria só aparece sozinha quando tem limite próprio; senão já está somada no pai.
    .filter((c) => categoryFits(c, "expense") && !c.archived && (c.parentId && parentOf(s, c.id) ? !!c.monthlyLimitCents : spent.has(c.id) || c.monthlyLimitCents))
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


export interface MonthBreakdown {
  incomeCents: number;
  /** Despesas pagas em conta ou dinheiro (fora do cartão). */
  cashExpenseCents: number;
  /** Compras no cartão que caem na fatura deste mês. */
  cardCents: number;
  /** Parte da fatura deste mês que ainda não foi paga. */
  cardOpenCents: number;
  /** Contas a pagar do mês ainda não pagas. */
  pendingCents: number;
  pendingCount: number;
}

export function monthBreakdown(s: Snapshot, month: string): MonthBreakdown {
  const r: MonthBreakdown = { incomeCents: 0, cashExpenseCents: 0, cardCents: 0, cardOpenCents: 0, pendingCents: 0, pendingCount: 0 };
  for (const t of monthTransactions(s, month)) {
    if (t.kind === "income") r.incomeCents += t.amountCents;
    if (t.kind !== "expense") continue;
    if (t.cardId) r.cardCents += t.amountCents;
    else r.cashExpenseCents += t.amountCents;
    if (!t.isPaid) { r.pendingCents += t.amountCents; r.pendingCount++; }
  }
  const paid = s.transactions.filter((t) => t.kind === "card_payment" && t.statementMonth === month).reduce((a, t) => a + t.amountCents, 0);
  r.cardOpenCents = Math.max(0, r.cardCents - paid);
  return r;
}

export interface MonthPoint { month: string; incomeCents: number; expenseCents: number; }

/** Receitas e despesas dos `n` meses que terminam em `lastMonth`, do mais antigo ao mais novo. */
export function monthSeries(s: Snapshot, lastMonth: string, n: number): MonthPoint[] {
  const [y, m] = lastMonth.split("-").map(Number);
  const months = Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 10);
  });
  const idx = new Map(months.map((mm, i) => [mm, i]));
  const out = months.map((month) => ({ month, incomeCents: 0, expenseCents: 0 }));
  for (const t of s.transactions) {
    const i = idx.get(budgetMonth(t));
    if (i === undefined) continue;
    if (t.kind === "income") out[i].incomeCents += t.amountCents;
    if (t.kind === "expense") out[i].expenseCents += t.amountCents;
  }
  return out;
}

export interface Slice { id: string; label: string; cents: number; }

/** Total do mês por categoria (despesas ou receitas), do maior para o menor. Sem categoria vira "Outros". */
export function totalsByCategory(s: Snapshot, month: string, kind: "expense" | "income"): Slice[] {
  const sums = new Map<string, number>();
  for (const t of monthTransactions(s, month)) {
    if (t.kind !== kind) continue;
    const key = (t.categoryId && parentOf(s, t.categoryId)) || t.categoryId || "";
    sums.set(key, (sums.get(key) ?? 0) + t.amountCents);
  }
  const name = (id: string) => s.categories.find((c) => c.id === id)?.name ?? "Outros";
  return [...sums].map(([id, cents]) => ({ id: id || "outros", label: id ? name(id) : "Outros", cents })).sort((a, b) => b.cents - a.cents);
}

/** Receitas do mês por conta onde entraram. */
export function incomeByAccount(s: Snapshot, month: string): Slice[] {
  const sums = new Map<string, number>();
  for (const t of monthTransactions(s, month)) {
    if (t.kind === "income" && t.accountId) sums.set(t.accountId, (sums.get(t.accountId) ?? 0) + t.amountCents);
  }
  return [...sums].map(([id, cents]) => ({ id, label: s.accounts.find((a) => a.id === id)?.name ?? "Conta", cents })).sort((a, b) => b.cents - a.cents);
}

export interface StatementLine { transaction: Transaction; deltaCents: number; balanceCents: number; }

/** Quanto um lançamento pago mexe no saldo de uma conta (0 se não mexe). */
function accountDelta(t: Transaction, accountId: string): number {
  if (!t.isPaid) return 0;
  if (t.kind === "income" && t.accountId === accountId) return t.amountCents;
  if ((t.kind === "expense" || t.kind === "card_payment") && t.accountId === accountId) return -t.amountCents;
  if (t.kind === "transfer") return (t.toAccountId === accountId ? t.amountCents : 0) - (t.accountId === accountId ? t.amountCents : 0);
  return 0;
}

/** Extrato de uma conta no mês: saldo de abertura e cada movimento pago com o saldo depois dele (pela data do movimento). */
export function accountStatement(s: Snapshot, accountId: string, month: string) {
  const account = s.accounts.find((a) => a.id === accountId);
  const prefix = month.slice(0, 7);
  let opening = account?.initialBalanceCents ?? 0;
  const inMonth: Transaction[] = [];
  for (const t of s.transactions) {
    const d = accountDelta(t, accountId);
    if (!d) continue;
    if (t.occurredOn < month) opening += d;
    else if (t.occurredOn.startsWith(prefix)) inMonth.push(t);
  }
  inMonth.sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.createdAt.localeCompare(b.createdAt));
  let balance = opening;
  const lines: StatementLine[] = inMonth.map((t) => {
    const deltaCents = accountDelta(t, accountId);
    balance += deltaCents;
    return { transaction: t, deltaCents, balanceCents: balance };
  });
  return { openingCents: opening, closingCents: balance, lines };
}

export interface ForecastMonth { month: string; incomeCents: number; expenseCents: number; balanceCents: number; }

/**
 * Previsão dos próximos `n` meses a partir de `fromMonth`: o que já está lançado para cada mês
 * (parcelas, contas a pagar, receitas futuras) e o saldo acumulado a partir do saldo de hoje.
 * No mês atual só conta o que ainda não foi pago (o pago já está no saldo).
 */
export function forecast(s: Snapshot, fromMonth: string, n: number): ForecastMonth[] {
  const [y, m] = fromMonth.split("-").map(Number);
  let balance = totalBalance(s);
  return Array.from({ length: n }, (_, i) => {
    const month = new Date(Date.UTC(y, m - 1 + i, 1)).toISOString().slice(0, 10);
    let incomeCents = 0, expenseCents = 0;
    for (const t of monthTransactions(s, month)) {
      // compra no cartão sai quando a fatura é paga, então conta no mês da fatura mesmo se já "paga" no cartão
      const pending = !t.isPaid || (t.kind === "expense" && !!t.cardId);
      if (i === 0 && !pending) continue;
      if (t.kind === "income") incomeCents += t.amountCents;
      if (t.kind === "expense") expenseCents += t.amountCents;
    }
    balance += incomeCents - expenseCents;
    return { month, incomeCents, expenseCents, balanceCents: balance };
  });
}

/** Saldo total no fim de cada um dos `n` meses que terminam em `lastMonth` (movimentos pagos, pela data). */
export function balanceSeries(s: Snapshot, lastMonth: string, n: number): { month: string; balanceCents: number }[] {
  const months = monthSeries(s, lastMonth, n).map((p) => p.month);
  const ends = months.map((m) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 1)).toISOString().slice(0, 10));
  const ids = new Set(s.accounts.map((a) => a.id));
  const initial = s.accounts.reduce((a, x) => a + x.initialBalanceCents, 0);
  return months.map((month, i) => {
    let b = initial;
    for (const t of s.transactions) {
      if (t.occurredOn >= ends[i]) continue;
      b += totalDelta(t, ids);
    }
    return { month, balanceCents: b };
  });
}

/** Quanto um lançamento pago muda o saldo somado das contas (transferência entre contas não muda). */
function totalDelta(t: Transaction, ids: Set<string>): number {
  if (!t.isPaid) return 0;
  const inAcc = (id: string | null) => !!id && ids.has(id);
  if (t.kind === "income" && inAcc(t.accountId)) return t.amountCents;
  if ((t.kind === "expense" || t.kind === "card_payment") && inAcc(t.accountId)) return -t.amountCents;
  if (t.kind === "transfer") return (inAcc(t.toAccountId) ? t.amountCents : 0) - (inAcc(t.accountId) ? t.amountCents : 0);
  return 0;
}

/** Total do mês por pessoa (despesas ou receitas). Lançamento sem pessoa fica com id "" (o titular). */
export function totalsByPerson(s: Snapshot, month: string, kind: "expense" | "income"): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of monthTransactions(s, month)) {
    if (t.kind === kind) out.set(t.personId ?? "", (out.get(t.personId ?? "") ?? 0) + t.amountCents);
  }
  return out;
}
