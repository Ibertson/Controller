// Investimentos: tipos, totais, distribuição, evolução por mês e progresso das metas de investimento.
import { addMonths, monthOf } from "./dates";
import type { Slice } from "./summary";
import type { Investment, InvestmentGoal, InvestmentType, Snapshot } from "./types";

export const INVESTMENT_TYPES: [InvestmentType, string][] = [
  ["tesouro", "Tesouro Direto"], ["cdb", "CDB / RDB"], ["acoes", "Ações"], ["fundos", "Fundos"], ["outros", "Outros"],
];
/** Rótulos curtos das abas da tabela. */
export const TYPE_TABS: [InvestmentType, string][] = [
  ["tesouro", "Tesouro"], ["cdb", "CDBs"], ["acoes", "Ações"], ["fundos", "Fundos"], ["outros", "Outros"],
];
export const investmentTypeLabel = (t: InvestmentType) => INVESTMENT_TYPES.find(([k]) => k === t)?.[1] ?? "Outros";

/** Quanto vale hoje: o valor atual informado, ou o aplicado. */
export const currentValue = (i: Pick<Investment, "investedCents" | "currentCents">) => i.currentCents ?? i.investedCents;
/** Ganho ou perda de preço (atual menos aplicado). */
export const appreciation = (i: Investment) => currentValue(i) - i.investedCents;
/** Rentabilidade total em %: valorização mais proventos sobre o aplicado. */
export const returnPct = (i: Investment) => ((appreciation(i) + i.incomeCents) / i.investedCents) * 100;

export interface InvestmentTotals { investedCents: number; patrimonyCents: number; appreciationCents: number; incomeCents: number; returnCents: number; }

export function investmentTotals(list: Investment[]): InvestmentTotals {
  const t = { investedCents: 0, patrimonyCents: 0, appreciationCents: 0, incomeCents: 0 };
  for (const i of list) {
    t.investedCents += i.investedCents;
    t.patrimonyCents += currentValue(i);
    t.appreciationCents += appreciation(i);
    t.incomeCents += i.incomeCents;
  }
  return { ...t, returnCents: t.appreciationCents + t.incomeCents };
}

/** Patrimônio por tipo, do maior para o menor. */
export function distributionByType(list: Investment[]): Slice[] {
  return INVESTMENT_TYPES.map(([id, label]) => ({ id, label, cents: list.filter((i) => i.type === id).reduce((a, i) => a + currentValue(i), 0) }))
    .filter((s) => s.cents > 0).sort((a, b) => b.cents - a.cents);
}

export type EvolutionPeriod = "6m" | "12m" | "year" | "all";

/** Meses do gráfico de evolução, terminando no mês atual. */
export function evolutionMonths(list: Investment[], period: EvolutionPeriod, currentMonth: string): string[] {
  let first: string;
  if (period === "6m") first = addMonths(currentMonth, -5);
  else if (period === "12m") first = addMonths(currentMonth, -11);
  else if (period === "year") first = `${currentMonth.slice(0, 4)}-01-01`;
  else first = list.reduce((m, i) => (monthOf(i.boughtOn) < m ? monthOf(i.boughtOn) : m), currentMonth);
  if (first >= currentMonth) first = addMonths(currentMonth, -1); // pelo menos dois pontos
  const out: string[] = [];
  for (let m = first; m <= currentMonth; m = addMonths(m, 1)) out.push(m);
  return out;
}

/** Total aplicado acumulado no fim de cada mês (pelas datas de compra). */
export function investedByMonth(list: Investment[], months: string[]): number[] {
  return months.map((m) => list.filter((i) => monthOf(i.boughtOn) <= m).reduce((a, i) => a + i.investedCents, 0));
}

/** Quanto da meta já está investido: patrimônio dos investimentos do tipo dela (ou de todos). */
export function goalProgress(g: InvestmentGoal, list: Investment[]): number {
  return list.filter((i) => !g.assetType || i.type === g.assetType).reduce((a, i) => a + currentValue(i), 0);
}

export const investmentsOf = (s: Snapshot) => s.investments ?? [];

/** Busca por nome, instituição, tipo ou observação, sem acento nem caixa. */
export function matchesSearch(i: Investment, q: string): boolean {
  const norm = (x: string) => x.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const needle = norm(q.trim());
  return !needle || [i.name, i.institution, investmentTypeLabel(i.type), i.notes].some((x) => norm(x).includes(needle));
}
