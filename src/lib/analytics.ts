import { addMonths } from "./dates";
import { periodTotals, type PeriodTotals } from "./metrics";
import { monthTransactions, totalsByCategory, type Slice } from "./summary";
import type { Snapshot } from "./types";

/** Os 12 meses ("YYYY-MM-01") de um ano. */
export const yearMonths = (year: number) => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}-01`);

export function yearSeries(s: Snapshot, year: number): PeriodTotals[] {
  return yearMonths(year).map((m) => periodTotals(s, m));
}

export interface YearKpis { incomeCents: number; expenseCents: number; profitCents: number; margin: number; expensePct: number; salesCount: number; ticketCents: number; }

/** Totais do ano: receita, despesas, lucro, margem, despesas sobre a receita e ticket médio por receita lançada. */
export function yearKpis(s: Snapshot, year: number): YearKpis {
  let incomeCents = 0, expenseCents = 0, salesCount = 0;
  for (const m of yearMonths(year)) {
    for (const t of monthTransactions(s, m)) {
      if (t.kind === "income") { incomeCents += t.amountCents; salesCount++; }
      if (t.kind === "expense") expenseCents += t.amountCents;
    }
  }
  const profitCents = incomeCents - expenseCents;
  const pct = (a: number) => (incomeCents > 0 ? Math.round((a / incomeCents) * 1000) / 10 : 0);
  return { incomeCents, expenseCents, profitCents, margin: pct(profitCents), expensePct: pct(expenseCents), salesCount, ticketCents: salesCount ? Math.round(incomeCents / salesCount) : 0 };
}

/** Anos com lançamentos, mais o atual, do mais novo ao mais antigo. */
export function yearsWithData(s: Snapshot, currentYear: number): number[] {
  const ys = new Set([currentYear]);
  for (const t of s.transactions) if (t.kind === "income" || t.kind === "expense") ys.add(Number((t.statementMonth ?? t.occurredOn).slice(0, 4)));
  return [...ys].sort((a, b) => b - a);
}

export interface ProjectionMonth extends PeriodTotals { projected: boolean; }
export interface Projection { months: ProjectionMonth[]; baseIncomeCents: number; baseExpenseCents: number; baseMonths: string[]; firstProjected: number; }

export const PROJECTION_BASE = 3;

/**
 * Projeção do ano: meses até o atual são os valores lançados; os seguintes usam a média
 * dos últimos 3 meses fechados (antes do mês atual). Ano passado: nada projetado (firstProjected = 12).
 */
export function projection(s: Snapshot, year: number, currentMonth: string): Projection {
  const baseMonths = Array.from({ length: PROJECTION_BASE }, (_, i) => addMonths(currentMonth, i - PROJECTION_BASE));
  const base = baseMonths.map((m) => periodTotals(s, m));
  const baseIncomeCents = Math.round(base.reduce((a, p) => a + p.incomeCents, 0) / PROJECTION_BASE);
  const baseExpenseCents = Math.round(base.reduce((a, p) => a + p.expenseCents, 0) / PROJECTION_BASE);
  const months = yearMonths(year).map((m): ProjectionMonth => {
    if (m <= currentMonth) return { ...periodTotals(s, m), projected: false };
    return { month: m, incomeCents: baseIncomeCents, expenseCents: baseExpenseCents, balanceCents: baseIncomeCents - baseExpenseCents, projected: true };
  });
  const idx = months.findIndex((p) => p.projected);
  return { months, baseIncomeCents, baseExpenseCents, baseMonths, firstProjected: idx < 0 ? 12 : idx };
}

/** Totais por categoria somados em vários meses, do maior para o menor. */
export function categoriesOver(s: Snapshot, months: string[], kind: "expense" | "income"): Slice[] {
  const sums = new Map<string, Slice>();
  for (const m of months) for (const sl of totalsByCategory(s, m, kind)) {
    const cur = sums.get(sl.id);
    sums.set(sl.id, cur ? { ...cur, cents: cur.cents + sl.cents } : { ...sl });
  }
  return [...sums.values()].sort((a, b) => b.cents - a.cents);
}

/** As maiores fatias e o resto somado em "Outras". */
export function topSlices(list: Slice[], n = 6): Slice[] {
  if (list.length <= n) return list;
  const rest = list.slice(n - 1).reduce((a, s) => a + s.cents, 0);
  return [...list.slice(0, n - 1), { id: "__rest", label: "Outras", cents: rest }];
}
