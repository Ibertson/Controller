// Regras do espaço empresarial: CNPJ, fluxo de caixa, DRE simplificado, precificação e pendências.
import { normName } from "./categories";
import { budgetMonth } from "./summary";
import type { Category, CompanyType, Snapshot, Transaction } from "./types";

export interface CompanyTypeInfo { value: CompanyType; label: string; short: string; hint: string; code?: string }

/** Tipos que aparecem no cadastro, com a dica mostrada embaixo do campo. */
export const COMPANY_TYPES: CompanyTypeInfo[] = [
  { value: "mei", label: "MEI (Microempreendedor Individual)", short: "MEI", hint: "Limite anual: R$ 81.000,00", code: "MEI" },
  { value: "me", label: "ME (Microempresa)", short: "ME", hint: "Limite anual: até R$ 360.000,00", code: "ME" },
  { value: "me_simples", label: "ME - Simples Nacional", short: "ME - Simples Nacional", hint: "Limite anual: até R$ 360.000,00", code: "ME_SN" },
  { value: "epp", label: "EPP (Empresa de Pequeno Porte)", short: "EPP", hint: "Limite anual: até R$ 4.800.000,00", code: "EPP" },
  { value: "epp_simples", label: "EPP - Simples Nacional", short: "EPP - Simples Nacional", hint: "Limite anual: até R$ 4.800.000,00", code: "EPP_SN" },
  { value: "presumido", label: "Lucro Presumido", short: "Lucro Presumido", hint: "Regime tributário: Lucro Presumido", code: "LP" },
  { value: "real", label: "Lucro Real", short: "Lucro Real", hint: "Regime tributário: Lucro Real", code: "LR" },
  { value: "outro", label: "Outro tipo de empresa", short: "", hint: "Você poderá ajustar os limites nas configurações", code: "OUTRO" },
];
/** Tipos do primeiro cadastro, que não aparecem mais na lista mas continuam valendo. */
const LEGACY_TYPES: CompanyTypeInfo[] = [
  { value: "ltda", label: "LTDA (Sociedade Limitada)", short: "LTDA", hint: "", code: "LTDA" },
  { value: "slu", label: "SLU (Sociedade Limitada Unipessoal)", short: "SLU", hint: "", code: "SLU" },
  { value: "sa", label: "S/A (Sociedade Anônima)", short: "S/A", hint: "", code: "SA" },
  { value: "autonomo", label: "Autônomo / Profissional liberal", short: "Autônomo", hint: "", code: "AUTONOMO" },
];
export const companyTypeInfo = (t: CompanyType | null | undefined) => [...COMPANY_TYPES, ...LEGACY_TYPES].find((x) => x.value === t);

/** "R$ 75,60" ou "75,60" → 7560; null quando vazio ou inválido. */
export function parseCents(v: string): number | null {
  const s = v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/* ---------------------------------- CNAE ---------------------------------- */

/** 6201501 → 6201-5/01 (formata enquanto digita). */
export function formatCnae(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 7);
  return d.replace(/^(\d{4})(\d)/, "$1-$2").replace(/^(\d{4}-\d)(\d)/, "$1/$2");
}

/* ---------------------------------- CNPJ ---------------------------------- */

export const cnpjDigits = (v: string) => v.replace(/\D/g, "").slice(0, 14);

/** 12345678000195 → 12.345.678/0001-95 (enquanto digita, formata o que já tem). */
export function formatCnpj(v: string): string {
  const d = cnpjDigits(v);
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}

/** Confere os dois dígitos verificadores do CNPJ. */
export function isValidCnpj(v: string): boolean {
  const d = cnpjDigits(v);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const check = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = w.reduce((s, x, i) => s + x * Number(d[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return check(12) === Number(d[12]) && check(13) === Number(d[13]);
}

/** Dados públicos do CNPJ (BrasilAPI, que repassa o cadastro da Receita Federal). */
export interface CnpjData { legalName?: string; tradeName?: string; email?: string; city?: string; uf?: string; cnae?: string; openedOn?: string }

/** Lê a resposta da BrasilAPI (/api/cnpj/v1/{cnpj}). */
export function fromBrasilApi(j: Record<string, unknown>): CnpjData {
  const str = (k: string) => (typeof j[k] === "string" && (j[k] as string).trim()) || undefined;
  const title = (v?: string) => v?.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
  const cnae = j.cnae_fiscal != null ? String(j.cnae_fiscal).replace(/\D/g, "").padStart(7, "0") : undefined;
  const opened = str("data_inicio_atividade");
  return {
    legalName: str("razao_social"), tradeName: str("nome_fantasia"), email: str("email")?.toLowerCase(),
    city: title(str("municipio")), uf: str("uf")?.toUpperCase(), cnae: cnae && /^\d{7}$/.test(cnae) ? cnae : undefined,
    openedOn: opened && /^\d{4}-\d{2}-\d{2}$/.test(opened) ? opened : undefined,
  };
}

export async function lookupCnpj(cnpj: string): Promise<CnpjData> {
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits(cnpj)}`);
  if (res.status === 404) throw new Error("CNPJ não encontrado na Receita.");
  if (!res.ok) throw new Error("Não foi possível consultar a Receita agora. Tente mais tarde.");
  return fromBrasilApi(await res.json());
}

/* ------------------------------ Fluxo de caixa ------------------------------ */

export interface CashMonth {
  month: string;
  /** Recebido e pago no mês (o que passou pelas contas). */
  inCents: number; outCents: number; netCents: number;
  /** Saldo das contas no fim do mês. */
  closingCents: number;
  /** Lançado para o mês e ainda não recebido / não pago. */
  toReceiveCents: number; toPayCents: number;
}

/** 12 meses do ano: entradas e saídas pagas, saldo do fim de cada mês e o que falta receber e pagar. */
export function cashFlow(s: Snapshot, year: number): { openingCents: number; months: CashMonth[] } {
  const ids = new Set(s.accounts.map((a) => a.id));
  const inAcc = (id: string | null) => !!id && ids.has(id);
  const start = `${year}-01-01`;
  let balance = s.accounts.reduce((a, x) => a + x.initialBalanceCents, 0);
  const months: CashMonth[] = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, "0")}-01`, inCents: 0, outCents: 0, netCents: 0, closingCents: 0, toReceiveCents: 0, toPayCents: 0,
  }));
  for (const t of s.transactions) {
    const idx = Number(t.occurredOn.slice(5, 7)) - 1;
    const sameYear = t.occurredOn.slice(0, 4) === String(year);
    if (!t.isPaid) {
      const due = t.dueOn ?? t.occurredOn;
      if (due.slice(0, 4) !== String(year)) continue;
      const m = months[Number(due.slice(5, 7)) - 1];
      if (t.kind === "income") m.toReceiveCents += t.amountCents;
      else if (t.kind === "expense" && !t.cardId) m.toPayCents += t.amountCents;
      continue;
    }
    let inc = 0, out = 0;
    if (t.kind === "income" && inAcc(t.accountId)) inc = t.amountCents;
    else if ((t.kind === "expense" || t.kind === "card_payment") && inAcc(t.accountId)) out = t.amountCents;
    else continue; // transferência entre contas e compra no cartão (sai quando paga a fatura) não mexem no caixa
    if (t.occurredOn < start) balance += inc - out;
    else if (sameYear) { months[idx].inCents += inc; months[idx].outCents += out; }
  }
  const openingCents = balance;
  for (const m of months) {
    m.netCents = m.inCents - m.outCents;
    balance += m.netCents;
    m.closingCents = balance;
  }
  return { openingCents, months };
}

/* ------------------------------ DRE simplificado ------------------------------ */

export type DreGroup = "taxes" | "costs" | "opex" | "prolabore" | "financial";

const GROUP_WORDS: [DreGroup, RegExp][] = [
  ["taxes", /imposto|das\b|simples|iss\b|icms|tributo|darf/],
  ["costs", /fornecedor|mercadoria|materia.?prima|insumo|frete|embalage|custo/],
  ["prolabore", /pro.?labore|retirada/],
  ["financial", /emprestimo|financiamento|juros|tarifa|taxas? bancaria|maquininha/],
];

/** Em que linha da DRE uma despesa entra, pelo nome da categoria (ou da categoria pai). */
export function dreGroup(cat: Category | undefined, parent?: Category): DreGroup {
  const names = [cat?.name, parent?.name].filter(Boolean).map((n) => normName(n!));
  for (const [g, re] of GROUP_WORDS) if (names.some((n) => re.test(n))) return g;
  return "opex";
}

export interface Dre {
  grossCents: number; taxesCents: number; netRevenueCents: number;
  costsCents: number; grossProfitCents: number;
  opexCents: number; operatingCents: number;
  prolaboreCents: number; financialCents: number; resultCents: number;
  /** Despesas por categoria em cada linha (para abrir o detalhe). */
  detail: Record<DreGroup, { name: string; cents: number }[]>;
}

/** DRE do mês pelo regime de competência: tudo que foi lançado no mês, pago ou não. */
export function dre(s: Snapshot, month: string): Dre {
  const byId = new Map(s.categories.map((c) => [c.id, c]));
  const detail: Dre["detail"] = { taxes: [], costs: [], opex: [], prolabore: [], financial: [] };
  const sums: Record<DreGroup, number> = { taxes: 0, costs: 0, opex: 0, prolabore: 0, financial: 0 };
  let gross = 0;
  const add = (g: DreGroup, name: string, cents: number) => {
    sums[g] += cents;
    const row = detail[g].find((r) => r.name === name);
    if (row) row.cents += cents; else detail[g].push({ name, cents });
  };
  for (const t of s.transactions as Transaction[]) {
    if (budgetMonth(t) !== month) continue;
    if (t.kind === "income") { gross += t.amountCents; continue; }
    if (t.kind !== "expense") continue;
    const c = t.categoryId ? byId.get(t.categoryId) : undefined;
    const p = c?.parentId ? byId.get(c.parentId) : undefined;
    add(dreGroup(c, p), (p ?? c)?.name ?? "Sem categoria", t.amountCents);
  }
  for (const g of Object.keys(detail) as DreGroup[]) detail[g].sort((a, b) => b.cents - a.cents);
  const netRevenueCents = gross - sums.taxes;
  const grossProfitCents = netRevenueCents - sums.costs;
  const operatingCents = grossProfitCents - sums.opex;
  return {
    grossCents: gross, taxesCents: sums.taxes, netRevenueCents, costsCents: sums.costs, grossProfitCents,
    opexCents: sums.opex, operatingCents, prolaboreCents: sums.prolabore, financialCents: sums.financial,
    resultCents: operatingCents - sums.prolabore - sums.financial, detail,
  };
}

/* ------------------------------- Precificação ------------------------------- */

export interface PriceInput { costCents: number; fixedPct: number; taxPct: number; feePct: number; commissionPct: number; marginPct: number }
export interface PriceResult { priceCents: number; markup: number; profitCents: number; parts: { label: string; cents: number }[] }

/**
 * Preço de venda por markup divisor: preço = custo ÷ (1 − soma dos percentuais sobre a venda).
 * null quando os percentuais somam 100% ou mais (não existe preço que cubra).
 */
export function priceFor(i: PriceInput): PriceResult | null {
  const pct = i.fixedPct + i.taxPct + i.feePct + i.commissionPct + i.marginPct;
  if (i.costCents <= 0 || pct >= 100 || [i.fixedPct, i.taxPct, i.feePct, i.commissionPct, i.marginPct].some((x) => x < 0)) return null;
  const priceCents = Math.round(i.costCents / (1 - pct / 100));
  const of = (p: number) => Math.round((priceCents * p) / 100);
  const parts = [
    { label: "Custo do produto", cents: i.costCents },
    { label: "Despesas fixas", cents: of(i.fixedPct) },
    { label: "Impostos", cents: of(i.taxPct) },
    { label: "Taxa do cartão/maquininha", cents: of(i.feePct) },
    { label: "Comissão", cents: of(i.commissionPct) },
  ];
  const profitCents = priceCents - parts.reduce((a, p) => a + p.cents, 0);
  return { priceCents, markup: priceCents / i.costCents, profitCents, parts };
}

/* -------------------------------- Pendências -------------------------------- */

export interface Pending { id: string; kind: "pay" | "receive" | "reminder"; title: string; dueOn: string; amountCents?: number; href: string }

/** O que está atrasado: contas a pagar e a receber vencidas e lembretes que passaram da data. */
export function overdue(s: Snapshot, todayStr: string): Pending[] {
  const out: Pending[] = [];
  for (const t of s.transactions) {
    if (t.isPaid || (t.kind !== "income" && t.kind !== "expense") || (t.kind === "expense" && t.cardId)) continue;
    const due = t.dueOn ?? t.occurredOn;
    if (due >= todayStr) continue;
    out.push({ id: t.id, kind: t.kind === "income" ? "receive" : "pay", title: t.description || (t.kind === "income" ? "Receita" : "Despesa"), dueOn: due, amountCents: t.amountCents, href: "/transacoes" });
  }
  for (const r of s.reminders ?? []) {
    if (r.doneAt || r.dueOn >= todayStr) continue;
    out.push({ id: r.id, kind: "reminder", title: r.title, dueOn: r.dueOn, href: "/lembretes" });
  }
  return out.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}
