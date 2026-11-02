// Conciliação bancária: confere o extrato da conta e a fatura do cartão com os lançamentos do app.
import { accountTransactions } from "./accounts";
import { addMonths } from "./dates";
import type { StatementRow } from "./statement";
import type { Snapshot, Transaction } from "./types";

/** Lançamento do app visto pela conta: positivo entrou, negativo saiu. */
export interface Movement { id: string; date: string; description: string; amountCents: number; tx: Transaction }

const nextMonth = (m: string) => addMonths(m, 1);

/** Sinal do lançamento para esta conta. */
export function signedFor(t: Transaction, accountId: string): number {
  if (t.kind === "income") return t.amountCents;
  if (t.kind === "transfer") return t.toAccountId === accountId ? t.amountCents : -t.amountCents;
  return -t.amountCents;
}

/** Movimentos pagos da conta no mês (o que deve aparecer no extrato do banco). */
export function accountMovements(s: Snapshot, accountId: string, month: string): Movement[] {
  return accountTransactions(s, accountId)
    .filter((t) => t.isPaid && t.occurredOn >= month && t.occurredOn < nextMonth(month))
    .map((t) => ({ id: t.id, date: t.occurredOn, description: t.description, amountCents: signedFor(t, accountId), tx: t }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Saldo da conta no começo do mês (inicial + movimentos pagos antes dele). */
export function balanceAt(s: Snapshot, accountId: string, month: string): number {
  const a = s.accounts.find((x) => x.id === accountId);
  let sum = a?.initialBalanceCents ?? 0;
  for (const t of accountTransactions(s, accountId)) if (t.isPaid && t.occurredOn < month) sum += signedFor(t, accountId);
  return sum;
}

/** Compras do cartão na fatura do mês, como valores positivos. */
export function cardMovements(s: Snapshot, cardId: string, month: string): Movement[] {
  return s.transactions
    .filter((t) => t.cardId === cardId && t.kind === "expense" && t.statementMonth === month)
    .map((t) => ({ id: t.id, date: t.occurredOn, description: t.description, amountCents: t.amountCents, tx: t }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Gastos no cartão de crédito ligados a esta conta, pela fatura do mês. */
export function accountCardExpenses(s: Snapshot, accountId: string, month: string): number {
  const cards = new Set(s.cards.filter((c) => c.paymentAccountId === accountId && !c.archived).map((c) => c.id));
  return s.transactions
    .filter((t) => t.kind === "expense" && t.cardId && cards.has(t.cardId) && t.statementMonth === month)
    .reduce((sum, t) => sum + t.amountCents, 0);
}

export interface Check { totalCents: number; diffCents: number; ok: boolean }

/** Extrato: saldo inicial + lançamentos tem que dar o saldo final do banco. */
export function checkStatement(initialCents: number, finalCents: number, movements: { amountCents: number }[]) {
  const totalCents = movements.reduce((s, m) => s + m.amountCents, 0);
  const launchedFinalCents = initialCents + totalCents;
  const diffCents = finalCents - launchedFinalCents;
  return { totalCents, launchedFinalCents, diffCents, ok: diffCents === 0 };
}

/** Fatura: total informado menos o que foi lançado no app. */
export function checkInvoice(invoiceCents: number, movements: { amountCents: number }[]): Check {
  const totalCents = movements.reduce((s, m) => s + m.amountCents, 0);
  const diffCents = invoiceCents - totalCents;
  return { totalCents, diffCents, ok: diffCents === 0 };
}

export interface MatchResult { matched: { row: StatementRow; item: Movement }[]; onlyStatement: StatementRow[]; onlyApp: Movement[] }

const dayDiff = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;

/**
 * Casa linha do banco com lançamento do app: mesmo valor e data até `days` dias de diferença,
 * a mais próxima primeiro. `abs` compara sem sinal (faturas trazem compras como positivas ou negativas).
 */
export function matchRows(rows: StatementRow[], items: Movement[], { days = 3, abs = false } = {}): MatchResult {
  const free = new Set(items.map((i) => i.id));
  const matched: MatchResult["matched"] = [];
  const onlyStatement: StatementRow[] = [];
  const val = (v: number) => (abs ? Math.abs(v) : v);
  for (const row of [...rows].sort((a, b) => a.date.localeCompare(b.date))) {
    let best: Movement | null = null;
    for (const it of items) {
      if (!free.has(it.id) || val(it.amountCents) !== val(row.amountCents)) continue;
      const d = dayDiff(it.date, row.date);
      if (d > days) continue;
      if (!best || d < dayDiff(best.date, row.date)) best = it;
    }
    if (best) { free.delete(best.id); matched.push({ row, item: best }); } else onlyStatement.push(row);
  }
  return { matched, onlyStatement, onlyApp: items.filter((i) => free.has(i.id)) };
}
