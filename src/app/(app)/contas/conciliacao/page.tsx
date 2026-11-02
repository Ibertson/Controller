"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, FileUp, Plus, Scale, Trash2 } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { Button, Card, EmptyState, Field, Input, Segmented, Skeleton, inputClass } from "@/components/ui";
import { accountHref, accountTitle } from "@/lib/accounts";
import { repo, useSnapshot } from "@/lib/data";
import { addMonths, monthLabel, monthOf, today } from "@/lib/dates";
import { formatBRL, parseBRL } from "@/lib/money";
import { accountMovements, balanceAt, cardMovements, checkInvoice, checkStatement, matchRows, type Movement } from "@/lib/reconcile";
import type { StatementRow } from "@/lib/statement";
import { readStatementFile } from "@/lib/statementFile";

type Mode = "extrato" | "fatura";
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

  if (!snap) return <Skeleton className="h-64" />;
  const account = snap.accounts.find((a) => a.id === id && !a.archived);
  if (!account) {
    return <EmptyState icon={Scale} title="Conta não encontrada." action={<Link href="/contas" className="font-semibold text-accent underline">Voltar para Contas</Link>} />;
  }
  const cards = snap.cards.filter((c) => c.paymentAccountId === account.id && !c.archived);
  const card = cards.find((c) => c.id === cardId) ?? cards[0];

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
        ? <StatementCheck key={`${account.id}-${month}`} accountId={account.id} month={month} />
        : card
          ? <InvoiceCheck key={`${card.id}-${month}`} cardId={card.id} month={month} />
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
function StatementCheck({ accountId, month }: { accountId: string; month: string }) {
  const snap = useSnapshot()!;
  const [saved, save] = useSaved(`sobra:conciliacao:${accountId}:extrato:${month}`);
  const items = accountMovements(snap, accountId, month);
  const initialDefault = balanceAt(snap, accountId, month);
  const initial = saved.initial ?? plain(initialDefault);
  const final = saved.final ?? "";
  const r = checkStatement(money(initial) ?? 0, money(final) ?? 0, items);
  const ready = money(final) != null && money(initial) != null;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="order-2 flex flex-col gap-4 lg:order-1">
        <MovementsTable title="Lançamentos do app no mês" items={items} empty="Nenhum lançamento pago nesta conta no mês." />
        <BankRows kind="extrato" accountId={accountId} items={items} />
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
    </div>
  );
}

/** Conferência da fatura do cartão de crédito. */
function InvoiceCheck({ cardId, month }: { cardId: string; month: string }) {
  const snap = useSnapshot()!;
  const [saved, save] = useSaved(`sobra:conciliacao:${cardId}:fatura:${month}`);
  const items = cardMovements(snap, cardId, month);
  const invoice = saved.invoice ?? "";
  const r = checkInvoice(money(invoice) ?? 0, items);
  const ready = money(invoice) != null;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="order-2 flex flex-col gap-4 lg:order-1">
        <MovementsTable title="Compras lançadas nesta fatura" items={items} card empty="Nenhuma compra lançada no cartão para esta fatura." />
        <BankRows kind="fatura" cardId={cardId} items={items} />
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
                  <td className={`num whitespace-nowrap py-2 text-right ${!card && m.amountCents > 0 ? "text-income" : ""}`}>{formatBRL(m.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Linhas do banco (arquivo ou digitadas), casadas com o app linha a linha. */
function BankRows({ kind, accountId, cardId, items }: { kind: Mode; accountId?: string; cardId?: string; items: Movement[] }) {
  const { toast } = useShell();
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ date: today(), description: "", amount: "" });
  const [formError, setFormError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const fatura = kind === "fatura";
  const m = matchRows(rows, items, { abs: fatura });

  async function pick(file: File) {
    setError("");
    try { setRows(await readStatementFile(file)); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ler o arquivo."); }
  }
  function add(e: FormEvent) {
    e.preventDefault();
    const v = money(form.amount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return setFormError("Data inválida.");
    if (!v) return setFormError(fatura ? "Informe o valor da compra." : "Informe o valor (negativo para saídas).");
    setRows((r) => [...r, { date: form.date, description: form.description.trim(), amountCents: v }]);
    setForm({ date: form.date, description: "", amount: "" }); setFormError("");
  }
  async function launch(row: StatementRow) {
    const amountCents = Math.abs(row.amountCents);
    try {
      if (fatura) await repo.createTransaction({ kind: "expense", amountCents, occurredOn: row.date, description: row.description || "Compra no cartão", cardId });
      else await repo.createTransaction({ kind: row.amountCents > 0 ? "income" : "expense", amountCents, occurredOn: row.date, description: row.description || "Lançamento do extrato", accountId, isPaid: true });
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
          {rows.length > 0 && <Button size="sm" variant="ghost" onClick={() => setRows([])}><Trash2 aria-hidden className="size-4" />Limpar</Button>}
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

      {rows.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <Pill tone="ok" label="Conciliados" n={m.matched.length} />
            <Pill tone="bank" label="Só no banco" n={m.onlyStatement.length} />
            <Pill tone="app" label="Só no app" n={m.onlyApp.length} />
          </div>
          {m.onlyStatement.length > 0 && (
            <List title="Só no banco: faltam no app">
              {m.onlyStatement.map((r, i) => (
                <li key={`${r.date}-${i}`} className="flex items-center gap-3 py-2 text-sm">
                  <span className="num w-20 shrink-0">{shortDate(r.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{r.description || "—"}</span>
                  <span className="num">{formatBRL(fatura ? Math.abs(r.amountCents) : r.amountCents)}</span>
                  <Button size="sm" onClick={() => launch(r)}>Lançar</Button>
                </li>
              ))}
            </List>
          )}
          {m.onlyApp.length > 0 && (
            <List title="Só no app: não aparecem no banco">
              {m.onlyApp.map((it) => (
                <li key={it.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="num w-20 shrink-0">{shortDate(it.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{it.description || "—"}</span>
                  <span className="num">{formatBRL(it.amountCents)}</span>
                </li>
              ))}
            </List>
          )}
          {m.matched.length > 0 && (
            <List title="Conciliados">
              {m.matched.map(({ row, item }) => (
                <li key={item.id} className="flex items-center gap-3 py-2 text-sm">
                  <Check aria-hidden className="size-4 shrink-0 text-income" />
                  <span className="num w-20 shrink-0">{shortDate(row.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{row.description || item.description}</span>
                  <span className="num">{formatBRL(item.amountCents)}</span>
                </li>
              ))}
            </List>
          )}
        </div>
      )}
    </Card>
  );
}

function Pill({ tone, label, n }: { tone: "ok" | "bank" | "app"; label: string; n: number }) {
  const cls = tone === "ok" ? "bg-accent-soft text-income" : tone === "bank" ? "bg-warning/15 text-text" : "bg-surface text-text";
  return <div className={`rounded-md p-2 ${cls}`}><div className="num text-lg font-bold">{n}</div>{label}</div>;
}

function List({ title, children }: { title: string; children: ReactNode }) {
  return <div><h3 className="text-xs font-semibold text-text-muted">{title}</h3><ul className="divide-y divide-border">{children}</ul></div>;
}
