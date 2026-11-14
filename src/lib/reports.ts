// Relatórios da empresa: os dados de cada relatório num formato só, usado na prévia, no PDF (impressão) e no Excel.
import { paymentMethodLabel } from "./expenses";
import { budgetMonth } from "./summary";
import type { BusinessClient, CompanyType, ExpenseDetail, ProLaboreWithdrawal, Receivable, Snapshot, Transaction } from "./types";
import type { Sheet } from "./xlsx";

export const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export type PeriodKind = "mensal" | "trimestral" | "anual";
export interface Period { kind: PeriodKind; year: number; month: number; quarter: number; }

/** Meses ("YYYY-MM-01") do período. */
export function periodMonths(p: Period): string[] {
  const m = (n: number) => `${p.year}-${String(n).padStart(2, "0")}-01`;
  if (p.kind === "mensal") return [m(p.month)];
  if (p.kind === "trimestral") return [0, 1, 2].map((i) => m((p.quarter - 1) * 3 + 1 + i));
  return Array.from({ length: 12 }, (_, i) => m(i + 1));
}

export function periodLabel(p: Period): string {
  if (p.kind === "mensal") return `${MONTHS[p.month - 1]}/${p.year}`;
  if (p.kind === "trimestral") return `${p.quarter}º trimestre/${p.year}`;
  return String(p.year);
}

/** Limite anual de faturamento por tipo de empresa; null quando não há limite. */
export function revenueLimit(type: CompanyType | null | undefined): number | null {
  if (type === "mei") return 8_100_000;
  if (type === "me" || type === "me_simples") return 36_000_000;
  if (type === "epp" || type === "epp_simples") return 480_000_000;
  return null;
}

export type ColKind = "text" | "money" | "int" | "pct";
export interface Column { label: string; kind: ColKind; }
export type Value = string | number;
export interface Section { title: string; columns: Column[]; rows: Value[][]; total?: Value[]; empty: string; }
export interface Kpi { label: string; value: string; tone?: "in" | "out" | "ok"; }
export interface Report { id: ReportId; title: string; period: string; kpis: Kpi[]; sections: Section[]; note?: string; extra?: { label: string; value: string; hint: string; pct: number } }

export type ReportId = "geral" | "vendas" | "clientes" | "notas" | "despesas" | "contador";

export interface ReportData {
  snap: Snapshot; companyType: CompanyType | null | undefined;
  receivables: Receivable[]; clients: BusinessClient[]; details: ExpenseDetail[]; prolabore: ProLaboreWithdrawal[];
}

const col = (label: string, kind: ColKind = "text"): Column => ({ label, kind });
const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct1 = (n: number) => Math.round(n * 10) / 10;
const dateBR = (d: string) => d.split("-").reverse().join("/");
const DAS_RE = /\bdas\b/i;

/** Lançamentos de receita/despesa do período, pela regra do orçamento (cartão pelo mês da fatura). */
function txIn(s: Snapshot, months: string[], kind: "income" | "expense"): Transaction[] {
  const set = new Set(months);
  return s.transactions.filter((t) => t.kind === kind && set.has(budgetMonth(t))).sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.createdAt.localeCompare(b.createdAt));
}

function helpers(d: ReportData) {
  const cats = new Map(d.snap.categories.map((c) => [c.id, c]));
  const topCat = (id: string | null) => {
    const c = id ? cats.get(id) : undefined;
    const parent = c?.parentId ? cats.get(c.parentId) : undefined;
    return (parent ?? c)?.name ?? "Sem categoria";
  };
  const catName = (id: string | null) => (id ? cats.get(id)?.name : undefined) ?? "Sem categoria";
  const accounts = new Map(d.snap.accounts.map((a) => [a.id, a.name]));
  const people = new Map(d.snap.people.map((p) => [p.id, p.name]));
  const clients = new Map(d.clients.map((c) => [c.id, c.name]));
  const recByTx = new Map(d.receivables.filter((r) => r.transactionId).map((r) => [r.transactionId!, r]));
  const clientOf = (t: Transaction) => {
    const r = recByTx.get(t.id);
    if (r?.clientId && clients.get(r.clientId)) return clients.get(r.clientId)!;
    if (t.personId && people.get(t.personId)) return people.get(t.personId)!;
    return "Sem cliente identificado";
  };
  const details = new Map(d.details.map((x) => [x.transactionId, x]));
  const isDas = (t: Transaction) => t.kind === "expense" && (DAS_RE.test(t.description) || DAS_RE.test(catName(t.categoryId)));
  return { topCat, catName, account: (id: string | null) => (id ? accounts.get(id) : undefined) ?? "—", clientOf, details, isDas };
}

/** Agrupa somando valor e contagem, do maior para o menor. */
function group<T>(list: T[], key: (t: T) => string, cents: (t: T) => number) {
  const m = new Map<string, { key: string; count: number; cents: number }>();
  for (const t of list) {
    const k = key(t);
    const g = m.get(k) ?? { key: k, count: 0, cents: 0 };
    g.count++; g.cents += cents(t); m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.cents - a.cents || a.key.localeCompare(b.key, "pt-BR"));
}

const sum = (list: Transaction[]) => list.reduce((t, x) => t + x.amountCents, 0);
const share = (part: number, whole: number) => (whole > 0 ? pct1((part / whole) * 100) : 0);

export function buildReport(id: ReportId, d: ReportData, p: Period): Report {
  const months = periodMonths(p);
  const h = helpers(d);
  const income = txIn(d.snap, months, "income");
  const expense = txIn(d.snap, months, "expense");
  const revenue = sum(income), spent = sum(expense);
  const das = expense.filter((t) => h.isDas(t) && t.isPaid);
  const base = { id, period: periodLabel(p) };

  if (id === "geral") {
    const limit = revenueLimit(d.companyType);
    const ytdMonths = Array.from({ length: Number(months[months.length - 1].slice(5, 7)) }, (_, i) => `${p.year}-${String(i + 1).padStart(2, "0")}-01`);
    const ytd = sum(txIn(d.snap, ytdMonths, "income"));
    return {
      ...base, title: "Relatório Geral",
      kpis: [
        { label: "Faturamento", value: brl(revenue), tone: "in" }, { label: "Despesas", value: brl(spent), tone: "out" },
        { label: "Resultado", value: brl(revenue - spent), tone: revenue - spent < 0 ? "out" : "in" }, { label: "DAS pago", value: brl(sum(das)), tone: "ok" },
      ],
      extra: limit ? { label: "Limite anual utilizado", value: `${share(ytd, limit).toLocaleString("pt-BR")}% de ${brl(limit)}`, hint: ytd >= limit ? `Passou ${brl(ytd - limit)} do limite` : `Faltam ${brl(limit - ytd)}`, pct: share(ytd, limit) } : undefined,
      sections: [{
        title: "Mês a mês", columns: [col("Mês"), col("Faturamento", "money"), col("Despesas", "money"), col("Resultado", "money"), col("DAS pago", "money")],
        rows: months.map((m) => {
          const i = income.filter((t) => budgetMonth(t) === m), e = expense.filter((t) => budgetMonth(t) === m);
          return [`${MONTHS[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}`, sum(i), sum(e), sum(i) - sum(e), sum(das.filter((t) => budgetMonth(t) === m))];
        }),
        total: months.length > 1 ? ["Total", revenue, spent, revenue - spent, sum(das)] : undefined, empty: "Nenhum lançamento no período.",
      }],
      note: limit ? `Limite anual somando o faturamento de janeiro até o fim do período (${brl(ytd)}).` : "O seu tipo de empresa não tem limite anual de faturamento.",
    };
  }

  if (id === "vendas") {
    const received = sum(income.filter((t) => t.isPaid));
    return {
      ...base, title: "Relatório de Vendas",
      kpis: [{ label: "Vendas", value: String(income.length) }, { label: "Total", value: brl(revenue), tone: "in" }, { label: "Recebido", value: brl(received), tone: "in" }, { label: "A receber", value: brl(revenue - received) }],
      sections: [
        { title: "Vendas", columns: [col("Data"), col("Descrição"), col("Cliente"), col("Categoria"), col("Conta de entrada"), col("Status"), col("Valor", "money")],
          rows: income.map((t) => [dateBR(t.occurredOn), t.description, h.clientOf(t), h.catName(t.categoryId), h.account(t.accountId), t.isPaid ? "Recebido" : "A receber", t.amountCents]),
          total: income.length ? ["Total", "", "", "", "", "", revenue] : undefined, empty: "Nenhuma venda no período." },
        { title: "Por cliente", columns: [col("Cliente"), col("Vendas", "int"), col("Valor", "money")],
          rows: group(income, h.clientOf, (t) => t.amountCents).map((g) => [g.key, g.count, g.cents]), empty: "Nenhuma venda no período." },
        { title: "Por conta de entrada", columns: [col("Conta"), col("Vendas", "int"), col("Valor", "money")],
          rows: group(income, (t) => h.account(t.accountId), (t) => t.amountCents).map((g) => [g.key, g.count, g.cents]), empty: "Nenhuma venda no período." },
      ],
      note: "Vendas são as receitas lançadas no período. A forma de recebimento aparece pela conta onde o dinheiro entrou.",
    };
  }

  if (id === "clientes") {
    const groups = group(income, h.clientOf, (t) => t.amountCents);
    return {
      ...base, title: "Ranking de Clientes",
      kpis: [{ label: "Clientes", value: String(groups.filter((g) => g.key !== "Sem cliente identificado").length) }, { label: "Faturamento", value: brl(revenue), tone: "in" }, { label: "Maior cliente", value: groups[0] ? groups[0].key : "—" }],
      sections: [{ title: "Ranking", columns: [col("Posição", "int"), col("Cliente"), col("Vendas", "int"), col("Valor total", "money"), col("% do faturamento", "pct")],
        rows: groups.map((g, i) => [i + 1, g.key, g.count, g.cents, share(g.cents, revenue)]), empty: "Nenhuma venda no período." }],
      note: "O cliente vem da conta a receber (Clientes & Recebíveis) ou da pessoa marcada no lançamento.",
    };
  }

  if (id === "notas") {
    return {
      ...base, title: "Relatório de Notas",
      kpis: [{ label: "Notas emitidas", value: "0" }, { label: "Valor total", value: brl(0) }, { label: "Canceladas", value: "0" }],
      sections: [{ title: "Notas fiscais", columns: [col("Número"), col("Data"), col("Cliente"), col("Status"), col("Valor", "money")], rows: [], empty: "Nenhuma nota fiscal registrada no período." }],
      note: "O Sobra ainda não registra notas fiscais. Quando o módulo Notas Fiscais existir, as notas emitidas aparecem aqui.",
    };
  }

  if (id === "despesas") {
    const method = (t: Transaction) => paymentMethodLabel(h.details.get(t.id)?.paymentMethod ?? "") || "Não informado";
    const supplier = (t: Transaction) => h.details.get(t.id)?.supplier?.trim() || "Não informado";
    const groupRows = (key: (t: Transaction) => string) => group(expense, key, (t) => t.amountCents).map((g) => [g.key, g.count, g.cents, share(g.cents, revenue)]);
    const cols4 = (first: string) => [col(first), col("Lançamentos", "int"), col("Valor", "money"), col("% do faturamento", "pct")];
    return {
      ...base, title: "Relatório de Despesas",
      kpis: [{ label: "Despesas", value: brl(spent), tone: "out" }, { label: "Pagas", value: brl(sum(expense.filter((t) => t.isPaid))) }, { label: "Pendentes", value: brl(sum(expense.filter((t) => !t.isPaid))) }, { label: "% do faturamento", value: revenue > 0 ? `${share(spent, revenue).toLocaleString("pt-BR")}%` : "—" }],
      sections: [
        { title: "Por categoria", columns: cols4("Categoria"), rows: groupRows((t) => h.topCat(t.categoryId)), empty: "Nenhuma despesa no período." },
        { title: "Por fornecedor", columns: cols4("Fornecedor"), rows: groupRows(supplier), empty: "Nenhuma despesa no período." },
        { title: "Por forma de pagamento", columns: cols4("Forma de pagamento"), rows: groupRows(method), empty: "Nenhuma despesa no período." },
        { title: "Lançamentos", columns: [col("Data"), col("Descrição"), col("Categoria"), col("Fornecedor"), col("Forma"), col("Status"), col("Valor", "money")],
          rows: expense.map((t) => [dateBR(t.occurredOn), t.description, h.catName(t.categoryId), supplier(t), method(t), t.isPaid ? "Pago" : "Pendente", t.amountCents]),
          total: expense.length ? ["Total", "", "", "", "", "", spent] : undefined, empty: "Nenhuma despesa no período." },
      ],
    };
  }

  // contador
  const monthSet = new Set(months.map((m) => m.slice(0, 7)));
  const pl = d.prolabore.filter((w) => monthSet.has(w.month)).sort((a, b) => a.month.localeCompare(b.month));
  const withReceipt = expense.filter((t) => h.details.get(t.id)?.receiptPath).length;
  return {
    ...base, title: "Relatório para Contador",
    kpis: [{ label: "Receitas", value: brl(revenue), tone: "in" }, { label: "Despesas", value: brl(spent), tone: "out" }, { label: "DAS pago", value: brl(sum(das)) }, { label: "Pró-labore", value: brl(pl.reduce((t, w) => t + w.amountCents, 0)) }],
    sections: [
      { title: "Receitas", columns: [col("Data"), col("Descrição"), col("Cliente"), col("Categoria"), col("Status"), col("Valor", "money")],
        rows: income.map((t) => [dateBR(t.occurredOn), t.description, h.clientOf(t), h.catName(t.categoryId), t.isPaid ? "Recebido" : "A receber", t.amountCents]), total: income.length ? ["Total", "", "", "", "", revenue] : undefined, empty: "Nenhuma receita no período." },
      { title: "Despesas", columns: [col("Data"), col("Descrição"), col("Categoria"), col("Fornecedor"), col("Forma"), col("Status"), col("Comprovante"), col("Histórico"), col("Valor", "money")],
        rows: expense.map((t) => { const x = h.details.get(t.id); return [dateBR(t.occurredOn), t.description, h.catName(t.categoryId), x?.supplier || "", paymentMethodLabel(x?.paymentMethod ?? ""), t.isPaid ? "Pago" : "Pendente", x?.receiptPath ? "Sim" : "Não", x?.notes ?? "", t.amountCents]; }),
        total: expense.length ? ["Total", "", "", "", "", "", "", "", spent] : undefined, empty: "Nenhuma despesa no período." },
      { title: "DAS pagos", columns: [col("Data"), col("Descrição"), col("Valor", "money")], rows: das.map((t) => [dateBR(t.occurredOn), t.description, t.amountCents]), empty: "Nenhum DAS pago no período." },
      { title: "Pró-labore", columns: [col("Mês de referência"), col("Data"), col("Valor", "money")],
        rows: pl.map((w) => [`${MONTHS[Number(w.month.slice(5, 7)) - 1]}/${w.month.slice(0, 4)}`, dateBR(d.snap.transactions.find((t) => t.id === w.expenseTxId)?.occurredOn ?? w.createdAt.slice(0, 10)), w.amountCents]), empty: "Nenhuma retirada no período." },
    ],
    note: `${withReceipt} de ${expense.length} despesas com comprovante anexado. DAS são as despesas pagas com "DAS" na descrição ou na categoria.`,
  };
}

/** Abas do Excel: um resumo e uma aba por seção (dinheiro em reais, porcentagem em número). */
export function reportSheets(r: Report, company: string): Sheet[] {
  const used = new Set<string>();
  const name = (n: string) => {
    let s = n.replace(/[[\]:*?/\\]/g, " ").slice(0, 31), i = 2;
    while (used.has(s.toLowerCase())) s = `${n.slice(0, 28)} ${i++}`;
    used.add(s.toLowerCase());
    return s;
  };
  const resumo: Sheet = { name: name("Resumo"), widths: [28, 40], rows: [
    [r.title, r.period], ["Empresa", company], ...r.kpis.map((k) => [k.label, k.value]),
    ...(r.extra ? [[r.extra.label, r.extra.value], ["", r.extra.hint]] : []), ...(r.note ? [["Observação", r.note]] : []),
  ] };
  const sections = r.sections.map((s): Sheet => {
    const conv = (row: Value[]) => row.map((v, i) => (typeof v === "number" && s.columns[i]?.kind === "money" ? v / 100 : v));
    return {
      name: name(s.title), widths: s.columns.map((c) => (c.kind === "text" ? 26 : 16)),
      money: s.columns.flatMap((c, i) => (c.kind === "money" ? [i] : [])),
      rows: [s.columns.map((c) => c.label), ...(s.rows.length ? s.rows.map(conv) : [[s.empty]]), ...(s.total ? [conv(s.total)] : [])],
    };
  });
  return [resumo, ...sections];
}

/** Valor para mostrar numa célula da prévia/PDF. */
export function showValue(v: Value, kind: ColKind): string {
  if (typeof v === "string") return v;
  if (kind === "money") return brl(v);
  if (kind === "pct") return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return v.toLocaleString("pt-BR");
}
