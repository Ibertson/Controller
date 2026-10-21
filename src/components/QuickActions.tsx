"use client";

import { useRef, useState, type DragEvent } from "react";
import {
  ArrowDownCircle, ArrowUpCircle, CalendarCheck, Download, FileSpreadsheet, FileText, RotateCcw, Search, Trash2, TrendingDown, TriangleAlert, Upload, User,
} from "lucide-react";
import { repo } from "@/lib/data";
import { bulkPayments, bulkTransactions, defaultBulkRange, type BulkPayFilter, type BulkRegFilter, type BulkTxFilter } from "@/lib/bulk";
import { today } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import {
  dataSheet, exportFileName, filterForExport, periodLabels, periodTitle, reportHtml, reportSheets, type KindFilter, type Period,
} from "@/lib/report";
import { parseCsv, parseOfx, rowsFromTable, type StatementRow } from "@/lib/statement";
import { transactionsCsv } from "@/lib/csv";
import type { Snapshot, Transaction } from "@/lib/types";
import { readXlsx, writeXlsx } from "@/lib/xlsx";
import { Dialog } from "./Dialog";
import { initials } from "./PersonModals";
import { Button, Field, inputClass } from "./ui";

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Abre o relatório na janela de impressão, onde dá para escolher "Salvar como PDF". */
export function printHtml(html: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  frame.srcdoc = html;
  frame.onload = () => { frame.contentWindow?.print(); setTimeout(() => frame.remove(), 60000); };
  document.body.appendChild(frame);
}

const radio = "size-4 accent-[var(--color-accent)]";
const brDate = (d: string) => d.split("-").reverse().join("/");

/* ---------------------------------- Importar extrato ---------------------------------- */

interface Draft extends StatementRow { key: string; checked: boolean; duplicate: boolean; }

export function ImportStatementModal({ snap, onClose, onDone }: { snap: Snapshot; onClose: () => void; onDone: (msg: string) => void }) {
  const accounts = snap.accounts.filter((a) => !a.archived);
  const [rows, setRows] = useState<Draft[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [inverted, setInverted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Já existe na conta um lançamento no mesmo dia e valor? Então provavelmente é repetido.
  const markDuplicates = (list: StatementRow[], acc: string, inv: boolean): Draft[] => {
    const existing = new Set(snap.transactions.filter((t) => t.accountId === acc && (t.kind === "income" || t.kind === "expense"))
      .map((t) => `${t.occurredOn}|${t.kind === "income" ? t.amountCents : -t.amountCents}`));
    return list.map((r, i) => {
      const amount = inv ? -r.amountCents : r.amountCents;
      const duplicate = existing.has(`${r.date}|${amount}`);
      return { ...r, key: `${i}`, checked: !duplicate, duplicate };
    });
  };

  async function readFile(file: File) {
    setError(""); setFileName(file.name);
    try {
      const lower = file.name.toLowerCase();
      let parsed: StatementRow[];
      if (lower.endsWith(".ofx") || lower.endsWith(".qfx")) parsed = parseOfx(await file.text());
      else if (lower.endsWith(".xlsx")) parsed = rowsFromTable(await readXlsx(await file.arrayBuffer()));
      else if (lower.endsWith(".xls")) throw new Error("Arquivos .xls antigos não são lidos. Abra no Excel e salve como .xlsx ou CSV.");
      else {
        const buf = await file.arrayBuffer();
        let text = new TextDecoder("utf-8").decode(buf);
        if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buf); // bancos antigos usam Latin-1
        parsed = /<OFX>|<STMTTRN>/i.test(text) ? parseOfx(text) : rowsFromTable(parseCsv(text));
      }
      if (!parsed.length) throw new Error("Não encontramos lançamentos neste arquivo.");
      setInverted(false);
      setRows(markDuplicates(parsed, accountId, false));
    } catch (e) {
      setRows(null);
      setError(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) void readFile(f);
  }

  const chosen = rows?.filter((r) => r.checked) ?? [];
  const signed = (r: StatementRow) => (inverted ? -r.amountCents : r.amountCents);

  async function importAll() {
    if (!accountId) return setError("Cadastre uma conta antes de importar.");
    setBusy(true);
    try {
      for (const r of chosen) {
        const amount = signed(r);
        await repo.createTransaction({
          kind: amount > 0 ? "income" : "expense", amountCents: Math.abs(amount), occurredOn: r.date,
          description: r.description.slice(0, 140), accountId, isPaid: true, source: "import",
        });
      }
      onDone(`${chosen.length} lançamentos importados`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "A importação parou no meio. Confira a lista antes de tentar de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog wide onClose={onClose} title={<h2 className="flex items-center gap-2 text-lg font-semibold"><Upload aria-hidden className="size-5 text-accent" />Importar extrato do banco</h2>}>
      {!rows ? (
        <>
          <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
            className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center ${drag ? "border-accent bg-accent-soft" : "border-border"}`}>
            <FileText aria-hidden className="size-9 text-text-muted" />
            <p className="font-semibold">Arraste o arquivo aqui ou escolha no aparelho</p>
            <p className="text-sm text-text-muted">OFX, CSV ou Excel (.xlsx)</p>
            <input ref={input} type="file" accept=".ofx,.qfx,.csv,.txt,.xlsx,.xls" className="sr-only" id="stmt-file"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ""; }} />
            <Button type="button" variant="secondary" className="mt-2" onClick={() => input.current?.click()}><Upload aria-hidden className="size-4" />Escolher arquivo</Button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
          <div className="mt-5 text-center text-sm text-text-muted">
            <p className="font-semibold text-text">Onde consigo o extrato?</p>
            <p className="mt-1">No app ou site do seu banco, na área de extrato, procure a opção de exportar ou baixar. Prefira OFX; CSV e Excel também servem.</p>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Lançar na conta" htmlFor="stmt-account">
              <select id="stmt-account" className={`${inputClass} min-w-48`} value={accountId}
                onChange={(e) => { setAccountId(e.target.value); setRows(markDuplicates(rows, e.target.value, inverted)); }}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <label className="flex h-11 items-center gap-2 text-sm">
              <input type="checkbox" className={radio} checked={inverted} onChange={(e) => { setInverted(e.target.checked); setRows(markDuplicates(rows, accountId, e.target.checked)); }} />
              Inverter entradas e saídas
            </label>
          </div>
          <p className="text-xs text-text-muted">
            {fileName}: {rows.length} lançamentos encontrados{rows.some((r) => r.duplicate) && ", os marcados como “já existe” vieram desmarcados"}.
            Se as compras aparecerem como entrada, marque “Inverter”.
          </p>
          <div className="max-h-80 overflow-y-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-left text-xs text-text-muted">
                <tr>
                  <th className="p-2"><input type="checkbox" aria-label="Marcar todos" className={radio} checked={chosen.length === rows.length}
                    onChange={(e) => setRows(rows.map((r) => ({ ...r, checked: e.target.checked })))} /></th>
                  <th className="p-2">Data</th><th className="p-2">Descrição</th><th className="p-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-t border-border">
                    <td className="p-2"><input type="checkbox" aria-label={`Importar ${r.description}`} className={radio} checked={r.checked}
                      onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, checked: e.target.checked } : x)))} /></td>
                    <td className="num whitespace-nowrap p-2">{brDate(r.date)}</td>
                    <td className="p-2">{r.description}{r.duplicate && <span className="ml-1.5 rounded-pill bg-warning-soft px-1.5 text-[11px] font-medium text-warning">já existe</span>}</td>
                    <td className={`num whitespace-nowrap p-2 text-right font-semibold ${signed(r) > 0 ? "text-income" : "text-expense"}`}>
                      {signed(r) > 0 ? "+" : "−"} {formatBRL(Math.abs(signed(r)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="secondary" onClick={() => { setRows(null); setError(""); }}>Escolher outro arquivo</Button>
            <Button type="button" loading={busy} disabled={!chosen.length} onClick={importAll}>Importar {chosen.length} lançamentos</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/* ---------------------------------- Exportar ---------------------------------- */

type Format = "pdf" | "csv" | "xlsx-report" | "xlsx-data";

export function ExportModal({ snap, month, selfName, onClose, onDone }:
  { snap: Snapshot; month: string; selfName: string; onClose: () => void; onDone: (msg: string) => void }) {
  const [format, setFormat] = useState<Format>("pdf");
  const [period, setPeriod] = useState<Period>("month");
  const [kind, setKind] = useState<KindFilter>("all");
  const [people, setPeople] = useState<string[]>([]);
  const everyone = [{ id: "", name: selfName }, ...snap.people.filter((p) => !p.archived)];
  const items = filterForExport(snap, { period, month, kind, people });
  const title = periodTitle(period, month);

  function run() {
    const base = exportFileName(period, month);
    if (format === "csv") download(new Blob(["﻿" + transactionsCsv(snap, items)], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
    else if (format === "xlsx-data") download(writeXlsx(dataSheet(snap, items, selfName)), `${base}.xlsx`);
    else if (format === "xlsx-report") download(writeXlsx(reportSheets(snap, items, selfName, title)), `${base}-relatorio.xlsx`);
    else printHtml(reportHtml(snap, items, selfName, title));
    onDone(format === "pdf" ? "Escolha “Salvar como PDF” na janela de impressão" : "Arquivo exportado");
    onClose();
  }

  const formats: { value: Format; label: string; icon: typeof FileText }[] = [
    { value: "pdf", label: "PDF", icon: FileText }, { value: "xlsx-report", label: "Excel (relatório)", icon: FileSpreadsheet },
    { value: "csv", label: "CSV (dados)", icon: FileText }, { value: "xlsx-data", label: "Excel (dados)", icon: FileSpreadsheet },
  ];

  return (
    <Dialog onClose={onClose} title={<h2 className="flex items-center gap-2 text-lg font-semibold"><Download aria-hidden className="size-5 text-accent" />Exportar lançamentos</h2>}>
      <div className="flex flex-col gap-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Formato do arquivo</legend>
          <div className="grid grid-cols-2 gap-2">
            {formats.map((f) => (
              <label key={f.value} className="flex items-center gap-2 text-sm">
                <input type="radio" name="fmt" className={radio} checked={format === f.value} onChange={() => setFormat(f.value)} />
                <f.icon aria-hidden className="size-4 text-text-muted" />{f.label}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Período" htmlFor="exp-period">
          <select id="exp-period" className={inputClass} value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            {(Object.keys(periodLabels) as Period[]).map((p) => <option key={p} value={p}>{periodLabels[p]}</option>)}
          </select>
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Tipo de lançamento</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="kind" className={radio} checked={kind === "all"} onChange={() => setKind("all")} />Todos</label>
            <label className="flex items-center gap-2"><input type="radio" name="kind" className={radio} checked={kind === "income"} onChange={() => setKind("income")} /><ArrowUpCircle aria-hidden className="size-4 text-income" />Receitas</label>
            <label className="flex items-center gap-2"><input type="radio" name="kind" className={radio} checked={kind === "expense"} onChange={() => setKind("expense")} /><ArrowDownCircle aria-hidden className="size-4 text-expense" />Despesas</label>
          </div>
        </fieldset>
        <fieldset>
          <div className="mb-2 flex items-center justify-between">
            <legend className="flex items-center gap-1.5 text-sm font-semibold"><User aria-hidden className="size-4" />Filtrar por pessoa</legend>
            <button type="button" className="text-sm font-semibold text-accent" onClick={() => setPeople(people.length === everyone.length ? [] : everyone.map((p) => p.id))}>
              {people.length === everyone.length ? "Limpar" : "Selecionar todas"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {everyone.map((p) => (
              <label key={p.id || "me"} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                <input type="checkbox" className={radio} checked={people.includes(p.id)}
                  onChange={(e) => setPeople(e.target.checked ? [...people, p.id] : people.filter((x) => x !== p.id))} />
                <span className="grid size-6 place-items-center rounded-pill bg-surface text-[11px] font-semibold">{initials(p.name)}</span>{p.name}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-text-muted">Sem ninguém marcado, saem os lançamentos de todos.</p>
        </fieldset>
        <p className="text-sm text-text-muted">{items.length} lançamentos em {title}.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={!items.length} onClick={run}><Download aria-hidden className="size-4" />Exportar</Button>
        </div>
      </div>
    </Dialog>
  );
}

/* ---------------------------------- Lixeira ---------------------------------- */

function SimpleRows({ snap, items, selected, setSelected }:
  { snap: Snapshot; items: Transaction[]; selected: Set<string>; setSelected: (s: Set<string>) => void }) {
  const where = (t: Transaction) => snap.cards.find((c) => c.id === t.cardId)?.name ?? snap.accounts.find((a) => a.id === t.accountId)?.name ?? "";
  const toggle = (id: string, on: boolean) => { const s = new Set(selected); if (on) s.add(id); else s.delete(id); setSelected(s); };
  return (
    <ul className="max-h-80 overflow-y-auto rounded-md border border-border">
      {items.map((t) => {
        const out = t.kind === "expense" || t.kind === "card_payment";
        return (
          <li key={t.id} className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0">
            <input type="checkbox" className={radio} aria-label={`Selecionar ${t.description}`} checked={selected.has(t.id)} onChange={(e) => toggle(t.id, e.target.checked)} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{t.description || "Sem descrição"}</div>
              <div className="truncate text-xs text-text-muted">{brDate(t.occurredOn)}{where(t) && ` · ${where(t)}`}</div>
            </div>
            <span className={`num shrink-0 text-sm font-semibold ${t.kind === "income" ? "text-income" : out ? "text-expense" : ""}`}>
              {t.kind === "income" ? "+" : out ? "−" : ""} {formatBRL(t.amountCents)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function TrashModal({ snap, onClose, onDone }: { snap: Snapshot; onClose: () => void; onDone: (msg: string) => void }) {
  const items = [...(snap.trash ?? [])].sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const ids = [...selected].filter((id) => items.some((t) => t.id === id));

  async function act(kind: "restore" | "purge" | "empty") {
    const target = kind === "empty" ? items.map((t) => t.id) : ids;
    if (kind !== "restore" && !confirm(kind === "empty"
      ? `Esvaziar a lixeira? ${target.length} lançamentos serão apagados para sempre.`
      : `Apagar ${target.length} lançamentos para sempre? Isso não pode ser desfeito.`)) return;
    setBusy(true);
    try {
      if (kind === "restore") await repo.restoreTransactions(target); else await repo.purgeTransactions(target);
      setSelected(new Set());
      onDone(kind === "restore" ? `${target.length} lançamentos restaurados` : "Apagados para sempre");
    } finally { setBusy(false); }
  }

  return (
    <Dialog onClose={onClose} title={
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Trash2 aria-hidden className="size-5" />Lixeira de Transações</h2>
        <p className="mt-1 text-sm text-text-muted">Transações excluídas nos últimos 30 dias. Depois disso, elas são apagadas automaticamente.</p>
      </div>
    }>
      {items.length ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">{items.length} lançamentos excluídos. Eles não entram nos totais.</span>
            <button type="button" className="font-semibold text-accent" onClick={() => setSelected(ids.length === items.length ? new Set() : new Set(items.map((t) => t.id)))}>
              {ids.length === items.length ? "Limpar" : "Marcar todos"}
            </button>
          </div>
          <SimpleRows snap={snap} items={items} selected={selected} setSelected={setSelected} />
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => act("empty")}>Esvaziar lixeira</Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" disabled={!ids.length || busy} onClick={() => act("purge")}>Apagar para sempre</Button>
              <Button type="button" disabled={!ids.length} loading={busy} onClick={() => act("restore")}><RotateCcw aria-hidden className="size-4" />Restaurar {ids.length || ""}</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-12 text-center text-text-muted">
          <Trash2 aria-hidden className="size-12 opacity-60" />
          <p>A lixeira está vazia</p>
        </div>
      )}
    </Dialog>
  );
}

/* ---------------------------------- Excluir em massa ---------------------------------- */

type BulkTab = "transacoes" | "pagamentos" | "cadastros";

const tabBtn = "flex h-10 items-center justify-center gap-1.5 rounded-md text-sm font-semibold text-text-muted aria-selected:bg-surface-raised aria-selected:text-text aria-selected:shadow-card";

export function BulkDeleteModal({ snap, onClose, onDone }:
  { snap: Snapshot; onClose: () => void; onDone: (msg: string, undo?: () => void) => void }) {
  const [tab, setTab] = useState<BulkTab>("transacoes");
  const [range, setRange] = useState(() => defaultBulkRange(today()));
  const [search, setSearch] = useState("");
  const [txFilter, setTxFilter] = useState<BulkTxFilter>("all");
  const [payFilter, setPayFilter] = useState<BulkPayFilter>("all");
  const [regFilter, setRegFilter] = useState<BulkRegFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  const base = { ...range, search };
  const items = tab === "transacoes" ? bulkTransactions(snap, { ...base, filter: txFilter })
    : tab === "pagamentos" ? bulkPayments(snap, { ...base, filter: payFilter }) : [];
  const ids = [...selected].filter((id) => items.some((t) => t.id === id));

  function switchTab(next: BulkTab) { setTab(next); setSelected(new Set()); }

  async function run() {
    if (!confirm(`Excluir ${ids.length} ${ids.length === 1 ? "registro" : "registros"}? Eles vão para a lixeira.`)) return;
    setBusy(true);
    try {
      await repo.trashTransactions(ids);
      onDone(`${ids.length} ${ids.length === 1 ? "registro movido" : "registros movidos"} para a lixeira`, () => void repo.restoreTransactions(ids));
      onClose();
    } finally { setBusy(false); }
  }

  const empty = tab === "transacoes"
    ? { icon: Trash2, text: "Nenhuma transação encontrada no período" }
    : tab === "pagamentos" ? { icon: CalendarCheck, text: "Nenhum pagamento fixo encontrado no período" }
    : { icon: FileText, text: "Nenhum cadastro ativo encontrado" };

  return (
    <>
      <Dialog wide onClose={onClose} title={<h2 className="flex items-center gap-2 text-lg font-semibold"><Trash2 aria-hidden className="size-5 text-danger" />Excluir Registros em Massa</h2>}>
        <div className="flex flex-col gap-4">
          <div role="tablist" aria-label="O que excluir" className="grid grid-cols-3 gap-1 rounded-md bg-surface p-1">
            {([["transacoes", "Transações", TrendingDown], ["pagamentos", "Pagamentos", CalendarCheck], ["cadastros", "Cadastros", FileText]] as const).map(([v, l, Icon]) => (
              <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => switchTab(v)} className={tabBtn}>
                <Icon aria-hidden className="size-4" />{l}
              </button>
            ))}
          </div>

          {tab !== "cadastros" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data Inicial" htmlFor="bulk-from">
                <input id="bulk-from" type="date" className={inputClass} value={range.from} max={range.to || undefined}
                  onChange={(e) => setRange({ ...range, from: e.target.value })} />
              </Field>
              <Field label="Data Final" htmlFor="bulk-to">
                <input id="bulk-to" type="date" className={inputClass} value={range.to} min={range.from || undefined}
                  onChange={(e) => setRange({ ...range, to: e.target.value })} />
              </Field>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
              <input type="search" aria-label="Buscar por descrição" placeholder="Buscar por descrição..." className={`${inputClass} pl-9`}
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {tab === "transacoes" && (
              <select aria-label="Tipo" className={`${inputClass} sm:w-48`} value={txFilter} onChange={(e) => setTxFilter(e.target.value as BulkTxFilter)}>
                <option value="all">Todas</option><option value="income">Receitas</option>
                <option value="expense">Despesas</option><option value="card">Cartão de Crédito</option>
              </select>
            )}
            {tab === "pagamentos" && (
              <select aria-label="Tipo" className={`${inputClass} sm:w-48`} value={payFilter} onChange={(e) => setPayFilter(e.target.value as BulkPayFilter)}>
                <option value="all">Todos</option><option value="fixed_expense">Gastos Fixos</option>
                <option value="fixed_income">Receitas Fixas</option><option value="card_payment">Pagto. Faturas</option>
              </select>
            )}
            {tab === "cadastros" && (
              <select aria-label="Tipo" className={`${inputClass} sm:w-48`} value={regFilter} onChange={(e) => setRegFilter(e.target.value as BulkRegFilter)}>
                <option value="all">Todos</option><option value="fixed_expense">Gastos Fixos</option>
                <option value="fixed_income">Receitas Fixas</option><option value="debt">Dívidas</option>
              </select>
            )}
          </div>

          <div className="flex items-center gap-4 border-b border-border pb-3 text-sm">
            <button type="button" className="font-semibold disabled:opacity-50" disabled={!items.length} onClick={() => setSelected(new Set(items.map((t) => t.id)))}>
              Selecionar todas ({items.length})
            </button>
            <button type="button" className="font-semibold text-text-muted disabled:opacity-50" disabled={!ids.length} onClick={() => setSelected(new Set())}>Limpar seleção</button>
            <span className="ml-auto rounded-pill bg-surface px-2.5 py-1 text-xs font-semibold">{ids.length} {ids.length === 1 ? "selecionada" : "selecionadas"}</span>
          </div>

          {items.length ? <SimpleRows snap={snap} items={items} selected={selected} setSelected={setSelected} /> : (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-text-muted">
              <empty.icon aria-hidden className="size-12 opacity-60" />
              <p>{empty.text}</p>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="secondary" className="!text-danger" onClick={() => setResetting(true)}><RotateCcw aria-hidden className="size-4" />Resetar tudo</Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="button" variant="danger" disabled={!ids.length} loading={busy} onClick={run}>
              <Trash2 aria-hidden className="size-4" />Excluir {ids.length} {ids.length === 1 ? "registro" : "registros"}
            </Button>
          </div>
        </div>
      </Dialog>
      {resetting && <ResetDialog onClose={() => setResetting(false)} onDone={(msg) => { onDone(msg); onClose(); }} />}
    </>
  );
}

/* ---------------------------------- Resetar tudo ---------------------------------- */

export function ResetDialog({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ok = word.trim() === "RESETAR";

  async function run() {
    setBusy(true);
    setError("");
    try {
      await repo.resetAll();
      try { localStorage.removeItem("sobra:titular-oculto"); } catch { /* sem armazenamento local */ }
      onDone("Painel pessoal resetado");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível resetar.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog onClose={onClose} title={<h2 className="flex items-center gap-2 text-lg font-semibold text-danger"><TriangleAlert aria-hidden className="size-5" />Resetar todo o painel pessoal?</h2>}>
      <div className="flex flex-col gap-4 text-sm">
        <div>
          <p>Esta ação <b>apaga permanentemente</b>:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Todas as transações (incluindo a lixeira)</li>
            <li>Todos os cartões e suas faturas</li>
            <li>Todas as contas bancárias</li>
            <li>Todos os gastos fixos, receitas fixas e seus pagamentos</li>
            <li>Todas as dívidas, metas e categorias que você criou</li>
            <li>Pessoas cadastradas</li>
          </ul>
        </div>
        <p>Seu login e seu perfil <b>não</b> serão afetados. O painel recomeça com uma conta principal e as categorias padrão.</p>
        <Field label="Para confirmar, digite RESETAR abaixo:" htmlFor="reset-word">
          <input id="reset-word" autoFocus autoComplete="off" className={inputClass} value={word} onChange={(e) => setWord(e.target.value)} placeholder="RESETAR" />
        </Field>
        {error && <p role="alert" className="text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="button" variant="danger" disabled={!ok} loading={busy} onClick={run}><RotateCcw aria-hidden className="size-4" />Sim, apagar tudo</Button>
        </div>
      </div>
    </Dialog>
  );
}
