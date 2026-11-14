// Pró-Labore: quanto o dono pode retirar no mês a partir do faturamento.
import { daysInMonth } from "./dates";

export const PCT_MIN = 10;
export const PCT_MAX = 70;
export const PCT_DEFAULT = 33;
export const clampPct = (n: number | undefined) => Math.min(PCT_MAX, Math.max(PCT_MIN, Math.round(n ?? PCT_DEFAULT)));

/** Valor sugerido: percentual do faturamento, arredondado para baixo no centavo. */
export const suggested = (revenueCents: number, pct: number) => Math.floor((revenueCents * clampPct(pct)) / 100);

/** Percentual da retirada sobre o faturamento (null sem faturamento). */
export const withdrawnPct = (amountCents: number, revenueCents: number) => (revenueCents > 0 ? (amountCents / revenueCents) * 100 : null);

/** Data do lançamento: hoje no mês atual, último dia nos meses passados, dia 1 nos futuros. */
export function withdrawalDay(month: string, todayStr: string): string {
  const cur = todayStr.slice(0, 7);
  if (month === cur) return todayStr;
  return month < cur ? `${month}-${String(daysInMonth(month)).padStart(2, "0")}` : `${month}-01`;
}

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const monthName = (month: string) => `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
