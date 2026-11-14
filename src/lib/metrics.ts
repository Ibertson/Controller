import { addMonths } from "./dates";
import { monthTotals } from "./summary";
import type { Snapshot } from "./types";

/** Com quantos meses de distância comparar o mês escolhido. */
export const COMPARE_OPTIONS = [
  { months: 1, label: "vs. Mês Anterior" },
  { months: 2, label: "vs. 2 Meses Atrás" },
  { months: 3, label: "vs. 3 Meses Atrás" },
  { months: 6, label: "vs. 6 Meses Atrás" },
  { months: 12, label: "vs. Ano Anterior" },
] as const;

export const RANGE_OPTIONS = [3, 6, 9, 12] as const;

export interface PeriodTotals { month: string; incomeCents: number; expenseCents: number; balanceCents: number; }

/** Receitas, despesas e saldo (receitas − despesas) de um mês "YYYY-MM-01". */
export function periodTotals(s: Snapshot, month: string): PeriodTotals {
  const t = monthTotals(s, month);
  return { month, incomeCents: t.incomeCents, expenseCents: t.expenseCents, balanceCents: t.incomeCents - t.expenseCents };
}

/**
 * Variação percentual de `prev` para `cur`, com uma casa.
 * Sem base (anterior zero) e valor atual diferente de zero não dá porcentagem: null.
 */
export function change(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
}

/** Margem de lucro do mês em %, com uma casa; 0 sem faturamento. */
export function profitMargin(p: PeriodTotals): number {
  if (p.incomeCents <= 0) return 0;
  return Math.round((p.balanceCents / p.incomeCents) * 1000) / 10;
}

/** Os `count` meses que terminam em `month`, do mais antigo ao mais novo. */
export function monthRange(month: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(month, i - count + 1));
}

/** "+12,5%", "−3%", "0%"; null vira "novo". */
export function changeText(n: number | null): string {
  if (n == null) return "novo";
  const abs = Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return n > 0 ? `+${abs}%` : n < 0 ? `−${abs}%` : `${abs}%`;
}
