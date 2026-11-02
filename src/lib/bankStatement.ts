// Extrato de conta corrente no formato dos bancos brasileiros (ex.: CSV do Bradesco):
// Data; Histórico; Docto.; Crédito (R$); Débito (R$); Saldo (R$)
// com linha de SALDO ANTERIOR, linhas de complemento sem data (Rem:/Des:), linha de Total
// e blocos extras ("Últimos Lançamentos", "Saldos Invest Fácil").
import { parseAmount, parseDate, type StatementRow } from "./statement";
import type { Cell } from "./xlsx";

/** Uma linha de lançamento do extrato, com todas as colunas do banco. */
export interface BankLine extends StatementRow {
  /** Coluna Histórico: o tipo do lançamento (Pix Enviado, Pagto Cobranca...). */
  history: string;
  /** Linha de complemento logo abaixo: quem pagou ou recebeu (Rem:, Des:, empresa). */
  detail?: string;
  /** Coluna Docto.: número do documento no banco. */
  doc?: string;
  /** Coluna Crédito (R$): o que entrou, positivo. */
  creditCents?: number;
  /** Coluna Débito (R$): o que saiu, negativo. */
  debitCents?: number;
  /** Coluna Saldo (R$): o banco só preenche no último lançamento do dia. */
  balanceCents?: number;
  /** Saldo calculado depois desta linha (saldo anterior + lançamentos até aqui). */
  runningCents?: number;
  /** "periodo" = extrato do período; "recentes" = bloco Últimos Lançamentos. */
  section: "periodo" | "recentes";
}

export interface StatementInfo {
  bank?: string;
  agency?: string;
  account?: string;
  /** Período do extrato (YYYY-MM-DD). */
  periodStart?: string;
  periodEnd?: string;
  /** Linha SALDO ANTERIOR. */
  openingCents?: number;
  openingDate?: string;
  /** Linha Total: créditos, débitos e saldo final. */
  totalCreditCents?: number;
  totalDebitCents?: number;
  closingCents?: number;
  /** Data e hora em que o banco gerou o arquivo, como escrito ("02/11/2026 às 18h47"). */
  generatedAt?: string;
  /** Saldos diários de aplicação automática (Invest Fácil), só informativo. */
  dailyBalances: { date: string; balanceCents: number }[];
  checks: {
    /** Saldo anterior + créditos + débitos = saldo final. null = faltam dados. */
    totalsOk: boolean | null;
    /** Soma das colunas confere com a linha Total. null = arquivo sem Total. */
    columnsOk: boolean | null;
    /** Linhas em que o Saldo do banco difere do saldo calculado. */
    balanceMismatches: number;
  };
}

export interface ParsedBankStatement { rows: BankLine[]; info: StatementInfo }

const norm = (s: Cell) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const text = (s: Cell) => String(s ?? "").replace(/\s+/g, " ").trim();

/** "Des: Jonatas Ariel Simoes 04/09" → "Jonatas Ariel Simoes". */
export function counterpart(detail: string): string {
  return detail.replace(/^(rem|des|remet)[:.]\s*/i, "").replace(/\s+\d{2}\/\d{2}$/, "").trim();
}

interface Cols { date: number; hist: number; doc: number; credit: number; debit: number; amount: number; balance: number }

function headerCols(row: Cell[]): Cols | null {
  const h = row.map(norm);
  const find = (re: RegExp) => h.findIndex((c) => re.test(c));
  const c: Cols = {
    date: find(/^(data|dt)\b/), hist: find(/historico|descri|lancamento/), doc: find(/^doc/),
    credit: find(/^credito/), debit: find(/^debito/), amount: find(/^valor/), balance: find(/^saldo/),
  };
  return c.date >= 0 && c.hist >= 0 ? c : null;
}

/**
 * Lê a tabela (CSV já separado em células ou planilha). Devolve null quando não é um extrato
 * com cabeçalho Data + Histórico e colunas de Crédito/Débito ou Valor.
 */
export function parseBankStatement(table: Cell[][], fileName = ""): ParsedBankStatement | null {
  const info: StatementInfo = { dailyBalances: [], checks: { totalsOk: null, columnsOk: null, balanceMismatches: 0 } };
  if (/bradesco/i.test(fileName)) info.bank = "Bradesco";
  const rows: BankLine[] = [];
  let cols: Cols | null = null;
  let section: BankLine["section"] = "periodo";
  let movementTable = false;
  let last: BankLine | null = null;
  let found = false;

  for (const raw of table) {
    const joined = raw.map(text).filter(Boolean).join(" ");
    const n = norm(joined);
    if (!joined) continue;

    const head = joined.match(/Ag[:.]?\s*([\d-]+)\s*\|\s*Conta[:.]?\s*([\dXx-]+)(?:\s*\|\s*Entre\s+(\S+)\s+e\s+(\S+))?/i);
    if (head) {
      info.agency = head[1]; info.account = head[2];
      info.periodStart = parseDate(head[3] ?? "") ?? undefined;
      info.periodEnd = parseDate(head[4] ?? "") ?? undefined;
    }
    const gen = joined.match(/base\s+(\d{2}\/\d{2}\/\d{4}(?:\s+as\s+\S+|\s+às\s+\S+)?)/i);
    if (gen) info.generatedAt = gen[1];
    if (/^ultimos lancamentos/.test(n)) { section = "recentes"; last = null; continue; }

    const hc = headerCols(raw);
    if (hc) {
      cols = hc;
      // Extrato de banco: coluna Histórico ou colunas separadas de Crédito e Débito.
      movementTable = (/historico/.test(norm(raw[hc.hist])) && hc.amount >= 0) || hc.credit >= 0 || hc.debit >= 0;
      if (movementTable) found = true;
      last = null;
      continue;
    }
    if (!cols) continue;

    const date = parseDate(raw[cols.date] ?? "");
    const hist = text(raw[cols.hist]);
    if (!movementTable) {
      // Bloco de saldos diários (Data; Histórico; Saldo).
      const bal = cols.balance >= 0 ? parseAmount(raw[cols.balance] ?? "") : null;
      if (date && bal != null) info.dailyBalances.push({ date, balanceCents: bal });
      continue;
    }
    const credit = cols.credit >= 0 ? parseAmount(raw[cols.credit] ?? "") : null;
    const debit = cols.debit >= 0 ? parseAmount(raw[cols.debit] ?? "") : null;
    const amount = cols.amount >= 0 ? parseAmount(raw[cols.amount] ?? "") : null;
    const balance = cols.balance >= 0 ? parseAmount(raw[cols.balance] ?? "") : null;
    const nh = norm(hist);

    if (/^saldo anterior/.test(nh)) {
      if (section === "periodo") { info.openingDate = date ?? undefined; if (balance != null) info.openingCents = balance; }
      last = null;
      continue;
    }
    if (/^total\b/.test(nh) && !date) {
      if (section === "periodo") {
        info.totalCreditCents = credit != null ? Math.abs(credit) : undefined;
        info.totalDebitCents = debit != null ? -Math.abs(debit) : undefined;
        if (balance != null) info.closingCents = balance;
      }
      last = null;
      continue;
    }
    if (!date) {
      // Complemento do lançamento de cima (Rem:, Des:, nome da empresa).
      if (last && hist && credit == null && debit == null && amount == null) last.detail = last.detail ? `${last.detail} ${hist}` : hist;
      continue;
    }
    if (/^saldo\b/.test(nh)) continue;
    let cents: number | null = null;
    if (credit) cents = Math.abs(credit);
    else if (debit) cents = -Math.abs(debit);
    else if (amount) cents = amount;
    if (!cents) { last = null; continue; }
    last = {
      date, history: hist || "Sem descrição", description: hist || "Sem descrição", amountCents: cents, section,
      doc: cols.doc >= 0 ? text(raw[cols.doc]) || undefined : undefined,
      creditCents: cents > 0 ? cents : undefined, debitCents: cents < 0 ? cents : undefined,
      balanceCents: balance ?? undefined,
    };
    rows.push(last);
  }
  if (!found || !rows.length) return null;
  // Últimos Lançamentos podem repetir linhas do período: fica só uma.
  const key = (r: BankLine) => `${r.date}|${r.doc ?? ""}|${r.amountCents}`;
  const inPeriod = new Set(rows.filter((r) => r.section === "periodo").map(key));
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].section === "recentes" && inPeriod.has(key(rows[i]))) rows.splice(i, 1);

  for (const r of rows) if (r.detail) r.description = `${r.history} · ${counterpart(r.detail)}`;

  // Conferências do próprio arquivo.
  const period = rows.filter((r) => r.section === "periodo");
  const credits = period.reduce((s, r) => s + (r.creditCents ?? 0), 0);
  const debits = period.reduce((s, r) => s + (r.debitCents ?? 0), 0);
  if (info.openingCents != null) {
    let run = info.openingCents;
    for (const r of period) {
      run += r.amountCents;
      r.runningCents = run;
      if (r.balanceCents != null && r.balanceCents !== run) info.checks.balanceMismatches++;
    }
    if (info.closingCents != null) info.checks.totalsOk = info.openingCents + credits + debits === info.closingCents;
  }
  if (info.totalCreditCents != null || info.totalDebitCents != null) {
    info.checks.columnsOk = (info.totalCreditCents ?? 0) === credits && (info.totalDebitCents ?? 0) === debits;
  }
  if (!info.periodStart && period.length) { info.periodStart = period[0].date; info.periodEnd = period[period.length - 1].date; }
  return { rows, info };
}
