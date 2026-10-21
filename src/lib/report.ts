// Exportação de lançamentos: filtro por período, tipo e pessoa; planilha e relatório para PDF.
import { addMonths, monthLabel } from "./dates";
import { formatBRL } from "./money";
import { budgetMonth } from "./summary";
import type { Snapshot, Transaction } from "./types";
import type { Cell, Sheet } from "./xlsx";

export type Period = "month" | "prev" | "last3" | "year" | "all";
export type KindFilter = "all" | "income" | "expense";

export const periodLabels: Record<Period, string> = {
  month: "Mês selecionado", prev: "Mês anterior", last3: "Últimos 3 meses", year: "Ano do mês selecionado", all: "Todo o período",
};

/** Meses (AAAA-MM-01) incluídos no período, a partir do mês selecionado; null = todos. */
export function periodMonths(period: Period, month: string): { from: string; to: string } | null {
  switch (period) {
    case "month": return { from: month, to: month };
    case "prev": return { from: addMonths(month, -1), to: addMonths(month, -1) };
    case "last3": return { from: addMonths(month, -2), to: month };
    case "year": return { from: month.slice(0, 4) + "-01-01", to: month.slice(0, 4) + "-12-01" };
    case "all": return null;
  }
}

export function periodTitle(period: Period, month: string): string {
  const r = periodMonths(period, month);
  if (!r) return "Todo o período";
  if (period === "year") return `Ano de ${month.slice(0, 4)}`;
  return r.from === r.to ? monthLabel(r.from) : `${monthLabel(r.from)} a ${monthLabel(r.to)}`;
}

/** people: ids escolhidos ("" = titular, lançamentos sem pessoa); vazio = todos. */
export function filterForExport(s: Snapshot, o: { period: Period; month: string; kind: KindFilter; people: string[] }): Transaction[] {
  const r = periodMonths(o.period, o.month);
  return s.transactions.filter((t) => {
    const m = budgetMonth(t);
    if (r && (m < r.from || m > r.to)) return false;
    if (o.kind === "income" && t.kind !== "income") return false;
    if (o.kind === "expense" && t.kind !== "expense") return false;
    if (o.people.length && !o.people.includes(t.personId ?? "")) return false;
    return true;
  }).sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.createdAt.localeCompare(b.createdAt));
}

const kindLabel: Record<Transaction["kind"], string> = { income: "Receita", expense: "Despesa", transfer: "Transferência", card_payment: "Pagamento de fatura" };
const outflow = (t: Transaction) => t.kind === "expense" || t.kind === "card_payment";

function names(s: Snapshot, selfName: string) {
  const find = <T extends { id: string; name: string }>(list: T[], id: string | null) => (id ? list.find((x) => x.id === id)?.name ?? "" : "");
  return {
    category: (t: Transaction) => find(s.categories, t.categoryId),
    where: (t: Transaction) => find(s.accounts, t.accountId) || find(s.cards, t.cardId),
    person: (t: Transaction) => find(s.people, t.personId) || selfName,
  };
}

/** Linhas de dados: valor em reais com sinal (saída negativa). */
export function dataRows(s: Snapshot, items: Transaction[], selfName: string): Cell[][] {
  const n = names(s, selfName);
  return [
    ["Data", "Tipo", "Descrição", "Categoria", "Conta ou cartão", "Pessoa", "Valor (R$)", "Pago", "Parcela"],
    ...items.map((t) => [
      t.occurredOn.split("-").reverse().join("/"), kindLabel[t.kind], t.description, n.category(t), n.where(t), n.person(t),
      ((outflow(t) ? -1 : 1) * t.amountCents) / 100, t.isPaid ? "Sim" : "Não",
      t.installmentTotal ? `${t.installmentNumber}/${t.installmentTotal}` : "",
    ]),
  ];
}

export interface Totals { income: number; expense: number; byCategory: { name: string; cents: number }[]; byPerson: { name: string; cents: number }[] }

export function totals(s: Snapshot, items: Transaction[], selfName: string): Totals {
  const n = names(s, selfName);
  const income = items.filter((t) => t.kind === "income").reduce((a, t) => a + t.amountCents, 0);
  const expenses = items.filter((t) => t.kind === "expense");
  const group = (key: (t: Transaction) => string) => {
    const m = new Map<string, number>();
    for (const t of expenses) m.set(key(t) || "Sem categoria", (m.get(key(t) || "Sem categoria") ?? 0) + t.amountCents);
    return [...m].map(([name, cents]) => ({ name, cents })).sort((a, b) => b.cents - a.cents);
  };
  return { income, expense: expenses.reduce((a, t) => a + t.amountCents, 0), byCategory: group(n.category), byPerson: group(n.person) };
}

/** Planilha só com os dados (uma aba). */
export function dataSheet(s: Snapshot, items: Transaction[], selfName: string): Sheet[] {
  return [{ name: "Lançamentos", rows: dataRows(s, items, selfName), money: [6], widths: [12, 14, 36, 18, 20, 18, 14, 8, 9] }];
}

/** Relatório: resumo, gastos por categoria e por pessoa, e os lançamentos. */
export function reportSheets(s: Snapshot, items: Transaction[], selfName: string, title: string): Sheet[] {
  const t = totals(s, items, selfName);
  const summary: Cell[][] = [
    ["Relatório de lançamentos", ""], ["Período", title], ["", ""],
    ["Receitas", t.income / 100], ["Despesas", t.expense / 100], ["Saldo", (t.income - t.expense) / 100], ["", ""],
    ["Despesas por categoria", ""], ...t.byCategory.map((c) => [c.name, c.cents / 100]), ["", ""],
    ["Despesas por pessoa", ""], ...t.byPerson.map((c) => [c.name, c.cents / 100]),
  ];
  return [
    { name: "Resumo", rows: summary, money: [1], widths: [28, 18] },
    ...dataSheet(s, items, selfName),
  ];
}

const escHtml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** HTML do relatório para imprimir ou salvar em PDF. */
export function reportHtml(s: Snapshot, items: Transaction[], selfName: string, title: string): string {
  const t = totals(s, items, selfName);
  const n = names(s, selfName);
  const row = (tr: Transaction) => `<tr><td>${tr.occurredOn.split("-").reverse().join("/")}</td><td>${escHtml(tr.description)}</td><td>${escHtml(n.category(tr))}</td><td>${escHtml(n.where(tr))}</td><td>${escHtml(n.person(tr))}</td><td class="v ${outflow(tr) ? "out" : "in"}">${outflow(tr) ? "−" : "+"} ${formatBRL(tr.amountCents)}</td></tr>`;
  const list = (rows: { name: string; cents: number }[]) => rows.map((r) => `<tr><td>${escHtml(r.name)}</td><td class="v">${formatBRL(r.cents)}</td></tr>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Lançamentos - ${escHtml(title)}</title><style>
  body{font:12px/1.4 system-ui,sans-serif;color:#121a17;margin:24px}h1{font-size:18px;margin:0}h2{font-size:13px;margin:18px 0 6px}
  .muted{color:#55625d}.cards{display:flex;gap:12px;margin-top:12px}.cards div{border:1px solid #e2e7e5;border-radius:8px;padding:8px 12px}
  .cards b{display:block;font-size:15px}table{width:100%;border-collapse:collapse}td,th{padding:4px 6px;border-bottom:1px solid #e2e7e5;text-align:left}
  th{font-size:11px;color:#55625d}.v{text-align:right;white-space:nowrap}.in{color:#147a3d}.out{color:#b42d2d}.two{display:flex;gap:24px}.two>div{flex:1}
  </style></head><body><h1>Relatório de lançamentos</h1><div class="muted">${escHtml(title)} · ${items.length} lançamentos</div>
  <div class="cards"><div>Receitas<b class="in">${formatBRL(t.income)}</b></div><div>Despesas<b class="out">${formatBRL(t.expense)}</b></div><div>Saldo<b>${formatBRL(t.income - t.expense)}</b></div></div>
  <div class="two"><div><h2>Despesas por categoria</h2><table>${list(t.byCategory)}</table></div><div><h2>Despesas por pessoa</h2><table>${list(t.byPerson)}</table></div></div>
  <h2>Lançamentos</h2><table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta ou cartão</th><th>Pessoa</th><th class="v">Valor</th></tr></thead><tbody>${items.map(row).join("")}</tbody></table>
  </body></html>`;
}

/** Nome base dos arquivos exportados. */
export function exportFileName(period: Period, month: string): string {
  const r = periodMonths(period, month);
  if (!r) return "lancamentos-tudo";
  return r.from === r.to ? `lancamentos-${r.from.slice(0, 7)}` : `lancamentos-${r.from.slice(0, 7)}-a-${r.to.slice(0, 7)}`;
}

