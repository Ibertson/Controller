"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, Building2, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, DollarSign, History, Lock, LockOpen, Minus, Plus, Trash2, Wallet,
} from "lucide-react";
import { useShell } from "@/components/AppShell";
import { useSpace } from "@/components/business";
import { Dialog } from "@/components/Dialog";
import { Button, Card, Field, Input, Skeleton } from "@/components/ui";
import { cashDifference, cashTotals, dayTitle, monthGrid, monthTitle, sangriaError } from "@/lib/caixa";
import { repo, useSnapshot } from "@/lib/data";
import { daysInMonth, today } from "@/lib/dates";
import { formatBRL, parseBRL } from "@/lib/money";
import { addDays } from "@/lib/stock";
import type { CashMovement, CashRegister } from "@/lib/types";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEK_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");
const dateBR = (d: string) => d.split("-").reverse().join("/");
type Open = "abrir" | "reforco" | "sangria" | "fechar" | "historico";

/** Caixas do espaço aberto (recarrega ao trocar de espaço). */
function useCashRegisters() {
  const wsId = useSnapshot()?.workspace.id;
  const [state, setState] = useState<{ ws?: string; list?: CashRegister[]; error?: string }>({});
  useEffect(() => {
    if (!wsId) return;
    let alive = true;
    repo.listCashRegisters()
      .then((list) => { if (alive) setState({ ws: wsId, list }); })
      .catch((e) => { if (alive) setState({ ws: wsId, list: [], error: e instanceof Error ? e.message : "Não foi possível carregar." }); });
    return () => { alive = false; };
  }, [wsId]);
  const ready = state.ws === wsId ? state : {};
  return { list: ready.list, error: ready.error, setList: (list: CashRegister[]) => setState({ ws: wsId, list }) };
}

/** Caixa Diário: abre o caixa com o dinheiro da gaveta, registra reforços e sangrias e confere no fechamento. */
export default function CaixaDiario() {
  const { kind } = useSpace();
  const { toast } = useShell();
  const { list, error, setList } = useCashRegisters();
  const now = today();
  const [day, setDay] = useState(now);
  const [open, setOpen] = useState<Open | null>(null);
  const [fail, setFail] = useState("");
  const months = useRef<HTMLElement>(null);
  const month = day.slice(0, 7);
  useEffect(() => { months.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "nearest", inline: "center" }); }, [kind, month]);

  if (kind !== "business") {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 aria-hidden className="size-9 text-text-muted" />
        <h1 className="font-semibold">Caixa Diário faz parte do Painel Empresarial</h1>
        <p className="max-w-md text-sm text-text-muted">Abra a aba Empresarial no topo da tela para abrir e fechar o caixa da sua empresa.</p>
      </Card>
    );
  }
  if (!list) return <div className="flex flex-col gap-4"><Skeleton className="h-12" /><Skeleton className="h-80" /><Skeleton className="h-24" /></div>;

  const byDay = new Map(list.map((r) => [r.day, r]));
  const reg = byDay.get(day);
  const totals = reg ? cashTotals(reg) : null;
  const future = day > now;
  const title = dayTitle(day);

  function put(r: CashRegister) { setList(list!.some((x) => x.id === r.id) ? list!.map((x) => (x.id === r.id ? r : x)) : [...list!, r]); }
  async function save(r: CashRegister, msg: string) {
    setFail("");
    try { await repo.saveCashRegister(r); put(r); toast(msg); return true; }
    catch (x) { setFail(x instanceof Error ? x.message : "Não foi possível salvar."); return false; }
  }
  function pickMonth(m: string) {
    const d = Math.min(Number(day.slice(8)), daysInMonth(m));
    setDay(`${m}-${String(d).padStart(2, "0")}`);
  }
  async function removeMovement(m: CashMovement) {
    if (!reg) return;
    await save({ ...reg, movements: reg.movements.filter((x) => x.id !== m.id) }, m.kind === "reforco" ? "Reforço excluído" : "Sangria excluída");
  }
  async function reopen() {
    if (!reg) return;
    await save({ ...reg, status: "open", countedCents: null, closedAt: null }, "Caixa reaberto");
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Wallet aria-hidden className="size-6 text-accent" />Caixa Diário</h1>
          <p className="text-sm text-text-muted">{monthTitle(month)}</p>
        </div>
        <Button variant="secondary" onClick={() => setOpen("historico")}><History aria-hidden className="size-4" />Histórico</Button>
      </header>

      <nav ref={months} aria-label="Mês" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {MONTHS.map((m, i) => {
          const key = `${now.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button key={key} type="button" aria-pressed={month === key} onClick={() => pickMonth(key)}
              className="h-9 shrink-0 rounded-md border border-border px-4 text-sm hover:bg-surface aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent">{m}</button>
          );
        })}
      </nav>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setDay(addDays(day, -1))} aria-label="Dia anterior" className="rounded-md p-2 hover:bg-surface"><ChevronLeft className="size-5" /></button>
          <div className="text-center" aria-live="polite">
            <p className="text-lg font-bold">{title.title}</p>
            <p className="text-sm text-text-muted">{title.subtitle}</p>
          </div>
          <button type="button" onClick={() => setDay(addDays(day, 1))} aria-label="Próximo dia" className="rounded-md p-2 hover:bg-surface"><ChevronRight className="size-5" /></button>
        </div>
        <table className="mx-auto w-full max-w-md table-fixed border-collapse text-sm">
          <caption className="sr-only">Dias de {monthTitle(month)}</caption>
          <thead>
            <tr>{WEEK.map((w, i) => <th key={i} scope="col" abbr={WEEK_NAMES[i]} className="border border-border py-2 text-xs font-semibold text-text-muted">{w}</th>)}</tr>
          </thead>
          <tbody>
            {monthGrid(month).map((week, wi) => (
              <tr key={wi}>
                {week.map((d, i) => {
                  if (!d) return <td key={i} />;
                  const r = byDay.get(d);
                  const label = `${Number(d.slice(8))}${r ? (r.status === "open" ? ", caixa aberto" : ", caixa fechado") : ""}`;
                  return (
                    <td key={i} className="border border-border p-0">
                      <button type="button" aria-pressed={d === day} aria-label={label} onClick={() => setDay(d)}
                        className={`relative flex h-11 w-full flex-col items-center justify-center text-sm hover:bg-surface aria-pressed:bg-accent aria-pressed:font-bold aria-pressed:text-on-accent sm:h-12 ${d === now ? "font-bold text-accent" : ""}`}>
                        {Number(d.slice(8))}
                        {r && <span aria-hidden className={`absolute bottom-1.5 size-1.5 rounded-pill ${r.status === "open" ? "bg-success" : "bg-text-muted"} ${d === day ? "ring-2 ring-on-accent" : ""}`} />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-text-muted">
          <span className="flex items-center gap-1.5"><span aria-hidden className="size-1.5 rounded-pill bg-success" />Caixa aberto</span>
          <span className="flex items-center gap-1.5"><span aria-hidden className="size-1.5 rounded-pill bg-text-muted" />Caixa fechado</span>
        </p>
      </Card>

      {!reg ? (
        future ? (
          <section className="flex items-center gap-4 rounded-lg border border-border bg-surface-raised p-4 shadow-card">
            <CircleAlert aria-hidden className="size-9 shrink-0 text-text-muted" />
            <div><h2 className="font-semibold">Este dia ainda não chegou</h2><p className="text-sm text-text-muted">O caixa só pode ser aberto a partir do próprio dia.</p></div>
          </section>
        ) : (
          <section className="flex flex-wrap items-center gap-4 rounded-lg border border-danger bg-surface-raised p-4 shadow-card">
            <CircleAlert aria-hidden className="size-9 shrink-0 text-danger" />
            <button type="button" onClick={() => setOpen("abrir")} className="min-w-0 flex-1 text-left">
              <h2 className="font-semibold">Caixa Não Iniciado</h2>
              <p className="text-sm text-text-muted">Clique para abrir o caixa deste dia</p>
            </button>
            <Button onClick={() => setOpen("abrir")} className="w-full sm:w-auto"><DollarSign aria-hidden className="size-4" />Abrir Caixa</Button>
          </section>
        )
      ) : reg.status === "open" ? (
        <section className="flex flex-wrap items-center gap-4 rounded-lg border border-success bg-success/5 p-4 shadow-card">
          <CircleCheck aria-hidden className="size-9 shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Caixa Aberto</h2>
            <p className="text-sm text-text-muted">Abertura: <span className="num">{formatBRL(reg.openingCents)}</span> · às {hhmm(reg.createdAt)}</p>
          </div>
          <Button variant="danger" onClick={() => setOpen("fechar")} className="w-full sm:w-auto"><Lock aria-hidden className="size-4" />Fechar Caixa</Button>
        </section>
      ) : (
        <section className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface-raised p-4 shadow-card">
          <Lock aria-hidden className="size-9 shrink-0 text-text-muted" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Caixa Fechado</h2>
            <p className="text-sm text-text-muted">Abertura <span className="num">{formatBRL(reg.openingCents)}</span> · fechado às {hhmm(reg.closedAt)}</p>
          </div>
          <Button variant="secondary" onClick={() => void reopen()} className="w-full sm:w-auto"><LockOpen aria-hidden className="size-4" />Reabrir Caixa</Button>
        </section>
      )}

      {fail && <p role="alert" className="text-sm text-danger">{fail}</p>}

      {reg && totals && (
        <>
          <div className={`grid gap-3 ${reg.status === "closed" ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
            <Card className="flex flex-col gap-1">
              <p className="text-sm text-text-muted">Saldo Esperado</p>
              <p className="num text-2xl font-bold">{formatBRL(totals.expectedCents)}</p>
              <p className="text-xs text-text-muted">Abertura + Reforços − Sangrias + Vendas em dinheiro</p>
            </Card>
            <Card className="flex flex-col gap-1">
              <p className="flex items-center gap-1.5 text-sm text-text-muted"><ArrowUp aria-hidden className="size-4 text-success" />Reforços</p>
              <p className="num text-2xl font-bold text-success">{formatBRL(totals.reforcoCents)}</p>
              <p className="text-xs text-text-muted">{totals.reforcoCount} {totals.reforcoCount === 1 ? "movimentação" : "movimentações"}</p>
            </Card>
            <Card className="flex flex-col gap-1">
              <p className="flex items-center gap-1.5 text-sm text-text-muted"><ArrowDown aria-hidden className="size-4 text-danger" />Sangrias</p>
              <p className="num text-2xl font-bold text-danger">{formatBRL(totals.sangriaCents)}</p>
              <p className="text-xs text-text-muted">{totals.sangriaCount} {totals.sangriaCount === 1 ? "movimentação" : "movimentações"}</p>
            </Card>
            {reg.status === "closed" && <ClosedCard reg={reg} />}
          </div>

          {reg.status === "open" && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setOpen("reforco")}><Plus aria-hidden className="size-4" />Reforço de Caixa</Button>
              <Button variant="secondary" onClick={() => setOpen("sangria")}><Minus aria-hidden className="size-4" />Sangria de Caixa</Button>
            </div>
          )}

          <Card className="flex flex-col gap-2">
            <h2 className="font-semibold">Movimentações do dia</h2>
            <ul className="flex flex-col divide-y divide-border">
              <li className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-pill bg-accent-soft text-accent"><DollarSign aria-hidden className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium">Abertura do caixa</span><span className="text-xs text-text-muted">{hhmm(reg.createdAt)}</span></span>
                <span className="num text-sm font-semibold">{formatBRL(reg.openingCents)}</span>
                {reg.status === "open" && <span className="w-8" />}
              </li>
              {[...reg.movements].sort((a, b) => a.at.localeCompare(b.at)).map((m) => {
                const out = m.kind === "sangria";
                return (
                  <li key={m.id} className="flex items-center gap-3 py-2.5">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-pill ${out ? "bg-danger-soft text-danger" : "bg-success/10 text-success"}`}>
                      {out ? <ArrowDown aria-hidden className="size-4" /> : <ArrowUp aria-hidden className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{m.reason || (m.kind === "reforco" ? "Reforço de caixa" : m.kind === "sangria" ? "Sangria de caixa" : "Venda em dinheiro")}</span>
                      <span className="text-xs text-text-muted">{m.kind === "reforco" ? "Reforço" : m.kind === "sangria" ? "Sangria" : "Venda"} · {hhmm(m.at)}</span>
                    </span>
                    <span className={`num text-sm font-semibold ${out ? "text-danger" : "text-success"}`}>{out ? "−" : "+"}{formatBRL(m.amountCents)}</span>
                    {reg.status === "open" && m.kind !== "venda" && (
                      <button type="button" onClick={() => void removeMovement(m)} aria-label={`Excluir ${m.kind === "reforco" ? "reforço" : "sangria"} de ${formatBRL(m.amountCents)}`}
                        className="rounded-sm p-2 text-text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
                    )}
                  </li>
                );
              })}
            </ul>
            {reg.movements.length === 0 && <p className="text-sm text-text-muted">Nenhum reforço ou sangria neste dia.</p>}
          </Card>
        </>
      )}

      {open === "abrir" && (
        <OpenDialog last={[...list].filter((r) => r.day < day && r.countedCents != null).sort((a, b) => b.day.localeCompare(a.day))[0]} onClose={() => setOpen(null)}
          onSave={async (cents) => {
            const r: CashRegister = { id: crypto.randomUUID(), day, openingCents: cents, movements: [], status: "open", countedCents: null, closedAt: null, notes: "", createdAt: new Date().toISOString() };
            if (await save(r, "Caixa aberto")) setOpen(null);
          }} />
      )}
      {(open === "reforco" || open === "sangria") && reg && (
        <MovementDialog kind={open} reg={reg} onClose={() => setOpen(null)}
          onSave={async (m) => { if (await save({ ...reg, movements: [...reg.movements, m] }, m.kind === "reforco" ? "Reforço registrado" : "Sangria registrada")) setOpen(null); }} />
      )}
      {open === "fechar" && reg && (
        <CloseDialog reg={reg} onClose={() => setOpen(null)}
          onSave={async (counted, notes) => { if (await save({ ...reg, status: "closed", countedCents: counted, notes, closedAt: new Date().toISOString() }, "Caixa fechado")) setOpen(null); }} />
      )}
      {open === "historico" && <HistoryDialog list={list} onClose={() => setOpen(null)} onPick={(d) => { setDay(d); setOpen(null); }} />}
    </div>
  );
}

function diffText(diff: number) {
  if (diff === 0) return { text: "Confere com o esperado", cls: "text-success" };
  return diff > 0 ? { text: `Sobra de ${formatBRL(diff)}`, cls: "text-warning" } : { text: `Falta de ${formatBRL(-diff)}`, cls: "text-danger" };
}

function ClosedCard({ reg }: { reg: CashRegister }) {
  const diff = cashDifference(reg) ?? 0;
  const d = diffText(diff);
  return (
    <Card className="flex flex-col gap-1">
      <p className="flex items-center gap-1.5 text-sm text-text-muted"><Lock aria-hidden className="size-4" />Contado no fechamento</p>
      <p className="num text-2xl font-bold">{formatBRL(reg.countedCents ?? 0)}</p>
      <p className={`text-xs font-semibold ${d.cls}`}>{d.text}</p>
      {reg.notes && <p className="text-xs text-text-muted">{reg.notes}</p>}
    </Card>
  );
}

function MoneyInput({ id, value, onChange, invalid, autoFocus }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">R$</span>
      <Input id={id} inputMode="decimal" placeholder="0,00" autoFocus={autoFocus} className="num pl-10" value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d,.]/g, ""))} aria-invalid={invalid || undefined} />
    </div>
  );
}

function OpenDialog({ last, onClose, onSave }: { last?: CashRegister; onClose: () => void; onSave: (cents: number) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    const cents = value.trim() ? parseBRL(value) : 0;
    if (cents == null || cents < 0) { setErr("Valor inválido."); return; }
    setBusy(true); await onSave(cents); setBusy(false);
  }
  return (
    <Dialog onClose={onClose} title={<h2 className="flex items-center gap-2 text-lg font-bold"><DollarSign aria-hidden className="size-5 text-accent" />Abrir Caixa</h2>}>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate className="flex flex-col gap-4">
        <Field label="Valor de Abertura" htmlFor="cx-open" error={err} hint="Informe o valor em dinheiro no caixa ao iniciar o dia.">
          <MoneyInput id="cx-open" autoFocus value={value} onChange={(v) => { setValue(v); setErr(""); }} invalid={!!err} />
        </Field>
        {last && (
          <button type="button" onClick={() => setValue(formatBRL(last.countedCents!).replace(/^R\$\s?/, ""))} className="self-start text-sm font-semibold text-accent underline">
            Usar o contado em {dateBR(last.day)}: {formatBRL(last.countedCents!)}
          </button>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={busy}>Abrir Caixa</Button>
        </div>
      </form>
    </Dialog>
  );
}

function MovementDialog({ kind, reg, onClose, onSave }: { kind: "reforco" | "sangria"; reg: CashRegister; onClose: () => void; onSave: (m: CashMovement) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const cents = parseBRL(value);
  const isIn = kind === "reforco";
  async function submit() {
    const e = isIn ? (cents == null || cents <= 0 ? "Informe o valor." : null) : sangriaError(reg, cents);
    if (e) { setErr(e); return; }
    setBusy(true);
    await onSave({ id: crypto.randomUUID(), kind, amountCents: cents!, reason: reason.trim(), at: new Date().toISOString() });
    setBusy(false);
  }
  return (
    <Dialog onClose={onClose} title={
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          {isIn ? <ArrowUp aria-hidden className="size-5 text-success" /> : <ArrowDown aria-hidden className="size-5 text-danger" />}
          {isIn ? "Reforço de Caixa" : "Sangria de Caixa"}
        </h2>
        <p className="mt-1 text-sm text-text-muted">{isIn ? "Registre uma entrada de dinheiro no caixa" : "Registre uma retirada de dinheiro do caixa"}</p>
      </div>
    }>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate className="flex flex-col gap-4">
        <Field label="Valor" htmlFor="cx-value" error={err} hint={isIn ? undefined : `Saldo esperado agora: ${formatBRL(cashTotals(reg).expectedCents)}`}>
          <MoneyInput id="cx-value" autoFocus value={value} onChange={(v) => { setValue(v); setErr(""); }} invalid={!!err} />
        </Field>
        <Field label="Motivo (opcional)" htmlFor="cx-reason">
          <Input id="cx-reason" maxLength={120} placeholder={isIn ? "Ex: Troco adicional" : "Ex: Pagamento de fornecedor"} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={busy} disabled={!cents || cents <= 0} variant={isIn ? "primary" : "danger"} className={isIn ? "bg-success hover:bg-success hover:opacity-90" : ""}>
            {isIn ? "Confirmar Reforço" : "Confirmar Sangria"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function CloseDialog({ reg, onClose, onSave }: { reg: CashRegister; onClose: () => void; onSave: (counted: number, notes: string) => Promise<void> }) {
  const t = cashTotals(reg);
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const counted = value.trim() ? parseBRL(value) : null;
  const diff = counted == null ? null : counted - t.expectedCents;
  const d = diff == null ? null : diffText(diff);
  async function submit() {
    if (counted == null || counted < 0) { setErr("Informe quanto há de dinheiro no caixa."); return; }
    setBusy(true); await onSave(counted, notes.trim()); setBusy(false);
  }
  const row = (label: string, cents: number, cls = "") => (
    <div className="flex justify-between gap-3 text-sm"><dt className="text-text-muted">{label}</dt><dd className={`num font-medium ${cls}`}>{cents < 0 ? "−" : ""}{formatBRL(Math.abs(cents))}</dd></div>
  );
  return (
    <Dialog onClose={onClose} title={<h2 className="flex items-center gap-2 text-lg font-bold"><Lock aria-hidden className="size-5 text-danger" />Fechar Caixa</h2>}>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate className="flex flex-col gap-4">
        <dl className="flex flex-col gap-1.5 rounded-lg bg-surface p-3">
          {row("Abertura", reg.openingCents)}
          {row("Reforços", t.reforcoCents, "text-success")}
          {row("Sangrias", -t.sangriaCents, "text-danger")}
          {row("Vendas em dinheiro", t.vendaCents)}
          <div className="mt-1 flex justify-between gap-3 border-t border-border pt-2"><dt className="font-semibold">Saldo esperado</dt><dd className="num font-bold">{formatBRL(t.expectedCents)}</dd></div>
        </dl>
        <Field label="Valor contado no caixa" htmlFor="cx-count" error={err} hint="Conte o dinheiro da gaveta e digite o total.">
          <MoneyInput id="cx-count" autoFocus value={value} onChange={(v) => { setValue(v); setErr(""); }} invalid={!!err} />
        </Field>
        {d && <p role="status" className={`text-sm font-semibold ${d.cls}`}>{d.text}</p>}
        <Field label="Observação (opcional)" htmlFor="cx-notes">
          <Input id="cx-notes" maxLength={300} placeholder="Ex: Diferença de troco" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="danger" loading={busy}>Fechar Caixa</Button>
        </div>
      </form>
    </Dialog>
  );
}

function HistoryDialog({ list, onClose, onPick }: { list: CashRegister[]; onClose: () => void; onPick: (day: string) => void }) {
  const sorted = [...list].sort((a, b) => b.day.localeCompare(a.day));
  return (
    <Dialog wide onClose={onClose} title={<h2 className="flex items-center gap-2 text-lg font-bold"><History aria-hidden className="size-5 text-accent" />Histórico do Caixa</h2>}>
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">Nenhum caixa aberto ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((r) => {
            const t = cashTotals(r);
            const diff = cashDifference(r);
            const d = diff == null ? null : diffText(diff);
            const title = dayTitle(r.day);
            return (
              <li key={r.id}>
                <button type="button" onClick={() => onPick(r.day)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border p-3 text-left hover:bg-surface">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{dateBR(r.day)} <span className="font-normal text-text-muted">· {title.title.split(",")[0]}</span></span>
                    <span className={`text-xs font-semibold ${r.status === "open" ? "text-success" : "text-text-muted"}`}>{r.status === "open" ? "Aberto" : "Fechado"}</span>
                  </span>
                  <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span><span className="text-xs text-text-muted">Abertura </span><span className="num">{formatBRL(r.openingCents)}</span></span>
                    <span><span className="text-xs text-text-muted">Esperado </span><span className="num font-semibold">{formatBRL(t.expectedCents)}</span></span>
                    {r.countedCents != null && <span><span className="text-xs text-text-muted">Contado </span><span className="num">{formatBRL(r.countedCents)}</span></span>}
                    {d && <span className={`text-xs font-semibold ${d.cls}`}>{d.text}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
