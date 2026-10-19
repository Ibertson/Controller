// Datas de lançamento são dias civis "AAAA-MM-DD" (sem fuso). Meses são "AAAA-MM-01".

export const TIME_ZONE = "America/Sao_Paulo";

/** Hoje no fuso do usuário, como "AAAA-MM-DD". */
export function today(timeZone = TIME_ZONE, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function parts(day: string): [number, number, number] {
  const [y, m, d] = day.split("-").map(Number);
  return [y, m, d];
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function monthOf(day: string): string {
  const [y, m] = parts(day);
  return `${y}-${pad(m)}-01`;
}

export function addMonths(month: string, n: number): string {
  const [y, m] = parts(month);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}-01`;
}

export function daysInMonth(month: string): number {
  const [y, m] = parts(month);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Mesmo dia em outro mês; dia 31 em mês curto vira o último dia. */
export function addMonthsToDay(day: string, n: number): string {
  const [, , d] = parts(day);
  const month = addMonths(monthOf(day), n);
  return month.slice(0, 8) + pad(Math.min(d, daysInMonth(month)));
}

/**
 * Mês da fatura em que cai uma compra no cartão.
 * Regra: compra até o dia anterior ao fechamento entra na fatura que fecha neste mês;
 * no dia do fechamento ou depois, entra na seguinte. Fechamento 31 em mês curto = último dia.
 * A fatura é identificada pelo mês em que fecha.
 */
export function statementMonthFor(purchaseDay: string, closingDay: number): string {
  const month = monthOf(purchaseDay);
  const closing = Math.min(closingDay, daysInMonth(month));
  const [, , d] = parts(purchaseDay);
  return d < closing ? month : addMonths(month, 1);
}

/** "2026-10-01" -> "outubro 2026" */
export function monthLabel(month: string): string {
  const [y, m] = parts(month);
  const name = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  return `${name} ${y}`;
}

/** Rótulo do dia para listas: "Hoje", "Ontem" ou "seg, 13 out". */
export function dayLabel(day: string, todayStr = today()): string {
  if (day === todayStr) return "Hoje";
  const [y, m, d] = parts(todayStr);
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  if (day === yesterday) return "Ontem";
  const [dy, dm, dd] = parts(day);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(dy, dm - 1, dd)))
    .replace(/\./g, "");
}
