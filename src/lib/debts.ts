// Dívidas parceladas e financiamentos: tipos, categorias, vencimentos e totais.
import { addMonths, daysInMonth, monthOf } from "./dates";
import type { Debt, DebtType } from "./types";

export const DEBT_TYPES: [DebtType, string][] = [
  ["financiamento", "Financiamento"], ["emprestimo", "Empréstimo Bancário"], ["informal", "Dívida Informal (Pessoa)"],
  ["consorcio", "Consórcio"], ["cartao", "Parcelamento Cartão"], ["outro", "Outro"],
];
export const debtTypeLabel = (t: DebtType) => DEBT_TYPES.find(([k]) => k === t)?.[1] ?? "Outro";

/** Categorias da dívida, já prontas (texto livre na tabela). */
export const DEBT_CATEGORIES = [
  "Contas e Serviços", "Cuidados Pessoais", "Pet", "Família", "Aluguel/Financiamento", "Água", "Conta de Luz", "Manutenção",
  "Mercado", "Restaurante", "Combustível", "Táxi/App", "Manutenção Veicular", "Farmácia", "Dental", "Faculdade", "Streaming",
  "Viagem", "Roupas", "Internet/Telefone", "Barbearia/Cabelo", "Moradia", "Alimentação", "Transporte", "Saúde", "Educação",
  "Lazer", "Compras",
];

export const EXTRA_FREQUENCIES: [Debt["extraCosts"][number]["frequency"], string][] = [["unico", "Único"], ["mensal", "Mensal"], ["anual", "Anual"]];

export const isPaidOff = (d: Pick<Debt, "installmentsPaid" | "installmentsTotal">) => d.installmentsPaid >= d.installmentsTotal;
export const paidCents = (d: Debt) => d.installmentCents * d.installmentsPaid;
export const remainingCents = (d: Debt) => d.installmentCents * Math.max(0, d.installmentsTotal - d.installmentsPaid);

const pad = (n: number) => String(n).padStart(2, "0");
const onDay = (month: string, day: number) => `${month.slice(0, 8)}${pad(Math.min(day, daysInMonth(month)))}`;

/** Vencimento da parcela n (1 = primeira): no dia de vencimento, a partir da data de início. */
export function installmentDue(d: Pick<Debt, "startOn" | "dueDay">, n: number): string {
  let first = onDay(monthOf(d.startOn), d.dueDay);
  if (first < d.startOn) first = onDay(addMonths(monthOf(d.startOn), 1), d.dueDay);
  return onDay(addMonths(monthOf(first), n - 1), d.dueDay);
}

/** Próxima parcela em aberto (null se quitada). */
export const nextDue = (d: Debt) => (isPaidOff(d) ? null : installmentDue(d, d.installmentsPaid + 1));
/** Data da última parcela. */
export const lastDue = (d: Debt) => installmentDue(d, d.installmentsTotal);

/** Custos extras: o que é único, por mês e por ano. */
export function extraCostTotals(d: Pick<Debt, "extraCosts">) {
  const t = { unico: 0, mensal: 0, anual: 0 };
  for (const c of d.extraCosts) t[c.frequency] += c.amountCents;
  return t;
}

export interface DebtSummary { totalCents: number; paidCents: number; remainingCents: number; monthlyCents: number; }

/** Cartões do topo: dívida total, já pago, restante e parcelas por mês (só dívidas em aberto). */
export function debtSummary(list: Debt[]): DebtSummary {
  const open = list.filter((d) => !isPaidOff(d));
  return {
    totalCents: open.reduce((a, d) => a + d.totalCents, 0),
    paidCents: open.reduce((a, d) => a + paidCents(d), 0),
    remainingCents: open.reduce((a, d) => a + remainingCents(d), 0),
    monthlyCents: open.reduce((a, d) => a + d.installmentCents, 0),
  };
}
