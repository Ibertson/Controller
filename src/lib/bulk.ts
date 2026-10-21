// Excluir em massa: o que entra em cada aba (Transações, Pagamentos, Cadastros).
import { normName } from "./categories";
import { daysInMonth, monthOf } from "./dates";
import type { Snapshot, Transaction } from "./types";

export type BulkTxFilter = "all" | "income" | "expense" | "card";
export type BulkPayFilter = "all" | "fixed_expense" | "fixed_income" | "card_payment";
export type BulkRegFilter = "all" | "fixed_expense" | "fixed_income" | "debt";

/** Período padrão: de 01/01/2020 até o fim do mês de hoje. */
export function defaultBulkRange(todayStr: string) {
  const m = monthOf(todayStr);
  return { from: "2020-01-01", to: m.slice(0, 8) + String(daysInMonth(m)).padStart(2, "0") };
}

interface Base { from: string; to: string; search: string }

function inRange(t: Transaction, o: Base) {
  if (o.from && t.occurredOn < o.from) return false;
  if (o.to && t.occurredOn > o.to) return false;
  const q = normName(o.search);
  return !q || normName(t.description).includes(q);
}
const newestFirst = (a: Transaction, b: Transaction) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt);

/** Aba Transações: tudo menos pagamento de fatura (que fica em Pagamentos). */
export function bulkTransactions(s: Snapshot, o: Base & { filter: BulkTxFilter }): Transaction[] {
  return s.transactions.filter((t) => {
    if (t.kind === "card_payment" || !inRange(t, o)) return false;
    if (o.filter === "income") return t.kind === "income";
    if (o.filter === "expense") return t.kind === "expense" && !t.cardId;
    if (o.filter === "card") return !!t.cardId;
    return true;
  }).sort(newestFirst);
}

/** Aba Pagamentos: pagamentos de fatura. Gastos e receitas fixos ainda não existem no Sobra, então ficam vazios. */
export function bulkPayments(s: Snapshot, o: Base & { filter: BulkPayFilter }): Transaction[] {
  if (o.filter === "fixed_expense" || o.filter === "fixed_income") return [];
  return s.transactions.filter((t) => t.kind === "card_payment" && inRange(t, o)).sort(newestFirst);
}
