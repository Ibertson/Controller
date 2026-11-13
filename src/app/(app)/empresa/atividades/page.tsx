"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Building2, CalendarClock, ChevronLeft, ChevronRight, Filter, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { useActivities } from "@/components/activities";
import { useSpace } from "@/components/business";
import { Dialog } from "@/components/Dialog";
import { useQuotes } from "@/components/quotes";
import { useReceivables } from "@/components/receivables";
import { useServices } from "@/components/services";
import { Button, Card, Field, Input, Skeleton, inputClass } from "@/components/ui";
import { ACTIVITY_STATUSES, activityCounts, clientSuggestions, filterActivities, isOverdue, neighborStatus, statusLabel } from "@/lib/activities";
import { repo, useSnapshot } from "@/lib/data";
import { today } from "@/lib/dates";
import { formatBRL, parseBRL } from "@/lib/money";
import type { Activity, ActivityStatus } from "@/lib/types";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const dateBR = (d: string) => d.split("-").reverse().join("/");
const centsText = (c: number) => (c ? formatBRL(c).replace(/^R\$\s*/, "") : "");

/** Cor de cada coluna: número do cartão de contagem e selo do quadro. */
const TONE: Record<ActivityStatus, { text: string; soft: string }> = {
  todo: { text: "text-text", soft: "bg-surface text-text-muted" },
  doing: { text: "text-blue-600", soft: "bg-blue-600/10 text-blue-600" },
  waiting: { text: "text-warning", soft: "bg-warning-soft text-warning" },
  done: { text: "text-success", soft: "bg-accent-soft text-success" },
};

/** Agenda / Atividades: quadro dos serviços e projetos da empresa, de "A Fazer" até "Concluído". */
export default function Atividades() {
  const { kind } = useSpace();
  const { toast } = useShell();
  const { list, error, setList } = useActivities();
  const now = today();
  const year = now.slice(0, 4);
  const [month, setMonth] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ActivityStatus | "all">("all");
  const [editing, setEditing] = useState<Activity | "new" | null>(null);
  const [dragOver, setDragOver] = useState<ActivityStatus | null>(null);
  const [fail, setFail] = useState("");
  const months = useRef<HTMLElement>(null);
  useEffect(() => { months.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "nearest", inline: "center" }); }, [kind]);

  if (kind !== "business") {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 aria-hidden className="size-9 text-text-muted" />
        <h1 className="font-semibold">Agenda / Atividades faz parte do Painel Empresarial</h1>
        <p className="max-w-md text-sm text-text-muted">Abra a aba Empresarial no topo da tela para organizar os serviços e projetos da sua empresa.</p>
      </Card>
    );
  }
  if (!list) return <div className="flex flex-col gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;

  const inMonth = filterActivities(list, { q: "", status: "all", month });
  const counts = activityCounts(inMonth);
  const shown = filterActivities(list, { q, status, month });

  async function move(a: Activity, to: ActivityStatus) {
    if (a.status === to || !list) return;
    const next = { ...a, status: to };
    const before = list;
    setList(list.map((x) => (x.id === a.id ? next : x)));
    setFail("");
    try { await repo.saveActivity(next); toast(`Movida para ${statusLabel(to)}`); }
    catch (e) { setList(before); setFail(e instanceof Error ? e.message : "Não foi possível mover."); }
  }

  return (
    <div className="flex flex-col gap-4">
      <nav ref={months} aria-label="Mês de vencimento" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {[["", "Todos"], ...MONTHS.map((m, i) => [`${year}-${String(i + 1).padStart(2, "0")}`, m])].map(([key, label]) => (
          <button key={key || "all"} type="button" aria-pressed={month === key} onClick={() => setMonth(key)}
            className="h-9 shrink-0 rounded-md border border-border px-4 text-sm hover:bg-surface aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent">{label}</button>
        ))}
      </nav>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <header>
            <h1 className="flex items-center gap-2 text-xl font-bold"><CalendarClock aria-hidden className="size-5 text-accent" />Atividades</h1>
            <p className="text-sm text-text-muted">Organize seus projetos e serviços em andamento</p>
          </header>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" aria-expanded={showFilters} aria-controls="act-filters" onClick={() => setShowFilters((v) => !v)}>
              <Filter aria-hidden className="size-4" />Filtros
            </Button>
            <Button type="button" onClick={() => setEditing("new")}><Plus aria-hidden className="size-4" />Nova Atividade</Button>
          </div>
        </div>
        {showFilters && (
          <div id="act-filters" className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <Field label="Buscar" htmlFor="act-q">
              <div className="relative">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
                <Input id="act-q" type="search" className="pl-9" placeholder="Cliente ou serviço..." value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </Field>
            <Field label="Status" htmlFor="act-status">
              <select id="act-status" value={status} onChange={(e) => setStatus(e.target.value as ActivityStatus | "all")} className={inputClass}>
                <option value="all">Todos</option>
                {ACTIVITY_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Field>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ACTIVITY_STATUSES.map((s) => (
          <div key={s.id} className="rounded-lg border border-border bg-bg p-3 shadow-card sm:p-4">
            <span className="block min-w-0">
              <span className="block text-[11px] font-semibold uppercase leading-tight tracking-wide text-text-muted sm:text-xs">{s.short}</span>
              <span className={`num block text-2xl font-bold ${TONE[s.id].text}`}>{counts[s.id].n}</span>
            </span>
          </div>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {fail && <p role="alert" className="text-sm text-danger">{fail}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ACTIVITY_STATUSES.map((s) => {
          const items = shown.filter((a) => a.status === s.id);
          const cents = items.reduce((t, a) => t + a.valueCents, 0);
          return (
            <section key={s.id} aria-label={s.label}
              onDragOver={(e) => { e.preventDefault(); setDragOver(s.id); }} onDragLeave={() => setDragOver((v) => (v === s.id ? null : v))}
              onDrop={(e) => { e.preventDefault(); setDragOver(null); const a = list.find((x) => x.id === e.dataTransfer.getData("text/plain")); if (a) void move(a, s.id); }}
              className={`flex min-h-48 flex-col gap-2 rounded-lg border-2 border-dashed p-3 ${dragOver === s.id ? "border-accent bg-accent-soft" : "border-border bg-surface/40"}`}>
              <h2 className="flex items-center justify-between gap-2 font-semibold">
                <span>{s.label}</span>
                <span className={`num rounded-pill px-2 py-0.5 text-xs ${TONE[s.id].soft}`}>{items.length}</span>
              </h2>
              {items.length > 0 && <p className="-mt-1 text-xs text-text-muted">Total: <span className="num">{formatBRL(cents)}</span></p>}
              {items.length === 0 ? (
                <p className="m-auto py-6 text-center text-sm text-text-muted">Nenhuma atividade</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {items.map((a) => {
                    const late = isOverdue(a, now);
                    const prev = neighborStatus(a.status, -1), next = neighborStatus(a.status, 1);
                    return (
                      <li key={a.id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", a.id); e.dataTransfer.effectAllowed = "move"; }}
                        className="flex flex-col gap-1.5 rounded-md border border-border bg-bg p-3 shadow-card">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{a.clientName}</p>
                            <p className="line-clamp-2 text-sm text-text-muted">{a.title}</p>
                          </div>
                          <button type="button" aria-label={`Editar ${a.title} de ${a.clientName}`} onClick={() => setEditing(a)} className="-m-1 rounded-sm p-1.5 text-text-muted hover:bg-surface hover:text-text">
                            <Pencil className="size-4" />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                          <span className="num font-bold">{formatBRL(a.valueCents)}</span>
                          <span className={`flex items-center gap-1 text-xs ${late ? "font-semibold text-danger" : "text-text-muted"}`}>
                            {late ? <AlertCircle aria-hidden className="size-3.5" /> : <CalendarClock aria-hidden className="size-3.5" />}
                            {late ? "Atrasada · " : "Vence "}{dateBR(a.dueOn)}
                          </span>
                        </div>
                        {a.notes && <p className="line-clamp-2 text-xs text-text-muted">{a.notes}</p>}
                        <div className="flex justify-between border-t border-border pt-1.5">
                          {prev ? (
                            <button type="button" onClick={() => void move(a, prev)} aria-label={`Mover ${a.title} para ${statusLabel(prev)}`}
                              className="inline-flex items-center gap-0.5 rounded-sm px-1.5 py-1 text-xs text-text-muted hover:bg-surface hover:text-text"><ChevronLeft aria-hidden className="size-3.5" />Voltar</button>
                          ) : <span />}
                          {next && (
                            <button type="button" onClick={() => void move(a, next)} aria-label={`Mover ${a.title} para ${statusLabel(next)}`}
                              className="inline-flex items-center gap-0.5 rounded-sm px-1.5 py-1 text-xs font-semibold text-accent hover:bg-accent-soft">{statusLabel(next)}<ChevronRight aria-hidden className="size-3.5" /></button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      {list.length > 0 && <p className="-mt-2 text-xs text-text-muted">Use os botões de cada cartão para mudar de coluna. No computador, também dá para arrastar.</p>}

      {editing && (
        <ActivityDialog initial={editing === "new" ? null : editing} activities={list} onClose={() => setEditing(null)}
          onSaved={(a) => { setList(list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [...list, a]); setEditing(null); }}
          onDeleted={(id) => { setList(list.filter((x) => x.id !== id)); setEditing(null); }} />
      )}
    </div>
  );
}

function ActivityDialog({ initial, activities, onClose, onSaved, onDeleted }: {
  initial: Activity | null; activities: Activity[]; onClose: () => void; onSaved: (a: Activity) => void; onDeleted: (id: string) => void;
}) {
  const { toast } = useShell();
  const snap = useSnapshot();
  const { list: services } = useServices();
  const { list: quotes } = useQuotes();
  const { data: crm } = useReceivables();
  const [f, setF] = useState({
    client: initial?.clientName ?? "", serviceId: initial?.serviceId ?? "", title: initial?.title ?? "", value: centsText(initial?.valueCents ?? 0),
    due: initial?.dueOn ?? today(), notes: initial?.notes ?? "", status: initial?.status ?? ("todo" as ActivityStatus),
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => { setF((x) => ({ ...x, [k]: v })); setErr((e) => ({ ...e, [k]: "", form: "" })); };
  const clients = clientSuggestions((crm?.clients ?? []).filter((c) => !c.deletedAt).map((c) => c.name), activities.map((a) => a.clientName), (quotes ?? []).map((x) => x.clientName), (snap?.people ?? []).filter((p) => !p.archived).map((p) => p.name));
  const activeServices = (services ?? []).filter((s) => s.active || s.id === f.serviceId);

  function pickService(id: string) {
    const s = services?.find((x) => x.id === id);
    setF((x) => ({ ...x, serviceId: id, ...(s ? { title: s.name, value: centsText(s.priceCents) } : {}) }));
    setErr({});
  }

  async function save() {
    const e: Record<string, string> = {};
    const value = parseBRL(f.value);
    if (!f.client.trim()) e.client = "Informe o cliente.";
    if (!f.title.trim()) e.title = "Descreva o serviço ou projeto.";
    if (!f.value.trim() || value == null || value < 0) e.value = "Informe o valor.";
    if (!f.due) e.due = "Informe a data de vencimento.";
    setErr(e);
    if (Object.values(e).some(Boolean)) return;
    const a: Activity = {
      id: initial?.id ?? crypto.randomUUID(), clientName: f.client.trim(), serviceId: f.serviceId || null, title: f.title.trim(),
      valueCents: value ?? 0, dueOn: f.due, notes: f.notes.trim(), status: f.status, createdAt: initial?.createdAt ?? new Date().toISOString(),
    };
    setBusy(true);
    try {
      await repo.saveActivity(a);
      toast(initial ? "Atividade salva" : "Atividade criada");
      onSaved(a);
    } catch (x) { setErr({ form: x instanceof Error ? x.message : "Não foi possível salvar." }); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!initial) return;
    setBusy(true);
    try { await repo.deleteActivity(initial.id); toast("Atividade excluída"); onDeleted(initial.id); }
    catch (x) { setErr({ form: x instanceof Error ? x.message : "Não foi possível excluir." }); }
    finally { setBusy(false); }
  }

  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-bold">{initial ? "Editar Atividade" : "Criar Nova Atividade"}</h2>}>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate className="flex flex-col gap-4">
        <Field label="Cliente *" htmlFor="act-client" error={err.client}>
          <Input id="act-client" list="act-clients" autoFocus maxLength={120} placeholder="Selecione ou digite o cliente" autoComplete="off"
            value={f.client} onChange={(e) => set("client")(e.target.value)} aria-invalid={!!err.client || undefined} />
          <datalist id="act-clients">{clients.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Serviço cadastrado (opcional)" htmlFor="act-service" hint={services && services.length === 0 ? "Nenhum serviço cadastrado ainda" : "Preenche o serviço e o valor"}>
          <select id="act-service" value={f.serviceId} onChange={(e) => pickService(e.target.value)} className={inputClass}>
            <option value="">Nenhum</option>
            {activeServices.map((s) => <option key={s.id} value={s.id}>{s.name} · {formatBRL(s.priceCents)}</option>)}
          </select>
        </Field>
        <Field label="Serviço / Projeto *" htmlFor="act-title" error={err.title}>
          <Input id="act-title" maxLength={200} placeholder="Descrição do serviço" value={f.title} onChange={(e) => set("title")(e.target.value)} aria-invalid={!!err.title || undefined} />
        </Field>
        <div className="flex flex-col gap-4">
          <Field label="Valor *" htmlFor="act-value" error={err.value}>
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">R$</span>
              <Input id="act-value" inputMode="decimal" placeholder="0,00" className="num pl-10" value={f.value}
                onChange={(e) => set("value")(e.target.value.replace(/[^\d,.]/g, ""))} aria-invalid={!!err.value || undefined} />
            </div>
          </Field>
          <Field label="Data de vencimento *" htmlFor="act-due" error={err.due}>
            <Input id="act-due" type="date" value={f.due} onChange={(e) => set("due")(e.target.value)} aria-invalid={!!err.due || undefined} />
          </Field>
        </div>
        {initial && (
          <Field label="Status" htmlFor="act-st">
            <select id="act-st" value={f.status} onChange={(e) => set("status")(e.target.value)} className={inputClass}>
              {ACTIVITY_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
        )}
        <Field label="Observações" htmlFor="act-notes">
          <textarea id="act-notes" rows={3} maxLength={2000} placeholder="Detalhes adicionais..." value={f.notes} onChange={(e) => set("notes")(e.target.value)} className={`${inputClass} !h-auto py-2`} />
        </Field>
        {err.form && <p role="alert" className="text-sm text-danger">{err.form}</p>}
        <Button type="submit" size="lg" loading={busy} className="w-full rounded-pill">{initial ? "Salvar alterações" : "Criar Atividade"}</Button>
        {initial && (
          <div className="flex justify-center">
            {confirmDelete ? (
              <span className="flex items-center gap-2">
                <Button type="button" variant="danger" size="sm" loading={busy} onClick={() => void remove()}>Confirmar exclusão</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Não</Button>
              </span>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="text-danger"><Trash2 aria-hidden className="size-4" />Excluir atividade</Button>
            )}
          </div>
        )}
      </form>
    </Dialog>
  );
}
