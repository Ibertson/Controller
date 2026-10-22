// Previsão: agenda financeira do mês, fechamento previsto e gastos/receitas fixas.
import { daysInMonth } from "./dates";
import { budgetMonth, monthTransactions } from "./summary";
import type { Recurring, Snapshot } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Data do fixo no mês: o dia dele, ou o último dia em meses mais curtos. */
export function recurringDate(r: Pick<Recurring, "day">, month: string): string {
  return `${month.slice(0, 8)}${pad(Math.min(r.day, daysInMonth(month)))}`;
}

/** Fixos que valem no mês (ativos e já começados). */
export function activeRecurring(s: Snapshot, month: string, kind?: Recurring["kind"]): Recurring[] {
  return (s.recurring ?? []).filter((r) => r.active && r.startMonth <= month && (!kind || r.kind === kind));
}

/** Lançamento que já registrou o fixo naquele mês, se houver. */
export function recurringLaunch(s: Snapshot, r: Recurring, month: string) {
  return s.transactions.find((t) => t.recurringId === r.id && budgetMonth(t) === month);
}

export interface AgendaEvent {
  id: string; date: string; kind: "income" | "expense";
  /** "Receita a receber", "Despesa a pagar", "Gasto fixo", "Receita fixa" ou "Fatura do cartão". */
  type: string;
  label: string; amountCents: number;
  /** O que ainda falta fazer: id do lançamento pendente, do fixo ou do cartão. */
  ref: { transactionId?: string; recurringId?: string; cardId?: string };
}

/** Tudo que vence no mês e ainda não foi pago ou recebido, por data. */
export function agendaEvents(s: Snapshot, month: string): AgendaEvent[] {
  const prefix = month.slice(0, 8);
  const out: AgendaEvent[] = [];
  for (const t of s.transactions) {
    if (t.isPaid || (t.kind !== "income" && t.kind !== "expense") || t.cardId) continue;
    const date = t.dueOn ?? t.occurredOn;
    if (!date.startsWith(prefix)) continue;
    out.push({
      id: t.id, date, kind: t.kind, type: t.kind === "income" ? "Receita a receber" : "Despesa a pagar",
      label: t.description || (t.kind === "income" ? "Receita" : "Despesa"), amountCents: t.amountCents, ref: { transactionId: t.id },
    });
  }
  for (const r of activeRecurring(s, month)) {
    if (recurringLaunch(s, r, month)) continue;
    out.push({
      id: `fixo:${r.id}`, date: recurringDate(r, month), kind: r.kind, type: r.kind === "income" ? "Receita fixa" : "Gasto fixo",
      label: r.description, amountCents: r.amountCents, ref: { recurringId: r.id },
    });
  }
  for (const c of s.cards) {
    const open = cardOpenCents(s, c.id, month);
    if (open <= 0) continue;
    out.push({
      id: `fatura:${c.id}`, date: recurringDate({ day: c.dueDay }, month), kind: "expense", type: "Fatura do cartão",
      label: `Fatura ${c.name}`, amountCents: open, ref: { cardId: c.id },
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label, "pt-BR"));
}

/** Quanto da fatura do mês de um cartão ainda não foi pago. */
function cardOpenCents(s: Snapshot, cardId: string, month: string): number {
  let open = 0;
  for (const t of s.transactions) {
    if (t.cardId !== cardId || t.statementMonth !== month) continue;
    if (t.kind === "expense") open += t.amountCents;
    if (t.kind === "card_payment") open -= t.amountCents;
  }
  return open;
}

export interface MonthClosing {
  looseIncomeCents: number; fixedIncomeCents: number;
  looseExpenseCents: number; fixedExpenseCents: number;
  incomeCents: number; expenseCents: number; resultCents: number;
}

/**
 * Fechamento previsto do mês: tudo lançado no mês (pago ou não) mais os fixos ainda não lançados.
 * Fixo lançado conta como fixo, não como avulso.
 */
export function monthClosing(s: Snapshot, month: string): MonthClosing {
  const r = { looseIncomeCents: 0, fixedIncomeCents: 0, looseExpenseCents: 0, fixedExpenseCents: 0 };
  for (const t of monthTransactions(s, month)) {
    if (t.kind === "income") r[t.recurringId ? "fixedIncomeCents" : "looseIncomeCents"] += t.amountCents;
    if (t.kind === "expense") r[t.recurringId ? "fixedExpenseCents" : "looseExpenseCents"] += t.amountCents;
  }
  for (const x of activeRecurring(s, month)) {
    if (recurringLaunch(s, x, month)) continue;
    if (x.kind === "income") r.fixedIncomeCents += x.amountCents;
    else r.fixedExpenseCents += x.amountCents;
  }
  const incomeCents = r.looseIncomeCents + r.fixedIncomeCents;
  const expenseCents = r.looseExpenseCents + r.fixedExpenseCents;
  return { ...r, incomeCents, expenseCents, resultCents: incomeCents - expenseCents };
}

/** Contas a pagar e receitas a receber do mês (o que está na agenda). */
export function pendingTotals(s: Snapshot, month: string) {
  const ev = agendaEvents(s, month);
  const sum = (k: AgendaEvent["kind"]) => ev.filter((e) => e.kind === k).reduce((a, e) => a + e.amountCents, 0);
  const payCents = sum("expense"), receiveCents = sum("income");
  return {
    payCents, receiveCents, balanceCents: receiveCents - payCents,
    payCount: ev.filter((e) => e.kind === "expense").length, receiveCount: ev.filter((e) => e.kind === "income").length,
  };
}

/** Despesas por pessoa no mês ou no ano do mês. "" = titular. */
export function expensesByPerson(s: Snapshot, month: string, period: "month" | "year"): Map<string, number> {
  const year = month.slice(0, 4);
  const out = new Map<string, number>();
  for (const t of s.transactions) {
    if (t.kind !== "expense") continue;
    const m = budgetMonth(t);
    if (period === "month" ? m !== month : !m.startsWith(year)) continue;
    out.set(t.personId ?? "", (out.get(t.personId ?? "") ?? 0) + t.amountCents);
  }
  return out;
}
