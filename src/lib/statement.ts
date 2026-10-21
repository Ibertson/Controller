// Leitura de extratos bancários: OFX, CSV e planilhas (linhas já lidas).
import type { Cell } from "./xlsx";

export interface StatementRow { date: string; description: string; /** Positivo = entrou, negativo = saiu. */ amountCents: number; id?: string; }

const pad = (n: number) => String(n).padStart(2, "0");

/** "31/12/2026", "2026-12-31", "20261231", número serial do Excel. */
export function parseDate(v: Cell): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    if (v < 20000 || v > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = v.trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return valid(y, Number(m[2]), Number(m[1]));
  }
  m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (m) return valid(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}
function valid(y: number, mo: number, d: number) {
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y > 1990 && y < 2100 ? `${y}-${pad(mo)}-${pad(d)}` : null;
}

/** "-1.234,56", "1234.56", "R$ 10,00", "(10,00)", "10,00 D" → centavos com sinal. */
export function parseAmount(v: Cell): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Math.round(v * 100);
  let s = v.trim().replace(/\s|R\$/g, "");
  let sign = 1;
  if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1); }
  if (/[dD]$/.test(s)) { sign = -1; s = s.slice(0, -1); } else if (/[cC]$/.test(s)) s = s.slice(0, -1);
  if (s.startsWith("-")) { sign *= -1; s = s.slice(1); } else if (s.startsWith("+")) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  const decSep = lastComma > lastDot ? "," : lastDot > lastComma && s.length - lastDot <= 3 ? "." : null;
  const [int, frac = ""] = decSep ? [s.slice(0, s.lastIndexOf(decSep)), s.slice(s.lastIndexOf(decSep) + 1)] : [s, ""];
  const cents = Number(int.replace(/[.,]/g, "") || "0") * 100 + Number((frac + "00").slice(0, 2));
  return Number.isFinite(cents) ? sign * cents : null;
}

/** OFX (SGML ou XML): cada <STMTTRN> vira uma linha. */
export function parseOfx(text: string): StatementRow[] {
  const out: StatementRow[] = [];
  const tag = (block: string, name: string) => block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i"))?.[1]?.trim() ?? "";
  for (const m of text.matchAll(/<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi)) {
    const b = m[1];
    const date = parseDate(tag(b, "DTPOSTED").slice(0, 8));
    const amount = parseAmount(tag(b, "TRNAMT").replace(",", "."));
    if (!date || amount == null) continue;
    const description = [tag(b, "MEMO"), tag(b, "NAME")].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(" · ") || "Sem descrição";
    out.push({ date, description, amountCents: amount, id: tag(b, "FITID") || undefined });
  }
  return out;
}

/** CSV com vírgula, ponto e vírgula ou tab; aceita aspas. */
export function parseCsv(text: string): string[][] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const sample = lines.slice(0, 10).join("\n");
  const delim = [";", "\t", ","].map((d) => [d, sample.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = "", quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === delim) { cells.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  });
}

const norm = (s: Cell) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Acha as colunas de data, descrição e valor (ou crédito/débito) e devolve as linhas do extrato. */
export function rowsFromTable(table: Cell[][]): StatementRow[] {
  let header = -1;
  let cols = { date: -1, desc: -1, amount: -1, credit: -1, debit: -1 };
  for (let r = 0; r < Math.min(table.length, 20) && header < 0; r++) {
    const h = table[r].map(norm);
    const find = (re: RegExp) => h.findIndex((c) => re.test(c));
    const c = {
      date: find(/^(data|date|dt)\b/), desc: find(/descri|historico|lancamento|memo|estabelecimento|title|titulo|detalhe/),
      amount: find(/^(valor|amount|quantia|montante)/), credit: find(/credito|entrada/), debit: find(/debito|saida/),
    };
    if (c.date >= 0 && (c.amount >= 0 || c.credit >= 0 || c.debit >= 0)) { header = r; cols = c; }
  }
  if (header < 0) {
    // Sem cabeçalho: 1ª coluna com data, 1ª com valor, a de texto mais longa.
    const probe = table.slice(0, 20);
    const width = Math.max(0, ...probe.map((r) => r.length));
    const score = (i: number, ok: (v: Cell) => boolean) => probe.filter((r) => ok(r[i])).length;
    const idx = [...Array(width).keys()];
    cols.date = idx.find((i) => score(i, (v) => !!parseDate(v)) >= probe.length / 2) ?? -1;
    cols.amount = idx.find((i) => i !== cols.date && score(i, (v) => parseAmount(v) != null) >= probe.length / 2) ?? -1;
    cols.desc = idx.filter((i) => i !== cols.date && i !== cols.amount)
      .sort((a, b) => probe.reduce((s, r) => s + String(r[b] ?? "").length, 0) - probe.reduce((s, r) => s + String(r[a] ?? "").length, 0))[0] ?? -1;
    if (cols.date < 0 || cols.amount < 0) throw new Error("Não encontramos as colunas de data e valor neste arquivo.");
  }
  const out: StatementRow[] = [];
  for (const row of table.slice(header + 1)) {
    const date = parseDate(row[cols.date]);
    if (!date) continue;
    let amount = cols.amount >= 0 ? parseAmount(row[cols.amount]) : null;
    if (amount == null) {
      const cr = cols.credit >= 0 ? parseAmount(row[cols.credit]) : null;
      const db = cols.debit >= 0 ? parseAmount(row[cols.debit]) : null;
      if (cr) amount = Math.abs(cr); else if (db) amount = -Math.abs(db);
    }
    if (!amount) continue;
    const description = cols.desc >= 0 ? String(row[cols.desc] ?? "").trim() : "";
    if (/^saldo\b/i.test(description)) continue; // linhas de saldo não são lançamentos
    out.push({ date, description: description || "Sem descrição", amountCents: amount });
  }
  return out;
}
