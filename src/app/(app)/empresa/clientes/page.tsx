"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Building2, CalendarDays, Check, DollarSign, Layers, MessageCircle, Pencil, Plus, RotateCcw, Trash2, Undo2, Users } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { useSpace } from "@/components/business";
import { Dialog } from "@/components/Dialog";
import { useReceivables } from "@/components/receivables";
import { Button, Card, Field, Input, Skeleton, inputClass } from "@/components/ui";
import { repo, useSnapshot } from "@/lib/data";
import { today } from "@/lib/dates";
import { formatBRL, parseBRL, splitInstallments } from "@/lib/money";
import {
  CLIENT_KINDS, buildInstallments, clientKindLabel, filterReceivables, maskPhone, openByClient, receivableState, receivableSummary, sortClients, whatsappLink,
  type ReceivableView,
} from "@/lib/receivables";
import type { BusinessClient, ClientKind, Receivable } from "@/lib/types";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const dateBR = (d: string) => d.split("-").reverse().join("/");
const centsText = (c: number) => (c ? formatBRL(c).replace(/^R\$\s*/, "") : "");
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

type Data = { clients: BusinessClient[]; receivables: Receivable[] };
type Open =
  | { kind: "client"; client: BusinessClient | null }
  | { kind: "receivable"; item: Receivable | null }
  | { kind: "receive"; item: Receivable }
  | { kind: "trash" };

/** Clientes & Recebíveis: quem são os clientes, quanto falta receber e o que já venceu. */
export default function ClientesRecebiveis() {
  const { kind } = useSpace();
  const { toast } = useShell();
  const { data, error, setData } = useReceivables();
  const now = today();
  const year = now.slice(0, 4);
  const [month, setMonth] = useState(now.slice(0, 7));
  const [view, setView] = useState<ReceivableView>("month");
  const [open, setOpen] = useState<Open | null>(null);
  const [fail, setFail] = useState("");
  const months = useRef<HTMLElement>(null);
  useEffect(() => { months.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "nearest", inline: "center" }); }, [kind]);

  if (kind !== "business") {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 aria-hidden className="size-9 text-text-muted" />
        <h1 className="font-semibold">Clientes & Recebíveis faz parte do Painel Empresarial</h1>
        <p className="max-w-md text-sm text-text-muted">Abra a aba Empresarial no topo da tela para cadastrar clientes e contas a receber da sua empresa.</p>
      </Card>
    );
  }
  if (!data) return <div className="flex flex-col gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;

  const clients = sortClients(data.clients.filter((c) => !c.deletedAt));
  const clientById = new Map(data.clients.map((c) => [c.id, c]));
  const s = receivableSummary(data.receivables, now);
  const shown = filterReceivables(data.receivables, view, month, now);
  const owed = openByClient(data.receivables);
  const anyReceivable = data.receivables.some((r) => !r.deletedAt);
  const trashCount = data.clients.filter((c) => c.deletedAt).length + data.receivables.filter((r) => r.deletedAt).length;
  const monthName = MONTHS[Number(month.slice(5)) - 1];

  const putReceivables = (items: Receivable[]) => {
    const byId = new Map(data.receivables.map((r) => [r.id, r]));
    for (const r of items) byId.set(r.id, r);
    setData({ ...data, receivables: [...byId.values()] });
  };
  const putClient = (c: BusinessClient) => setData({ ...data, clients: data.clients.some((x) => x.id === c.id) ? data.clients.map((x) => (x.id === c.id ? c : x)) : [...data.clients, c] });

  async function trashReceivable(r: Receivable) {
    setFail("");
    const next = { ...r, deletedAt: new Date().toISOString() };
    try { await repo.saveReceivables([next]); putReceivables([next]); toast("Conta movida para a lixeira"); }
    catch (e) { setFail(e instanceof Error ? e.message : "Não foi possível excluir."); }
  }
  async function trashClient(c: BusinessClient) {
    setFail("");
    const next = { ...c, deletedAt: new Date().toISOString() };
    try { await repo.saveClient(next); putClient(next); toast("Cliente movido para a lixeira"); }
    catch (e) { setFail(e instanceof Error ? e.message : "Não foi possível excluir."); }
  }
  async function undoReceive(r: Receivable) {
    setFail("");
    try {
      if (r.transactionId) await repo.deleteTransaction(r.transactionId, "one");
      const next = { ...r, receivedOn: null, transactionId: null };
      await repo.saveReceivables([next]);
      putReceivables([next]);
      toast(r.transactionId ? "Recebimento desfeito e receita apagada" : "Recebimento desfeito");
    } catch (e) { setFail(e instanceof Error ? e.message : "Não foi possível desfazer."); }
  }

  const stat = (v: ReceivableView, label: string, cents: number, icon: React.ReactNode, tone: string) => (
    <button type="button" aria-pressed={view === v} onClick={() => setView((x) => (x === v ? "month" : v))}
      className="flex flex-col gap-1 rounded-lg border border-border bg-bg p-4 text-left shadow-card hover:bg-surface aria-pressed:border-accent aria-pressed:ring-1 aria-pressed:ring-accent">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">{icon}{label}</span>
      <span className={`num text-2xl font-bold ${tone}`}>{formatBRL(cents)}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <nav ref={months} aria-label="Mês de vencimento" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {MONTHS.map((m, i) => {
          const key = `${year}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button key={key} type="button" aria-pressed={view === "month" && month === key} onClick={() => { setMonth(key); setView("month"); }}
              className="h-9 shrink-0 rounded-md border border-border px-4 text-sm hover:bg-surface aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent">{m}</button>
          );
        })}
      </nav>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <header>
          <h1 className="flex items-center gap-2 text-xl font-bold"><Users aria-hidden className="size-5 text-accent" />Clientes & Recebíveis</h1>
          <p className="text-sm text-text-muted">Gerencie seus clientes e valores a receber</p>
        </header>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen({ kind: "trash" })} className="text-danger">
            <Trash2 aria-hidden className="size-4" />Lixeira{trashCount > 0 && <span className="num rounded-pill bg-danger-soft px-1.5 text-xs">{trashCount}</span>}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setOpen({ kind: "client", client: null })}><Plus aria-hidden className="size-4" />Cliente</Button>
          <Button type="button" onClick={() => setOpen({ kind: "receivable", item: null })}><Plus aria-hidden className="size-4" />Conta a Receber</Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stat("month", "Total a receber", s.totalCents, <DollarSign aria-hidden className="size-4 text-accent" />, "")}
        {stat("overdue", "Vencidos", s.overdueCents, <AlertCircle aria-hidden className="size-4 text-danger" />, "text-danger")}
        {stat("next7", "Próximos 7 dias", s.next7Cents, <CalendarDays aria-hidden className="size-4 text-warning" />, "text-warning")}
      </div>
      <p className="-mt-2 text-xs text-text-muted">Valores em aberto de todos os meses. Toque em Vencidos ou Próximos 7 dias para ver só essas contas.</p>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {fail && <p role="alert" className="text-sm text-danger">{fail}</p>}

      <Card className="flex flex-col gap-2 !p-0">
        <h2 className="border-b border-border px-4 py-3 font-semibold">
          Contas a receber<span className="font-normal text-text-muted"> · {view === "overdue" ? "vencidas" : view === "next7" ? "próximos 7 dias" : monthName}</span>
        </h2>
        {!anyReceivable ? (
          <p className="px-4 pb-4 pt-2 text-center text-sm text-text-muted">Nenhuma conta a receber cadastrada ainda.</p>
        ) : shown.length === 0 ? (
          <p className="px-4 pb-4 pt-2 text-center text-sm text-text-muted">{view === "overdue" ? "Nenhuma conta vencida." : view === "next7" ? "Nada vence nos próximos 7 dias." : `Nenhuma conta com vencimento em ${monthName}.`}</p>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((r) => {
              const st = receivableState(r, now);
              const c = r.clientId ? clientById.get(r.clientId) : undefined;
              const wa = c && st !== "received" ? whatsappLink(c.phone) : null;
              const msg = c ? `Olá, ${c.name.split(" ")[0]}! Passando para lembrar de ${r.description}${r.installments > 1 ? ` (parcela ${r.installment}/${r.installments})` : ""}, no valor de ${formatBRL(r.amountCents)}, com vencimento em ${dateBR(r.dueOn)}.` : "";
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-pill ${st === "received" ? "bg-accent-soft text-success" : st === "overdue" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"}`}>
                    {st === "received" ? <Check aria-hidden className="size-4" /> : st === "overdue" ? <AlertCircle aria-hidden className="size-4" /> : <CalendarDays aria-hidden className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.description}{r.installments > 1 && <span className="ml-1.5 text-xs font-medium text-text-muted">{r.installment}/{r.installments}</span>}</p>
                    <p className="flex flex-wrap gap-x-2 text-xs text-text-muted">
                      {c && <span>{c.name}{c.deletedAt && " (na lixeira)"}</span>}
                      <span className={st === "overdue" ? "font-semibold text-danger" : ""}>{st === "received" ? `Recebido em ${dateBR(r.receivedOn!)}` : st === "overdue" ? `Venceu em ${dateBR(r.dueOn)}` : `Vence em ${dateBR(r.dueOn)}`}</span>
                    </p>
                  </div>
                  <div className="ml-12 flex w-full items-center justify-between gap-2 sm:ml-0 sm:w-auto sm:gap-3">
                  <span className={`num font-bold ${st === "received" ? "text-success" : ""}`}>{formatBRL(r.amountCents)}</span>
                  <div className="flex items-center">
                    {st === "received" ? (
                      <button type="button" onClick={() => void undoReceive(r)} aria-label={`Desfazer recebimento de ${r.description}`} title="Desfazer recebimento"
                        className="rounded-sm p-2 text-text-muted hover:bg-surface hover:text-text"><Undo2 className="size-4" /></button>
                    ) : (
                      <button type="button" onClick={() => setOpen({ kind: "receive", item: r })} aria-label={`Receber ${r.description}`}
                        className="inline-flex items-center gap-1 rounded-sm px-2 py-1.5 text-sm font-semibold text-success hover:bg-accent-soft"><Check aria-hidden className="size-4" />Receber</button>
                    )}
                    {wa && <a href={`${wa}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" aria-label={`Cobrar ${c!.name} pelo WhatsApp`} title="Cobrar pelo WhatsApp"
                      className="rounded-sm p-2 text-text-muted hover:bg-surface hover:text-success"><MessageCircle className="size-4" /></a>}
                    <button type="button" onClick={() => setOpen({ kind: "receivable", item: r })} aria-label={`Editar ${r.description}`} className="rounded-sm p-2 text-text-muted hover:bg-surface hover:text-text"><Pencil className="size-4" /></button>
                    <button type="button" onClick={() => void trashReceivable(r)} aria-label={`Excluir ${r.description}`} className="rounded-sm p-2 text-text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
                  </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-2 !p-0">
        <h2 className="border-b border-border px-4 py-3 font-semibold">Seus clientes{clients.length > 0 && <span className="font-normal text-text-muted"> · {clients.length}</span>}</h2>
        {clients.length === 0 ? (
          <p className="px-4 pb-4 pt-2 text-center text-sm text-text-muted">Nenhum cliente cadastrado ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {clients.map((c) => {
              const wa = whatsappLink(c.phone);
              return (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-pill bg-accent-soft text-sm font-bold text-accent">{initials(c.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold"><span className="truncate">{c.name}</span>
                      <span className="shrink-0 rounded-pill bg-surface px-2 py-0.5 text-[11px] font-medium text-text-muted">{clientKindLabel(c.kind)}</span></p>
                    <p className="flex flex-wrap gap-x-2 text-xs text-text-muted">
                      {c.phone && (wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className="hover:text-success hover:underline">{c.phone}</a> : <span>{c.phone}</span>)}
                      {owed[c.id] ? <span>Em aberto: <strong className="num text-text">{formatBRL(owed[c.id])}</strong></span> : null}
                      {c.notes && <span className="truncate">{c.notes}</span>}
                    </p>
                  </div>
                  <button type="button" onClick={() => setOpen({ kind: "client", client: c })} aria-label={`Editar ${c.name}`} className="rounded-sm p-2 text-text-muted hover:bg-surface hover:text-text"><Pencil className="size-4" /></button>
                  <button type="button" onClick={() => void trashClient(c)} aria-label={`Excluir ${c.name}`} className="rounded-sm p-2 text-text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {open?.kind === "client" && (
        <ClientDialog initial={open.client} onClose={() => setOpen(null)} onSaved={(c) => { putClient(c); setOpen(null); }} />
      )}
      {open?.kind === "receivable" && (
        <ReceivableDialog initial={open.item} clients={clients} onClose={() => setOpen(null)}
          onSaved={(items) => { putReceivables(items); setOpen(null); if (!open.item) { setMonth(items[0].dueOn.slice(0, 7)); setView("month"); } }} />
      )}
      {open?.kind === "receive" && (
        <ReceiveDialog item={open.item} client={open.item.clientId ? clientById.get(open.item.clientId) : undefined} onClose={() => setOpen(null)}
          onDone={(r) => { putReceivables([r]); setOpen(null); }} />
      )}
      {open?.kind === "trash" && <TrashDialog data={data} setData={setData} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ClientDialog({ initial, onClose, onSaved }: { initial: BusinessClient | null; onClose: () => void; onSaved: (c: BusinessClient) => void }) {
  const { toast } = useShell();
  const [f, setF] = useState({ name: initial?.name ?? "", phone: initial?.phone ?? "", kind: initial?.kind ?? ("eventual" as ClientKind), notes: initial?.notes ?? "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => { setF((x) => ({ ...x, [k]: v })); setErr({}); };

  async function save() {
    if (!f.name.trim()) { setErr({ name: "Informe o nome do cliente." }); return; }
    const c: BusinessClient = {
      id: initial?.id ?? crypto.randomUUID(), name: f.name.trim(), phone: f.phone.trim(), kind: f.kind, notes: f.notes.trim(),
      deletedAt: initial?.deletedAt ?? null, createdAt: initial?.createdAt ?? new Date().toISOString(),
    };
    setBusy(true);
    try { await repo.saveClient(c); toast(initial ? "Cliente salvo" : "Cliente adicionado"); onSaved(c); }
    catch (x) { setErr({ form: x instanceof Error ? x.message : "Não foi possível salvar." }); }
    finally { setBusy(false); }
  }

  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-bold">{initial ? "Editar Cliente" : "Adicionar Cliente"}</h2>}>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate className="flex flex-col gap-4">
        <Field label="Nome do cliente" htmlFor="cl-name" error={err.name}>
          <Input id="cl-name" autoFocus maxLength={120} placeholder="Nome completo ou razão social" value={f.name} onChange={(e) => set("name")(e.target.value)} aria-invalid={!!err.name || undefined} />
        </Field>
        <Field label="Contato" htmlFor="cl-phone">
          <Input id="cl-phone" type="tel" inputMode="tel" placeholder="(11) 99999-9999" value={f.phone} onChange={(e) => set("phone")(maskPhone(e.target.value))} />
        </Field>
        <Field label="Tipo" htmlFor="cl-kind" hint="Recorrente: compra ou paga todo mês. Eventual: de vez em quando.">
          <select id="cl-kind" value={f.kind} onChange={(e) => set("kind")(e.target.value)} className={inputClass}>
            {CLIENT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </Field>
        <Field label="Observações" htmlFor="cl-notes">
          <Input id="cl-notes" maxLength={2000} placeholder="Observações sobre o cliente..." value={f.notes} onChange={(e) => set("notes")(e.target.value)} />
        </Field>
        {err.form && <p role="alert" className="text-sm text-danger">{err.form}</p>}
        <Button type="submit" size="lg" loading={busy} className="w-full rounded-pill">Salvar Cliente</Button>
      </form>
    </Dialog>
  );
}

function ReceivableDialog({ initial, clients, onClose, onSaved }: {
  initial: Receivable | null; clients: BusinessClient[]; onClose: () => void; onSaved: (items: Receivable[]) => void;
}) {
  const { toast } = useShell();
  const [f, setF] = useState({ description: initial?.description ?? "", value: centsText(initial?.amountCents ?? 0), due: initial?.dueOn ?? today(), clientId: initial?.clientId ?? "" });
  const [split, setSplit] = useState(false);
  const [n, setN] = useState(2);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => { setF((x) => ({ ...x, [k]: v })); setErr({}); };
  const cents = parseBRL(f.value);
  const parts = split && cents && cents > 0 ? splitInstallments(cents, n) : null;

  async function save() {
    const e: Record<string, string> = {};
    if (!f.description.trim()) e.description = "Descreva a conta.";
    if (!f.value.trim() || cents == null || cents <= 0) e.value = "Informe o valor.";
    else if (split && cents < n) e.value = "Valor pequeno demais para dividir.";
    if (!f.due) e.due = "Informe a data de vencimento.";
    setErr(e);
    if (Object.keys(e).length) return;
    const items = initial
      ? [{ ...initial, description: f.description.trim(), amountCents: cents!, dueOn: f.due, clientId: f.clientId || null }]
      : buildInstallments({ description: f.description.trim(), totalCents: cents!, firstDue: f.due, clientId: f.clientId || null, installments: split ? n : 1 },
        () => crypto.randomUUID(), new Date().toISOString());
    setBusy(true);
    try {
      await repo.saveReceivables(items);
      toast(initial ? "Conta salva" : items.length > 1 ? `${items.length} parcelas salvas` : "Conta a receber salva");
      onSaved(items);
    } catch (x) { setErr({ form: x instanceof Error ? x.message : "Não foi possível salvar." }); }
    finally { setBusy(false); }
  }

  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-bold">{initial ? "Editar Conta a Receber" : "Adicionar Conta a Receber"}
      {initial && initial.installments > 1 && <span className="block text-sm font-normal text-text-muted">Parcela {initial.installment} de {initial.installments}</span>}</h2>}>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate className="flex flex-col gap-4">
        <Field label="Descrição" htmlFor="rc-desc" error={err.description}>
          <Input id="rc-desc" autoFocus maxLength={200} placeholder="Ex: Serviço de consultoria" value={f.description} onChange={(e) => set("description")(e.target.value)} aria-invalid={!!err.description || undefined} />
        </Field>
        <Field label={split ? "Valor total" : "Valor"} htmlFor="rc-value" error={err.value}>
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">R$</span>
            <Input id="rc-value" inputMode="decimal" placeholder="0,00" className="num pl-10" value={f.value}
              onChange={(e) => set("value")(e.target.value.replace(/[^\d,.]/g, ""))} aria-invalid={!!err.value || undefined} />
          </div>
        </Field>
        <Field label={split ? "Data de vencimento da 1ª parcela" : "Data de vencimento"} htmlFor="rc-due" error={err.due}>
          <Input id="rc-due" type="date" value={f.due} onChange={(e) => set("due")(e.target.value)} aria-invalid={!!err.due || undefined} />
        </Field>
        <Field label="Cliente (opcional)" htmlFor="rc-client" hint={clients.length === 0 ? "Cadastre clientes no botão + Cliente" : undefined}>
          <select id="rc-client" value={f.clientId} onChange={(e) => set("clientId")(e.target.value)} className={inputClass}>
            <option value="">Selecione um cliente</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {!initial && (
          <div className="flex flex-col gap-3 rounded-lg bg-surface p-3">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="rc-split" className="flex items-center gap-2 text-sm font-medium"><Layers aria-hidden className="size-4 text-accent" />Pagamento parcelado</label>
              <button id="rc-split" type="button" role="switch" aria-checked={split} onClick={() => setSplit((v) => !v)}
                className="relative h-7 w-12 shrink-0 rounded-pill bg-border transition-colors aria-checked:bg-accent">
                <span aria-hidden className={`absolute top-1 size-5 rounded-pill bg-white shadow-card transition-all ${split ? "left-6" : "left-1"}`} />
              </button>
            </div>
            {split && (
              <>
                <Field label="Número de parcelas" htmlFor="rc-n">
                  <select id="rc-n" value={n} onChange={(e) => setN(Number(e.target.value))} className={inputClass}>
                    {Array.from({ length: 11 }, (_, i) => i + 2).map((k) => <option key={k} value={k}>{k}x</option>)}
                  </select>
                </Field>
                <p className="-mt-1 text-xs text-text-muted">
                  Valor por parcela: <strong className="num text-text">{formatBRL(parts ? parts[parts.length - 1] : 0)}</strong>
                  {parts && parts[0] !== parts[parts.length - 1] && <> (a 1ª fica com <span className="num">{formatBRL(parts[0])}</span>)</>}. Uma por mês a partir do 1º vencimento.
                </p>
              </>
            )}
          </div>
        )}
        {err.form && <p role="alert" className="text-sm text-danger">{err.form}</p>}
        <Button type="submit" size="lg" loading={busy} className="w-full rounded-pill">{initial ? "Salvar alterações" : split ? `Salvar ${n} Parcelas` : "Salvar Recebível"}</Button>
      </form>
    </Dialog>
  );
}

function ReceiveDialog({ item, client, onClose, onDone }: { item: Receivable; client?: BusinessClient; onClose: () => void; onDone: (r: Receivable) => void }) {
  const { toast } = useShell();
  const accounts = (useSnapshot()?.accounts ?? []).filter((a) => !a.archived);
  const [day, setDay] = useState(today());
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [launch, setLaunch] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!day) { setErr("Informe a data."); return; }
    setBusy(true); setErr("");
    try {
      let transactionId: string | null = null;
      if (launch) {
        const rows = await repo.createTransaction({
          kind: "income", amountCents: item.amountCents, occurredOn: day, isPaid: true, accountId: accountId || null,
          description: `${item.description}${item.installments > 1 ? ` (${item.installment}/${item.installments})` : ""}${client ? ` · ${client.name}` : ""}`,
        });
        transactionId = rows[0]?.id ?? null;
      }
      const next = { ...item, receivedOn: day, transactionId };
      await repo.saveReceivables([next]);
      toast(launch ? "Recebido e lançado em Vendas" : "Marcado como recebido");
      onDone(next);
    } catch (x) { setErr(x instanceof Error ? x.message : "Não foi possível registrar."); }
    finally { setBusy(false); }
  }

  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-bold">Receber conta<span className="block text-sm font-normal text-text-muted">{item.description} · {formatBRL(item.amountCents)}</span></h2>}>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate className="flex flex-col gap-4">
        <Field label="Data do recebimento" htmlFor="rv-day">
          <Input id="rv-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={launch} onChange={(e) => setLaunch(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
          <span>Lançar como receita em Vendas<span className="block text-xs text-text-muted">Entra no Extrato, no Fluxo de Caixa e no DRE.</span></span>
        </label>
        {launch && (
          <Field label="Conta que recebeu" htmlFor="rv-account">
            <select id="rv-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
              <option value="">Sem conta</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        )}
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <Button type="submit" size="lg" loading={busy} className="w-full rounded-pill"><Check aria-hidden className="size-4" />Confirmar recebimento</Button>
      </form>
    </Dialog>
  );
}

function TrashDialog({ data, setData, onClose }: { data: Data; setData: (d: Data) => void; onClose: () => void }) {
  const { toast } = useShell();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const clients = data.clients.filter((c) => c.deletedAt);
  const recs = data.receivables.filter((r) => r.deletedAt);

  async function run(key: string, fn: () => Promise<Data>, msg: string) {
    setBusy(key); setErr("");
    try { setData(await fn()); toast(msg); }
    catch (x) { setErr(x instanceof Error ? x.message : "Não foi possível concluir."); }
    finally { setBusy(""); }
  }
  const restoreClient = (c: BusinessClient) => run(c.id, async () => {
    const next = { ...c, deletedAt: null }; await repo.saveClient(next);
    return { ...data, clients: data.clients.map((x) => (x.id === c.id ? next : x)) };
  }, "Cliente restaurado");
  const purgeClient = (c: BusinessClient) => run(c.id, async () => {
    await repo.deleteClient(c.id);
    return { clients: data.clients.filter((x) => x.id !== c.id), receivables: data.receivables.map((r) => (r.clientId === c.id ? { ...r, clientId: null } : r)) };
  }, "Cliente apagado");
  const restoreRec = (r: Receivable) => run(r.id, async () => {
    const next = { ...r, deletedAt: null }; await repo.saveReceivables([next]);
    return { ...data, receivables: data.receivables.map((x) => (x.id === r.id ? next : x)) };
  }, "Conta restaurada");
  const purgeRec = (r: Receivable) => run(r.id, async () => {
    await repo.deleteReceivable(r.id);
    return { ...data, receivables: data.receivables.filter((x) => x.id !== r.id) };
  }, "Conta apagada");

  const row = (key: string, title: string, sub: string, onRestore: () => void, onPurge: () => void) => (
    <li key={key} className="flex items-center gap-2 py-2">
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{title}</span><span className="block truncate text-xs text-text-muted">{sub}</span></span>
      <Button type="button" size="sm" variant="secondary" loading={busy === key} onClick={onRestore}><RotateCcw aria-hidden className="size-4" />Restaurar</Button>
      <button type="button" disabled={!!busy} onClick={onPurge} aria-label={`Apagar de vez ${title}`} title="Apagar de vez" className="rounded-sm p-2 text-danger hover:bg-danger-soft disabled:opacity-50"><Trash2 className="size-4" /></button>
    </li>
  );

  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-bold">Lixeira</h2>}>
      <div className="flex flex-col gap-4">
        {clients.length + recs.length === 0 ? <p className="py-6 text-center text-sm text-text-muted">A lixeira está vazia.</p> : (
          <>
            {recs.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold">Contas a receber</h3>
                <ul className="divide-y divide-border">
                  {recs.map((r) => row(r.id, r.description + (r.installments > 1 ? ` ${r.installment}/${r.installments}` : ""), `${formatBRL(r.amountCents)} · vence ${dateBR(r.dueOn)}`, () => void restoreRec(r), () => void purgeRec(r)))}
                </ul>
              </section>
            )}
            {clients.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold">Clientes</h3>
                <ul className="divide-y divide-border">
                  {clients.map((c) => row(c.id, c.name, c.phone || clientKindLabel(c.kind), () => void restoreClient(c), () => void purgeClient(c)))}
                </ul>
              </section>
            )}
            <p className="text-xs text-text-muted">Apagar de vez não pode ser desfeito. Receitas já lançadas continuam em Vendas.</p>
          </>
        )}
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      </div>
    </Dialog>
  );
}
