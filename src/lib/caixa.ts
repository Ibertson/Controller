// Caixa Diário: quanto deveria haver de dinheiro na gaveta e o calendário do mês.
import type { CashMovementKind, CashRegister } from "./types";

export interface CashTotals {
  reforcoCents: number; reforcoCount: number; sangriaCents: number; sangriaCount: number;
  vendaCents: number; vendaCount: number;
  /** Abertura + Reforços − Sangrias + Vendas em dinheiro. */
  expectedCents: number;
}

export function cashTotals(r: Pick<CashRegister, "openingCents" | "movements">): CashTotals {
  const of = (k: CashMovementKind) => r.movements.filter((m) => m.kind === k);
  const sum = (k: CashMovementKind) => of(k).reduce((t, m) => t + m.amountCents, 0);
  const reforcoCents = sum("reforco"), sangriaCents = sum("sangria"), vendaCents = sum("venda");
  return {
    reforcoCents, reforcoCount: of("reforco").length, sangriaCents, sangriaCount: of("sangria").length,
    vendaCents, vendaCount: of("venda").length, expectedCents: r.openingCents + reforcoCents - sangriaCents + vendaCents,
  };
}

/** Contado − esperado: positivo sobrou dinheiro, negativo faltou. */
export function cashDifference(r: CashRegister): number | null {
  return r.countedCents == null ? null : r.countedCents - cashTotals(r).expectedCents;
}

/** Semanas do mês (domingo primeiro), com null nos dias de fora. */
export function monthGrid(month: string): (string | null)[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** "sábado, 14" e "novembro de 2026". */
export function dayTitle(day: string): { title: string; subtitle: string } {
  const [y, m, d] = day.split("-").map(Number);
  return { title: `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d}`, subtitle: `${MONTHS[m - 1]} de ${y}` };
}
export const monthTitle = (month: string) => `${MONTHS[Number(month.slice(5)) - 1]} de ${month.slice(0, 4)}`;

/** Erro do valor de uma sangria, ou null. */
export function sangriaError(r: CashRegister, cents: number | null): string | null {
  if (cents == null || cents <= 0) return "Informe o valor.";
  if (cents > cashTotals(r).expectedCents) return "Valor maior que o saldo esperado do caixa.";
  return null;
}
