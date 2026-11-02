"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, FileText, FileUp, Plus, Scale, Trash2 } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { Button, Card, EmptyState, Field, Input, Segmented, Skeleton, inputClass } from "@/components/ui";
import { accountHref, accountTitle } from "@/lib/accounts";
import { categoryFits, subcategoriesOf } from "@/lib/categories";
import { repo, useSnapshot } from "@/lib/data";
import { addMonths, monthLabel, monthOf, today } from "@/lib/dates";
import { formatBRL, parseBRL } from "@/lib/money";
import { accountMovements, balanceAt, cardMovements, checkInvoice, checkStatement, matchRows, type Movement } from "@/lib/reconcile";
import type { BankLine, StatementInfo } from "@/lib/bankStatement";
import type { Category } from "@/lib/types";
import type { StatementRow } from "@/lib/statement";
import { readStatementDetail, type StatementFile } from "@/lib/statementFile";

type Mode = "extrato" | "fatura";
/** Linha do banco; catId/subId = categoria e subcategoria escolhidas para o Lançar. */
type Line = StatementRow & Partial<BankLine> & { catId?: string; subId?: string };
interface Imported extends StatementFile { rows: Line[]; fileName?: string }
const savedKey = (id: string, mode: Mode, month: string) => `sobra:conciliacao:${id}:${mode}:${month}`;
interface Saved { initial?: string; final?: string; invoice?: string }

const plain = (c: number) => (c < 0 ? "-" : "") + formatBRL(Math.abs(c)).replace(/^R\$\s?/, "");
function money(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const neg = t.startsWith("-");
  const c = parseBRL(t.replace(/^-/, ""));
  return c == null ? null : neg ? -c : c;
}
const shortDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** Valores digitados ficam guardados neste aparelho por conta, cartão e mês. */
function useSaved(key: string): [Saved, (p: Saved) => void] {
  const [state, setState] = useState<{ key: string; v: Saved }>({ key: "", v: {} });
  useEffect(() => {
    let v: Saved = {};
    try { v = JSON.parse(localStorage.getItem(key) ?? "{}") as Saved; } catch { /* sem armazenamento */ }
    setState({ key, v }); // eslint-disable-line react-hooks/set-state-in-effect -- lê o que o aparelho guardou ao trocar de mês
  }, [key]);
  const set = (p: Saved) => {
    const v = { ...(state.key === key ? state.v : {}), ...p };
    setState({ key, v });
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* idem */ }
  };
  return [state.key === key ? state.v : {}, set];
}

export default function ConciliacaoPage() {
  return <Suspense fallback={<Skeleton className="h-64" />}><Conciliacao /></Suspense>;
}

function Conciliacao() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const snap = useSnapshot();
  const [mode, setMode] = useState<Mode>(params.get("modo") === "fatura" ? "fatura" : "extrato");
  const [month, setMonth] = useState(() => monthOf(today()));
  const [cardId, setCardId] = useState("");
  const [files, setFiles] = useState<Record<Mode, Imported>>({ extrato: { rows: [] }, fatura: { rows: [] } });
  const [ver, setVer] = useState(0);

  if (!snap) return <Skeleton className="h-64" />;
  const account = snap.accounts.find((a) => a.id === id && !a.archived);
  if (!account) {
    return <EmptyState icon={Scale} title="Conta não encontrada." action={<Link href="/contas" className="font-semibold text-accent underline">Voltar para Contas</Link>} />;
  }
  const cards = snap.cards.filter((c) => c.paymentAccountId === account.id && !c.archived);
  const card = cards.find((c) => c.id === cardId) ?? cards[0];
  const setFile = (m: Mode) => (f: Imported) => setFiles((all) => ({ ...all, [m]: f }));

  /** Extrato com saldo anterior e final: preenche a conferência e vai para o mês do arquivo. */
  function applyBalances(info: StatementInfo) {
    const m = statementMonth(info);
    if (!m || !account || info.openingCents == null || info.closingCents == null) return;
    const key = savedKey(account.id, "extrato", m);
    try {
      const old = JSON.parse(localStorage.getItem(key) ?? "{}") as Saved;
      localStorage.setItem(key, JSON.stringify({ ...old, initial: plain(info.openingCents), final: plain(info.closingCents) }));
    } catch { /* sem armazenamento: os campos ficam como estão */ }
    setMonth(m);
    setVer((v) => v + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href={accountHref(account.id)} aria-label="Voltar para a conta" className="rounded-sm p-1 hover:bg-surface"><ArrowLeft className="size-5" /></Link>
        <div>
          <h1 className="text-lg font-semibold">Conciliação bancária</h1>
          <p className="text-sm text-text-muted">{accountTitle(account)}{account.label ? ` · ${account.label}` : ""}</p>
        </div>
      </div>

      <Segmented label="O que conferir" value={mode} onChange={setMode}
        options={[{ value: "extrato", label: "Extrato da conta" }, { value: "fatura", label: "Cartão de crédito" }]} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface-raised p-1">
          <button type="button" aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))} className="rounded-sm p-1.5 hover:bg-surface"><ChevronLeft className="size-4" /></button>
          <span className="min-w-36 text-center text-sm font-semibold">{mode === "fatura" ? "Fatura de " : ""}<span className={mode === "fatura" ? "" : "capitalize"}>{monthLabel(month)}</span></span>
          <button type="button" aria-label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))} className="rounded-sm p-1.5 hover:bg-surface"><ChevronRight className="size-4" /></button>
        </div>
        {mode === "fatura" && cards.length > 1 && (
          <select aria-label="Cartão" className={`${inputClass} !h-10 !w-auto`} value={card?.id} onChange={(e) => setCardId(e.target.value)}>
            {cards.map((c) => <option key={c.id} value={c.id}>{c.name}{c.last4 ? ` •••• ${c.last4}` : ""}</option>)}
          </select>
        )}
      </div>

      {mode === "extrato"
        ? <StatementCheck key={`${account.id}-${month}-${ver}`} accountId={account.id} month={month}
            file={files.extrato} setFile={setFile("extrato")} onBalances={applyBalances} />
        : card
          ? <InvoiceCheck key={`${card.id}-${month}`} cardId={card.id} month={month} file={files.fatura} setFile={setFile("fatura")} />
          : <Card><EmptyState icon={Scale} title="Nenhum cartão de crédito ligado a esta conta. Ligue um em Editar, na página da conta."
              action={<Link href={accountHref(account.id)} className="font-semibold text-accent underline">Ir para a conta</Link>} /></Card>}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return <div className={`flex items-center justify-between gap-3 py-1.5 text-sm ${strong ? "font-semibold" : ""}`}><span>{label}</span><span className="num">{value}</span></div>;
}

function Status({ ready, ok, diff, what }: { ready: boolean; ok: boolean; diff: number; what: string }) {
  if (!ready) return <div className="mt-2 rounded-md bg-surface p-2 text-center text-sm text-text-muted">Informe {what} para conferir</div>;
  return ok
    ? <div role="status" className="mt-2 flex items-center justify-center gap-2 rounded-md bg-accent-soft p-2 text-sm font-bold text-income"><Check aria-hidden className="size-4" />OK, tudo bate</div>
    : <div role="status" className="mt-2 rounded-md bg-danger/10 p-2 text-center text-sm font-bold text-danger">Diferença de {formatBRL(Math.abs(diff))}{diff > 0 ? " a mais no banco" : " a mais no app"}</div>;
}

function MoneyField({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const bad = value.trim() !== "" && money(value) == null;
  return (
    <Field label={label} htmlFor={id} error={bad ? "Valor inválido. Use algo como 1.250,00." : undefined}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">R$</span>
        <Input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "0,00"} className="num pl-10" aria-invalid={bad || undefined} />
      </div>
    </Field>
  );
}

/** Conferência do extrato da conta corrente. */
interface FileProps { file: Imported; setFile: (f: Imported) => void }

function StatementCheck({ accountId, month, file, setFile, onBalances }: { accountId: string; month: string; onBalances: (i: StatementInfo) => void } & FileProps) {
  const snap = useSnapshot()!;
  const [saved, save] = useSaved(savedKey(accountId, "extrato", month));
  const items = accountMovements(snap, accountId, month);
  const initialDefault = balanceAt(snap, accountId, month);
  const initial = saved.initial ?? plain(initialDefault);
  const final = saved.final ?? "";
  const r = checkStatement(money(initial) ?? 0, money(final) ?? 0, items);
  const ready = money(final) != null && money(initial) != null;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
        <MovementsTable title="Lançamentos do app no mês" items={items} empty="Nenhum lançamento pago nesta conta no mês." />
        {file.info && <FileSummary info={file.info} fileName={file.fileName} month={month} onUse={() => onBalances(file.info!)} />}
      </div>
      <Card className="order-1 h-fit lg:order-2">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">Conferência · Extrato da conta</h2>
        <div className="flex flex-col gap-3">
          <MoneyField id="rec-initial" label="Saldo inicial (no extrato do banco)" value={initial} onChange={(v) => save({ initial: v })} />
          <MoneyField id="rec-final" label="Saldo final (no extrato do banco)" value={final} onChange={(v) => save({ final: v })} />
        </div>
        <div className="mt-3 border-t border-border pt-2">
          <Row label="Total de lançamentos" value={formatBRL(r.totalCents)} />
          <Row label="Saldo final lançado" value={formatBRL(r.launchedFinalCents)} />
          <Row label="Diferença" value={ready ? formatBRL(r.diffCents) : "—"} strong />
        </div>
        <Status ready={ready} ok={r.ok} diff={r.diffCents} what="o saldo final do banco" />
      </Card>
      <div className="order-3 min-w-0 lg:col-span-2">
        <BankRows kind="extrato" accountId={accountId} items={items} month={month} file={file}
          setFile={(f) => { setFile(f); if (f.info) onBalances(f.info); }} />
      </div>
    </div>
  );
}

/** Conferência da fatura do cartão de crédito. */
function InvoiceCheck({ cardId, month, file, setFile }: { cardId: string; month: string } & FileProps) {
  const snap = useSnapshot()!;
  const [saved, save] = useSaved(savedKey(cardId, "fatura", month));
  const items = cardMovements(snap, cardId, month);
  const invoice = saved.invoice ?? "";
  const r = checkInvoice(money(invoice) ?? 0, items);
  const ready = money(invoice) != null;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
        <MovementsTable title="Compras lançadas nesta fatura" items={items} card empty="Nenhuma compra lançada no cartão para esta fatura." />
      </div>
      <Card className="order-1 h-fit lg:order-2">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">Conferência · Fatura do cartão</h2>
        <MoneyField id="rec-invoice" label="Valor total da fatura (no banco)" value={invoice} onChange={(v) => save({ invoice: v })} />
        <div className="mt-3 border-t border-border pt-2">
          <Row label="Valor total dos lançamentos" value={formatBRL(r.totalCents)} />
          <Row label="Diferença" value={ready ? formatBRL(r.diffCents) : "—"} strong />
          <Row label="Mês das compras" value={<span className="capitalize">{monthLabel(month)}</span>} />
        </div>
        <Status ready={ready} ok={r.ok} diff={r.diffCents} what="o valor da fatura" />
      </Card>
      <div className="order-3 min-w-0 lg:col-span-2">
        <BankRows kind="fatura" cardId={cardId} items={items} month={month} file={file} setFile={setFile} />
      </div>
    </div>
  );
}

function MovementsTable({ title, items, empty, card }: { title: string; items: Movement[]; empty: string; card?: boolean }) {
  return (
    <Card>
      <h2 className="mb-2 text-sm font-semibold">{title} <span className="font-normal text-text-muted">({items.length})</span></h2>
      {items.length === 0 ? <p className="py-6 text-center text-sm text-text-muted">{empty}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-text-muted">
              <th className="py-2 pr-2 font-semibold">{card ? "Dia da compra" : "Data"}</th><th className="py-2 pr-2 font-semibold">Descrição</th>
              {card && <th className="py-2 pr-2 font-semibold">Parcela</th>}<th className="py-2 text-right font-semibold">Valor</th>
            </tr></thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="num whitespace-nowrap py-2 pr-2">{shortDate(m.date)}</td>
                  <td className="py-2 pr-2">{m.description || "—"}</td>
                  {card && <td className="num py-2 pr-2">{m.tx.installmentTotal ? `${m.tx.installmentNumber}/${m.tx.installmentTotal}` : "—"}</td>}
                  <td className={`num whitespace-nowrap py-2 text-right ${card ? "text-danger" : m.amountCents > 0 ? "text-income" : "text-danger"}`}>{formatBRL(card ? -Math.abs(m.amountCents) : m.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Mês do extrato quando o período cabe num mês só. */
function statementMonth(info: StatementInfo): string | null {
  const a = info.periodStart, b = info.periodEnd ?? info.periodStart;
  return a && b && monthOf(a) === monthOf(b) ? monthOf(a) : null;
}

/** Cabeçalho e conferências do próprio arquivo do banco. */
function FileSummary({ info, fileName, month, onUse }: { info: StatementInfo; fileName?: string; month: string; onUse: () => void }) {
  const m = statementMonth(info);
  const recentes = info.checks;
  const ok = (v: boolean | null, yes: string, no: string) => v == null ? null : (
    <li className={`flex items-start gap-2 ${v ? "text-income" : "text-danger"}`}>
      {v ? <Check aria-hidden className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />}{v ? yes : no}
    </li>
  );
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText aria-hidden className="size-5 text-accent" />
          <div>
            <h2 className="text-sm font-semibold">Extrato importado{info.bank ? ` · ${info.bank}` : ""}</h2>
            <p className="text-xs text-text-muted">
              {[info.agency && `Agência ${info.agency}`, info.account && `Conta ${info.account}`,
                info.periodStart && `${shortDate(info.periodStart)} a ${shortDate(info.periodEnd ?? info.periodStart)}`].filter(Boolean).join(" · ") || fileName}
              {info.generatedAt ? ` · gerado em ${info.generatedAt}` : ""}
            </p>
          </div>
        </div>
        {m && info.openingCents != null && info.closingCents != null && (
          <Button size="sm" variant="secondary" onClick={onUse}>{m === month ? "Usar saldos do arquivo" : `Ir para ${monthLabel(m)}`}</Button>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={`Saldo anterior${info.openingDate ? ` (${shortDate(info.openingDate).slice(0, 5)})` : ""}`} value={info.openingCents} />
        <Stat label="Total de créditos" value={info.totalCreditCents} tone="in" />
        <Stat label="Total de débitos" value={info.totalDebitCents} tone="out" />
        <Stat label="Saldo final" value={info.closingCents} />
      </dl>
      <ul className="mt-3 flex flex-col gap-1 text-sm">
        {ok(recentes.totalsOk, "Saldo anterior + créditos + débitos = saldo final.", "Saldo anterior + créditos + débitos não dá o saldo final do arquivo.")}
        {ok(recentes.columnsOk, "As colunas Crédito e Débito somam o Total do arquivo.", "As colunas Crédito e Débito não somam o Total do arquivo.")}
        {info.openingCents != null && ok(recentes.balanceMismatches === 0, "O Saldo do banco confere linha a linha.",
          `${recentes.balanceMismatches} linha(s) com Saldo diferente do calculado.`)}
        {info.dailyBalances.length > 0 && (
          <li className="text-text-muted">Saldos diários da aplicação automática ({info.dailyBalances.length} dias) são só informativos e não entram na conciliação.</li>
        )}
      </ul>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value?: number; tone?: "in" | "out" }) {
  return (
    <div className="rounded-md bg-surface p-2">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className={`num font-semibold ${tone === "in" ? "text-income" : tone === "out" ? "text-danger" : ""}`}>{value == null ? "—" : formatBRL(value)}</dd>
    </div>
  );
}

type Filter = "todos" | "ok" | "banco";

/** Linhas do banco (arquivo ou digitadas), casadas com o app linha a linha. */
function BankRows({ kind, accountId, cardId, items, month, file, setFile }: { kind: Mode; accountId?: string; cardId?: string; items: Movement[]; month: string } & FileProps) {
  const { toast } = useShell();
  const snap = useSnapshot()!;
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [form, setForm] = useState({ date: today(), description: "", amount: "" });
  const [formError, setFormError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const fatura = kind === "fatura";
  const all = file.rows;
  // No extrato, cada mês confere só as suas linhas; a fatura usa o arquivo inteiro.
  const rows = fatura ? all : all.filter((r) => monthOf(r.date) === month);
  const others = all.length - rows.length;
  const m = matchRows(rows, items, { abs: fatura });
  const matchedSet = new Set(m.matched.map((x) => x.row));
  const columns = rows.some((r) => r.history != null);
  const signed = (v: number) => (fatura ? -Math.abs(v) : v); // despesa sempre com sinal negativo
  const matchedTx = new Map(m.matched.map((x) => [x.row, x.item.tx]));
  const catName = (id?: string | null) => snap.categories.find((c) => c.id === id);
  const sideOf = (r: Line): "income" | "expense" => (fatura || r.amountCents < 0 ? "expense" : "income");
  const topsFor = (side: "income" | "expense") => snap.categories
    .filter((c) => !c.archived && !c.parentId && categoryFits(c, side)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const subsFor = (topId: string | undefined, side: "income" | "expense") =>
    topId ? subcategoriesOf(snap.categories, topId).filter((c) => !c.archived && categoryFits(c, side)) : [];
  const setCat = (r: Line, patch: { catId?: string; subId?: string }) =>
    setFile({ ...file, rows: all.map((x) => (x === r ? { ...x, ...patch } : x)) });
  const shown = [...rows].filter((r) => filter === "todos" || (filter === "ok") === matchedSet.has(r));

  async function pick(f: File) {
    setError("");
    try { setFile({ ...(await readStatementDetail(f)), fileName: f.name }); setFilter("todos"); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ler o arquivo."); }
  }
  function add(e: FormEvent) {
    e.preventDefault();
    const v = money(form.amount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return setFormError("Data inválida.");
    if (!v) return setFormError(fatura ? "Informe o valor da compra." : "Informe o valor (negativo para saídas).");
    setFile({ ...file, rows: [...all, { date: form.date, description: form.description.trim(), amountCents: v }] });
    setForm({ date: form.date, description: "", amount: "" }); setFormError("");
  }
  async function launch(row: Line) {
    const amountCents = Math.abs(row.amountCents);
    const categoryId = row.subId || row.catId || null;
    try {
      if (fatura) await repo.createTransaction({ kind: "expense", amountCents, occurredOn: row.date, description: row.description || "Compra no cartão", cardId, categoryId });
      else await repo.createTransaction({ kind: row.amountCents > 0 ? "income" : "expense", amountCents, occurredOn: row.date, description: (row.description || "Lançamento do extrato").slice(0, 140), accountId, isPaid: true, categoryId });
      toast("Lançado no app");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível lançar.");
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{fatura ? "Fatura do banco" : "Extrato do banco"} <span className="font-normal text-text-muted">(opcional)</span></h2>
          <p className="text-xs text-text-muted">Importe o arquivo do banco ou digite as linhas para achar o que falta lançar.</p>
        </div>
        <div className="flex gap-2">
          {all.length > 0 && <Button size="sm" variant="ghost" onClick={() => setFile({ rows: [] })}><Trash2 aria-hidden className="size-4" />Limpar</Button>}
          <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}><FileUp aria-hidden className="size-4" />Importar OFX, CSV ou XLSX</Button>
          <input ref={fileRef} type="file" accept=".ofx,.qfx,.csv,.txt,.xlsx" className="hidden" aria-label="Arquivo do banco"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = ""; }} />
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}

      <form onSubmit={add} noValidate className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[150px_1fr_150px_auto] sm:items-end">
        <Field label="Data" htmlFor="rec-row-date"><Input id="rec-row-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label={fatura ? "Valor" : "Valor (− saída)"} htmlFor="rec-row-amount">
          <Input id="rec-row-amount" inputMode="decimal" className="num" placeholder={fatura ? "0,00" : "-0,00"} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <div className="col-span-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
          <Field label="Descrição" htmlFor="rec-row-desc"><Input id="rec-row-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Como aparece no banco" /></Field>
        </div>
        <Button type="submit" variant="secondary" className="col-span-2 sm:col-span-1"><Plus aria-hidden className="size-4" />Adicionar linha</Button>
      </form>
      {formError && <p role="alert" className="mt-1 text-sm text-danger">{formError}</p>}

      {others > 0 && (
        <p className="mt-3 text-xs text-text-muted">{others} linha(s) do arquivo são de outros meses (como os Últimos Lançamentos). Troque o mês acima para conferi-las.</p>
      )}

      {rows.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          <div role="group" aria-label="Filtrar linhas" className="grid grid-cols-3 gap-2 text-center text-xs">
            <Pill tone="ok" label="Conciliados" n={m.matched.length} active={filter === "ok"} onClick={() => setFilter(filter === "ok" ? "todos" : "ok")} />
            <Pill tone="bank" label="Só no banco" n={m.onlyStatement.length} active={filter === "banco"} onClick={() => setFilter(filter === "banco" ? "todos" : "banco")} />
            <Pill tone="app" label="Só no app" n={m.onlyApp.length} />
          </div>

          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[960px] text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-text-muted">
                <th className="py-2 pr-2 font-semibold" title="Dia do lançamento no banco">Data</th>
                <th className="py-2 pr-2 font-semibold" title="Tipo do lançamento e, abaixo, quem pagou ou recebeu">{columns ? "Histórico" : "Descrição"}</th>
                {columns && <th className="py-2 pr-2 font-semibold" title="Número do documento no banco">Docto.</th>}
                {columns ? <>
                  <th className="py-2 pr-2 text-right font-semibold" title="O que entrou na conta">Crédito (R$)</th>
                  <th className="py-2 pr-2 text-right font-semibold" title="O que saiu da conta">Débito (R$)</th>
                  <th className="py-2 pr-2 text-right font-semibold" title="Saldo após o lançamento. Em cinza, calculado pelo app quando o banco não informa.">Saldo (R$)</th>
                </> : <th className="py-2 pr-2 text-right font-semibold">Valor</th>}
                <th className="py-2 pr-2 font-semibold" title="Categoria de receita ou de despesa, conforme o lançamento">Categoria</th>
                <th className="py-2 pr-2 font-semibold" title="Subcategoria da categoria escolhida">Subcategoria</th>
                <th className="py-2 text-right font-semibold" title="Se a linha já existe no app">Situação</th>
              </tr></thead>
              <tbody>
                {shown.map((r, i) => {
                  const ok = matchedSet.has(r);
                  const bal = r.balanceCents ?? r.runningCents;
                  return (
                    <tr key={`${r.date}-${r.doc ?? ""}-${i}`} className="border-b border-border align-top last:border-0">
                      <td className="num whitespace-nowrap py-2 pr-2">{shortDate(r.date)}</td>
                      <td className="py-2 pr-2">
                        <div className="font-medium">{r.history ?? (r.description || "—")}</div>
                        {r.detail && <div className="text-xs text-text-muted">{r.detail}</div>}
                      </td>
                      {columns && <td className="num py-2 pr-2 text-text-muted">{r.doc ?? "—"}</td>}
                      {columns ? <>
                        <td className="num whitespace-nowrap py-2 pr-2 text-right text-income">{r.creditCents ? plain(r.creditCents) : ""}</td>
                        <td className="num whitespace-nowrap py-2 pr-2 text-right text-danger">{r.debitCents ? plain(r.debitCents) : ""}</td>
                        <td className={`num whitespace-nowrap py-2 pr-2 text-right ${r.balanceCents == null ? "text-text-muted" : ""}`}>{bal == null ? "" : plain(bal)}</td>
                      </> : <td className={`num whitespace-nowrap py-2 pr-2 text-right ${signed(r.amountCents) < 0 ? "text-danger" : "text-income"}`}>{formatBRL(signed(r.amountCents))}</td>}
                      <CategoryCells row={r} tx={matchedTx.get(r)} side={sideOf(r)} tops={topsFor(sideOf(r))} subsFor={subsFor} catName={catName} onChange={(p) => setCat(r, p)} />
                      <td className="py-2 text-right">
                        {ok
                          ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-income"><Check aria-hidden className="size-4" />Conciliado</span>
                          : <Button size="sm" onClick={() => launch(r)} aria-label={`Lançar ${r.description} de ${shortDate(r.date)}`}>Lançar</Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {m.onlyApp.length > 0 && filter === "todos" && (
            <List title="Só no app: não aparecem no banco">
              {m.onlyApp.map((it) => (
                <li key={it.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="num w-20 shrink-0">{shortDate(it.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{it.description || "—"}</span>
                  <span className="num">{formatBRL(signed(it.amountCents))}</span>
                </li>
              ))}
            </List>
          )}
        </div>
      )}
    </Card>
  );
}

function Pill({ tone, label, n, active, onClick }: { tone: "ok" | "bank" | "app"; label: string; n: number; active?: boolean; onClick?: () => void }) {
  const cls = tone === "ok" ? "bg-accent-soft text-income" : tone === "bank" ? "bg-warning/15 text-text" : "bg-surface text-text";
  const body = <><div className="num text-lg font-bold">{n}</div>{label}</>;
  return onClick
    ? <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-md p-2 ${cls} ${active ? "ring-2 ring-accent" : ""}`}>{body}</button>
    : <div className={`rounded-md p-2 ${cls}`}>{body}</div>;
}

function List({ title, children }: { title: string; children: ReactNode }) {
  return <div><h3 className="text-xs font-semibold text-text-muted">{title}</h3><ul className="divide-y divide-border">{children}</ul></div>;
}

/** Colunas Categoria e Subcategoria: escolha para o Lançar, ou a do lançamento já conciliado. */
function CategoryCells({ row, tx, side, tops, subsFor, catName, onChange }: {
  row: Line; tx?: Movement["tx"]; side: "income" | "expense"; tops: Category[];
  subsFor: (topId: string | undefined, side: "income" | "expense") => Category[];
  catName: (id?: string | null) => Category | undefined; onChange: (p: { catId?: string; subId?: string }) => void;
}) {
  if (tx) {
    const c = catName(tx.categoryId);
    const parent = c?.parentId ? catName(c.parentId) : undefined;
    return <>
      <td className="py-2 pr-2 text-text-muted">{(parent ?? c)?.name ?? "Sem categoria"}</td>
      <td className="py-2 pr-2 text-text-muted">{parent ? c?.name : "—"}</td>
    </>;
  }
  const subs = subsFor(row.catId, side);
  const what = side === "income" ? "receita" : "despesa";
  return <>
    <td className="py-1.5 pr-2">
      <select aria-label={`Categoria de ${what} de ${row.description}`} className={`${inputClass} !h-9 min-w-32 text-sm`} value={row.catId ?? ""}
        onChange={(e) => onChange({ catId: e.target.value || undefined, subId: undefined })}>
        <option value="">{tops.length ? "Selecionar" : `Nenhuma de ${what}`}</option>
        {tops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </td>
    <td className="py-1.5 pr-2">
      <select aria-label={`Subcategoria de ${row.description}`} className={`${inputClass} !h-9 min-w-32 text-sm`} value={row.subId ?? ""}
        disabled={!subs.length} onChange={(e) => onChange({ subId: e.target.value || undefined })}>
        <option value="">{!row.catId ? "—" : subs.length ? "Selecionar" : "Sem subcategoria"}</option>
        {subs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </td>
  </>;
}
