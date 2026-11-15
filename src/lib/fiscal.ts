import { addMonths } from "./dates";
import { monthTotals } from "./summary";
import type { CompanyType, Snapshot, Transaction } from "./types";

/** Anexos do Simples Nacional (LC 123/2006, tabelas vigentes desde 2018). */
export type Anexo = 1 | 2 | 3 | 4 | 5;
export const ANEXOS: { id: Anexo; label: string }[] = [
  { id: 1, label: "Anexo I — Comércio" },
  { id: 2, label: "Anexo II — Indústria" },
  { id: 3, label: "Anexo III — Serviços (fator R ≥ 28%)" },
  { id: 4, label: "Anexo IV — Serviços (construção, vigilância, limpeza etc.)" },
  { id: 5, label: "Anexo V — Serviços (fator R < 28%)" },
];
export const anexoLabel = (a: Anexo) => ANEXOS.find((x) => x.id === a)?.label ?? `Anexo ${a}`;
export const asAnexo = (v: unknown): Anexo | null => (typeof v === "number" && [1, 2, 3, 4, 5].includes(v) ? (v as Anexo) : null);

/** Teto de cada faixa (receita bruta dos últimos 12 meses), em centavos. */
const FAIXAS = [18_000_000, 36_000_000, 72_000_000, 180_000_000, 360_000_000, 480_000_000];
/** [alíquota nominal %, parcela a deduzir em reais] por faixa. */
const TABELAS: Record<Anexo, [number, number][]> = {
  1: [[4, 0], [7.3, 5_940], [9.5, 13_860], [10.7, 22_500], [14.3, 87_300], [19, 378_000]],
  2: [[4.5, 0], [7.8, 5_940], [10, 13_860], [11.2, 22_500], [14.7, 85_500], [30, 720_000]],
  3: [[6, 0], [11.2, 9_360], [13.5, 17_640], [16, 35_640], [21, 125_640], [33, 648_000]],
  4: [[4.5, 0], [9, 8_100], [10.2, 12_420], [14, 39_780], [22, 183_780], [33, 828_000]],
  5: [[15.5, 0], [18, 4_500], [19.5, 9_900], [20.5, 17_100], [23, 62_100], [30.5, 540_000]],
};

/** Empresas que podem estar no Simples Nacional (fora o MEI, que paga o DAS fixo). */
export const isSimples = (t: CompanyType | null | undefined) => t === "me" || t === "me_simples" || t === "epp" || t === "epp_simples";

export interface Rate { faixa: number; nominal: number; deductionCents: number; effective: number; /** Sem arredondar, para o cálculo. */ exact: number }
/** Alíquota efetiva = (RBT12 × nominal − dedução) / RBT12. null acima de R$ 4,8 milhões. */
export function effectiveRate(anexo: Anexo, rbt12Cents: number): Rate | null {
  const i = FAIXAS.findIndex((teto) => rbt12Cents <= teto);
  if (i < 0) return null;
  const [nominal, ded] = TABELAS[anexo][i];
  const deductionCents = ded * 100;
  const effective = rbt12Cents <= 0 ? nominal : Math.max(0, (rbt12Cents * nominal / 100 - deductionCents) / rbt12Cents * 100);
  return { faixa: i + 1, nominal, deductionCents, effective: Math.round(effective * 100) / 100, exact: effective };
}

const revenue = (s: Snapshot, month: string) => monthTotals(s, month).incomeCents;

/** Primeiro mês com receita (YYYY-MM-01), ou null. */
function firstRevenueMonth(s: Snapshot): string | null {
  let first: string | null = null;
  for (const t of s.transactions) if (t.kind === "income" && (!first || t.occurredOn < first)) first = t.occurredOn;
  return first ? `${first.slice(0, 7)}-01` : null;
}

/**
 * Receita bruta dos 12 meses anteriores ao mês da guia (RBT12).
 * Empresa com menos de 12 meses: média dos meses que tem × 12; no primeiro mês, a receita do mês × 12.
 */
export function rbt12(s: Snapshot, month: string): { cents: number; proportional: boolean } {
  const first = firstRevenueMonth(s);
  const prev = Array.from({ length: 12 }, (_, i) => addMonths(month, -(i + 1)));
  const active = first ? prev.filter((m) => m >= first) : [];
  if (active.length === 12) return { cents: active.reduce((t, m) => t + revenue(s, m), 0), proportional: false };
  if (active.length === 0) return { cents: revenue(s, month) * 12, proportional: true };
  return { cents: Math.round(active.reduce((t, m) => t + revenue(s, m), 0) / active.length * 12), proportional: true };
}

/** Vencimento da guia: dia 20 do mês seguinte; sábado ou domingo passa para segunda. */
export function dueDate(month: string): string {
  const next = addMonths(month, 1);
  const d = new Date(`${next.slice(0, 8)}20T12:00:00Z`);
  const wd = d.getUTCDay();
  if (wd === 6) d.setUTCDate(22);
  if (wd === 0) d.setUTCDate(21);
  return d.toISOString().slice(0, 10);
}

export interface Guide { month: string; revenueCents: number; rbt12Cents: number; proportional: boolean; rate: Rate | null; valueCents: number; dueOn: string }
/** Guia mensal do Simples (DAS) estimada pela receita do mês. */
export function simplesGuide(s: Snapshot, month: string, anexo: Anexo): Guide {
  const rev = revenue(s, month);
  const r = rbt12(s, month);
  const rate = effectiveRate(anexo, r.cents);
  return { month, revenueCents: rev, rbt12Cents: r.cents, proportional: r.proportional, rate, valueCents: rate ? Math.round(rev * rate.exact / 100) : 0, dueOn: dueDate(month) };
}

/** Referência usada na descrição da guia: 11/2026. */
export const guideRef = (month: string) => `${month.slice(5, 7)}/${month.slice(0, 4)}`;
const DAS_RE = /\bdas\b/i;
/** A despesa da guia deste mês, se já foi lançada (descrição com "DAS" e a referência). */
export function guideExpense(s: Snapshot, month: string): Transaction | undefined {
  const ref = guideRef(month);
  return s.transactions.find((t) => t.kind === "expense" && !t.deletedAt && DAS_RE.test(t.description) && t.description.includes(ref));
}

export interface YearProgress { year: number; billedCents: number; availableCents: number; projectionCents: number; pct: number; months: { month: string; cumulativeCents: number; pct: number }[] }
/** Meta (limite) de faturamento do ano: faturado até o mês corrente, quanto falta, projeção e evolução acumulada. */
export function yearProgress(s: Snapshot, year: number, todayStr: string, limitCents: number): YearProgress {
  const curYear = Number(todayStr.slice(0, 4));
  const lastMonth = year < curYear ? 12 : year > curYear ? 0 : Number(todayStr.slice(5, 7));
  let cum = 0;
  const pct = (c: number) => (limitCents > 0 ? Math.round(c / limitCents * 1000) / 10 : 0);
  const months = Array.from({ length: lastMonth }, (_, i) => {
    const m = `${year}-${String(i + 1).padStart(2, "0")}-01`;
    cum += revenue(s, m);
    return { month: m, cumulativeCents: cum, pct: pct(cum) };
  });
  const projection = lastMonth === 0 ? 0 : lastMonth === 12 ? cum : Math.round(cum / lastMonth * 12);
  return { year, billedCents: cum, availableCents: Math.max(0, limitCents - cum), projectionCents: projection, pct: pct(cum), months };
}
