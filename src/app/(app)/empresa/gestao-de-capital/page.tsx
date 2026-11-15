"use client";

import { createElement, useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, Banknote, Building2, Calculator, Clock, FileText, Package, Pencil, PiggyBank, Plus, ReceiptText,
  Shuffle, ShoppingCart, Trash2, TrendingUp, Wallet, type LucideIcon,
} from "lucide-react";
import { useShell } from "@/components/AppShell";
import { useSpace } from "@/components/business";
import { Dialog } from "@/components/Dialog";
import { Button, Card, Field, Input, Segmented, Skeleton, Switch, inputClass } from "@/components/ui";
import { CAPITAL_COLORS, CAPITAL_ICONS, MOVE_LABEL, allocated, available, balance, colorHex, distribute, distributedIn, monthDistribution, validateCategory } from "@/lib/capital";
import { repo, useSnapshot } from "@/lib/data";
import { today } from "@/lib/dates";
import { formatBRL, parseBRL } from "@/lib/money";
import { monthTotals } from "@/lib/summary";
import type { CapitalCategory, CapitalMove, Company } from "@/lib/types";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const ICONS: Record<string, LucideIcon> = {
  carteira: Wallet, estoque: ShoppingCart, lucro: TrendingUp, impostos: ReceiptText, contador: Calculator,
  dinheiro: Banknote, reserva: PiggyBank, empresa: Building2, produto: Package,
};
/** Ícone de uma categoria de capital. */
function CapIcon({ id, className }: { id: string; className?: string }) {
  return createElement(ICONS[id] ?? Wallet, { "aria-hidden": true, className });
}
const pctText = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const br = (day: string) => day.split("-").reverse().join("/");
const monthName = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1].toLowerCase();

/** Movimentos de capital (recarrega ao trocar de espaço). */
function useMoves() {
  const wsId = useSnapshot()?.workspace.id;
  const [state, setState] = useState<{ ws?: string; list?: CapitalMove[]; error?: string }>({});
  useEffect(() => {
    if (!wsId) return;
    let alive = true;
    repo.listCapitalMoves()
      .then((list) => { if (alive) setState({ ws: wsId, list }); })
      .catch((e) => { if (alive) setState({ ws: wsId, list: [], error: e instanceof Error ? e.message : "Não foi possível carregar." }); });
    return () => { alive = false; };
  }, [wsId]);
  const ready = state.ws === wsId ? state : {};
  return { list: ready.list, error: ready.error, setList: (list: CapitalMove[]) => setState({ ws: wsId, list }) };
}

/** Gestão de Capital: reparte o faturamento do mês entre categorias de destinação (estoque, impostos, lucro...). */
export default function GestaoDeCapital() {
  const { kind, company } = useSpace();
  const snap = useSnapshot();
  const { toast } = useShell();
  const { list: moves, error, setList } = useMoves();
  const now = today();
  const [month, setMonth] = useState(now.slice(0, 7));
  const [editing, setEditing] = useState<CapitalCategory | "new" | null>(null);
  const [moving, setMoving] = useState<CapitalCategory | null>(null);
  const [removing, setRemoving] = useState<CapitalCategory | null>(null);
  const [busy, setBusy] = useState(false);
  const chips = useRef<HTMLElement>(null);
  useEffect(() => { chips.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "nearest", inline: "center" }); }, [kind]);

  if (kind !== "business" || !company) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 aria-hidden className="size-9 text-text-muted" />
        <h1 className="font-semibold">Gestão de Capital faz parte do Painel Empresarial</h1>
        <p className="max-w-md text-sm text-text-muted">Abra a aba Empresarial no topo da tela para organizar a destinação do seu faturamento.</p>
      </Card>
    );
  }
  if (!snap || !moves) return <div className="flex flex-col gap-4"><Skeleton className="h-20" /><Skeleton className="h-28" /><Skeleton className="h-64" /></div>;

  const cats = company.details?.capitalCategories ?? [];
  const capital = monthTotals(snap, `${month}-01`).incomeCents;
  const used = allocated(cats);
  const free = available(cats);
  const active = cats.filter((c) => c.active);
  const parts = new Map(distribute(cats, capital).map((p) => [p.id, p.cents]));
  const done = distributedIn(moves, month);
  const monthMoves = moves.filter((m) => m.month === month).sort((a, b) => b.movedOn.localeCompare(a.movedOn) || b.createdAt.localeCompare(a.createdAt));
  const future = month > now.slice(0, 7);

  async function saveCats(next: CapitalCategory[]) {
    await repo.updateCompany({ ...(company as Company), details: { ...company!.details, capitalCategories: next } });
  }

  async function distributeMonth() {
    setBusy(true);
    try {
      const day = month === now.slice(0, 7) ? now : `${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, "0")}`;
      const r = monthDistribution(cats, moves!, month, capital, day, () => crypto.randomUUID(), new Date().toISOString());
      await repo.saveCapitalMoves(r.save, r.remove);
      setList([...moves!.filter((m) => !r.remove.includes(m.id)), ...r.save]);
      toast(r.remove.length ? "Distribuição refeita" : "Faturamento distribuído");
    } catch (e) { toast(e instanceof Error ? e.message : "Não foi possível distribuir."); }
    finally { setBusy(false); }
  }

  async function removeCat(c: CapitalCategory) {
    setBusy(true);
    try { await saveCats(cats.filter((x) => x.id !== c.id)); toast("Categoria excluída"); setRemoving(null); }
    catch (e) { toast(e instanceof Error ? e.message : "Não foi possível excluir."); }
    finally { setBusy(false); }
  }

  async function removeMove(m: CapitalMove) {
    try { await repo.saveCapitalMoves([], [m.id]); setList(moves!.filter((x) => x.id !== m.id)); toast("Movimentação excluída"); }
    catch (e) { toast(e instanceof Error ? e.message : "Não foi possível excluir."); }
  }

  return (
    <div className="flex flex-col gap-4">
      <nav ref={chips} aria-label="Mês" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {MONTHS.map((m, i) => {
          const key = `${now.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button key={key} type="button" aria-pressed={month === key} onClick={() => setMonth(key)}
              className="h-9 shrink-0 rounded-md border border-border px-4 text-sm hover:bg-surface aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent">{m}</button>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Wallet aria-hidden className="size-6 text-accent" />Gestão de Capital</h1>
          <p className="text-sm text-text-muted">Organize e distribua automaticamente seu faturamento</p>
        </div>
        <Button onClick={() => setEditing("new")}><Plus aria-hidden className="size-4" />Nova Categoria</Button>
      </div>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-accent-soft text-accent"><Banknote aria-hidden className="size-5" /></span>
          <div><p className="text-sm text-text-muted">Capital Total</p><p className="num text-xl font-bold">{formatBRL(capital)}</p><p className="text-xs text-text-muted">Faturamento de {monthName(month)}</p></div>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-income-soft text-income"><TrendingUp aria-hidden className="size-5" /></span>
          <div><p className="text-sm text-text-muted">Categorias Ativas</p><p className="num text-xl font-bold">{active.length}</p></div>
        </Card>
        <Card className="flex flex-col justify-center gap-2">
          <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Alocação</span><span className="flex items-center gap-1 text-xs font-semibold"><Clock aria-hidden className="size-3.5" />{pctText(used)}</span></div>
          <div className="h-2 overflow-hidden rounded-pill bg-surface" role="progressbar" aria-label="Capital alocado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={used}>
            <div className="h-full bg-accent" style={{ width: `${Math.min(100, used)}%` }} />
          </div>
          <p className="text-xs text-text-muted">{pctText(free)} disponível para alocar</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <section aria-labelledby="gc-cats" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="gc-cats" className="text-lg font-semibold">Categorias de Destinação</h2>
            {active.length > 0 && !future && (
              <Button variant="secondary" onClick={distributeMonth} loading={busy} disabled={busy || capital <= 0}>
                <Shuffle aria-hidden className="size-4" />{done != null ? "Redistribuir" : "Distribuir"} {monthName(month)}
              </Button>
            )}
          </div>
          {active.length > 0 && !future && (
            <p className="text-xs text-text-muted">
              {capital <= 0 ? `Sem faturamento em ${monthName(month)} para distribuir.`
                : done != null ? `${formatBRL(done)} já distribuído em ${monthName(month)}. Redistribuir troca pelos percentuais de agora.`
                  : `Distribuir guarda no histórico quanto de ${formatBRL(capital)} vai para cada categoria e soma no saldo delas.`}
            </p>
          )}
          {cats.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 py-10 text-center">
              <Wallet aria-hidden className="size-9 text-text-muted" />
              <p className="font-semibold">Nenhuma categoria cadastrada</p>
              <p className="text-sm text-text-muted">Crie categorias para organizar a destinação do seu capital</p>
              <Button variant="secondary" onClick={() => setEditing("new")} className="mt-2"><Plus aria-hidden className="size-4" />Criar Primeira Categoria</Button>
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {cats.map((c) => {
                const hex = colorHex(c.color);
                return (
                  <li key={c.id}>
                    <Card className={`flex h-full flex-col gap-3 ${c.active ? "" : "opacity-60"}`}>
                      <div className="flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-md text-white" style={{ background: hex }}><CapIcon id={c.icon} className="size-5" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{c.name}</p>
                          <p className="text-xs text-text-muted">{pctText(c.pct)} do faturamento{!c.active && " · Inativa"}</p>
                        </div>
                        <button type="button" onClick={() => setEditing(c)} aria-label={`Editar ${c.name}`} className="rounded-sm p-1.5 text-text-muted hover:bg-surface"><Pencil className="size-4" /></button>
                        <button type="button" onClick={() => setRemoving(c)} aria-label={`Excluir ${c.name}`} className="rounded-sm p-1.5 text-text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
                      </div>
                      {c.description && <p className="text-sm text-text-muted">{c.description}</p>}
                      <dl className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-md bg-surface px-3 py-2"><dt className="text-xs text-text-muted">Em {monthName(month)}</dt><dd className="num font-semibold">{formatBRL(parts.get(c.id) ?? 0)}</dd></div>
                        <div className="rounded-md bg-surface px-3 py-2"><dt className="text-xs text-text-muted">Saldo</dt><dd className={`num font-semibold ${balance(moves, c.id) < 0 ? "text-danger" : ""}`}>{formatBRL(balance(moves, c.id))}</dd></div>
                      </dl>
                      <button type="button" onClick={() => setMoving(c)} className="self-start text-sm font-semibold text-accent hover:underline">Registrar uso ou aporte</button>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Card className="flex flex-col gap-4 self-start">
          <h2 className="font-semibold">Distribuição do Capital</h2>
          <CapitalDonut cats={active} free={free} />
          <div className="border-t border-border pt-3 text-center">
            <p className="text-sm text-text-muted">Capital Total</p>
            <p className="num text-2xl font-bold text-accent">{formatBRL(capital)}</p>
          </div>
        </Card>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-semibold"><FileText aria-hidden className="size-4" />Histórico de Movimentações</h2>
        {monthMoves.length === 0 ? <p className="py-6 text-center text-sm text-text-muted">Nenhuma movimentação registrada em {monthName(month)}</p> : (
          <ul className="flex flex-col divide-y divide-border">
            {monthMoves.map((m) => {
              const out = m.kind === "uso";
              const c = cats.find((x) => x.id === m.categoryId);
              return (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-pill ${out ? "bg-danger-soft text-danger" : "bg-income-soft text-income"}`}>
                    {out ? <ArrowUpRight aria-hidden className="size-4" /> : <ArrowDownLeft aria-hidden className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium">
                      {c && <span aria-hidden className="size-2.5 shrink-0 rounded-pill" style={{ background: colorHex(c.color) }} />}
                      <span className="truncate">{m.categoryName}</span>
                    </span>
                    <span className="block truncate text-xs text-text-muted">{MOVE_LABEL[m.kind]} · {br(m.movedOn)}{m.note && ` · ${m.note}`}</span>
                  </span>
                  <span className={`num font-semibold ${out ? "text-danger" : "text-income"}`}>{out ? "−" : "+"}{formatBRL(m.amountCents)}</span>
                  {m.kind !== "distribuicao" && (
                    <button type="button" onClick={() => removeMove(m)} aria-label={`Excluir ${MOVE_LABEL[m.kind].toLowerCase()} de ${formatBRL(m.amountCents)} em ${m.categoryName}`}
                      className="rounded-sm p-1.5 text-text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {editing && (
        <CategoryDialog cats={cats} initial={editing === "new" ? null : editing} onClose={() => setEditing(null)}
          onSave={async (c) => {
            await saveCats(cats.some((x) => x.id === c.id) ? cats.map((x) => (x.id === c.id ? c : x)) : [...cats, c]);
            toast(editing === "new" ? "Categoria criada" : "Categoria salva"); setEditing(null);
          }} />
      )}
      {moving && (
        <MoveDialog cat={moving} month={month} now={now} onClose={() => setMoving(null)}
          onSave={async (m) => { await repo.saveCapitalMoves([m]); setList([...moves, m]); toast(m.kind === "uso" ? "Uso registrado" : "Aporte registrado"); setMoving(null); }} />
      )}
      {removing && (
        <Dialog title={`Excluir ${removing.name}?`} onClose={() => setRemoving(null)}>
          <p className="text-sm text-text-muted">A categoria sai da distribuição. As movimentações já registradas continuam no histórico.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemoving(null)}>Cancelar</Button>
            <Button variant="danger" loading={busy} onClick={() => removeCat(removing)}>Excluir</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

/** Rosca com as cores das categorias e o que não foi alocado. */
function CapitalDonut({ cats, free }: { cats: CapitalCategory[]; free: number }) {
  const r = 60, c = 2 * Math.PI * r;
  const lens = cats.map((x) => (x.pct / 100) * c);
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, v) => a + v, 0));
  const rows = [...cats.map((x) => ({ id: x.id, label: x.name, pct: x.pct, hex: colorHex(x.color) })), ...(free > 0 ? [{ id: "free", label: "Não alocado", pct: free, hex: "" }] : [])];
  return (
    <div className="flex flex-col items-center gap-4">
      {cats.length === 0 ? <p className="py-10 text-sm text-text-muted">Nenhuma categoria cadastrada</p> : (
        <svg viewBox="0 0 160 160" role="img" aria-label="Distribuição do capital por categoria" className="size-44 -rotate-90">
          <circle cx={80} cy={80} r={r} fill="none" strokeWidth={24} style={{ stroke: "var(--color-surface)" }} />
          {cats.map((x, i) => (
            <circle key={x.id} cx={80} cy={80} r={r} fill="none" strokeWidth={24} strokeDasharray={`${lens[i]} ${c - lens[i]}`} strokeDashoffset={-starts[i]} style={{ stroke: colorHex(x.color) }} />
          ))}
        </svg>
      )}
      <ul className="flex w-full flex-col gap-1.5 text-sm">
        {rows.map((x) => (
          <li key={x.id} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-pill bg-border" style={x.hex ? { background: x.hex } : undefined} />
            <span className="min-w-0 flex-1 truncate">{x.label}</span>
            <span className="num text-text-muted">{pctText(x.pct)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryDialog({ cats, initial, onClose, onSave }: { cats: CapitalCategory[]; initial: CapitalCategory | null; onClose: () => void; onSave: (c: CapitalCategory) => Promise<void> }) {
  const [f, setF] = useState({
    name: initial?.name ?? "", pct: initial ? String(initial.pct).replace(".", ",") : "0", icon: initial?.icon ?? "carteira",
    color: initial?.color ?? "azul", description: initial?.description ?? "", active: initial?.active ?? true,
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const id = initial?.id ?? "";
  const free = available(cats, id);

  async function save() {
    const pct = Number(f.pct.replace(",", "."));
    const c: CapitalCategory = {
      id: initial?.id ?? crypto.randomUUID(), name: f.name.trim(), pct: Math.round(pct * 10) / 10, icon: f.icon, color: f.color,
      description: f.description.trim().slice(0, 200), active: f.active, createdAt: initial?.createdAt ?? new Date().toISOString(),
    };
    const e = validateCategory(c, cats);
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try { await onSave(c); } catch (x) { setErr({ form: x instanceof Error ? x.message : "Não foi possível salvar." }); setBusy(false); }
  }

  return (
    <Dialog title={initial ? "Editar Categoria de Capital" : "Nova Categoria de Capital"} onClose={onClose}>
      <p className="-mt-2 mb-4 text-sm text-text-muted">Defina uma categoria para destinação do capital. Disponível: {pctText(free)}</p>
      <div className="flex flex-col gap-4">
        <Field label="Nome da Categoria" htmlFor="gc-name" error={err.name}>
          <Input id="gc-name" autoFocus value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex: Estoque, Lucro, Impostos..." aria-invalid={!!err.name} />
        </Field>
        <Field label="Porcentagem (%)" htmlFor="gc-pct" error={err.pct} hint={`Disponível: ${pctText(free)}`}>
          <Input id="gc-pct" inputMode="decimal" type="number" min={0} max={100} step={0.1} value={f.pct} onChange={(e) => setF({ ...f, pct: e.target.value })} aria-invalid={!!err.pct} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ícone" htmlFor="gc-icon">
            <div className="relative">
              <CapIcon id={f.icon} className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <select id="gc-icon" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} className={`${inputClass} pl-9`}>
                {CAPITAL_ICONS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
              </select>
            </div>
          </Field>
          <Field label="Cor" htmlFor="gc-color">
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 rounded-pill" style={{ background: colorHex(f.color) }} />
              <select id="gc-color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className={`${inputClass} pl-9`}>
                {CAPITAL_COLORS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </Field>
        </div>
        <Field label="Descrição (opcional)" htmlFor="gc-desc">
          <textarea id="gc-desc" value={f.description} maxLength={200} rows={3} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Para que serve esta categoria..." className={`${inputClass} h-auto py-2`} />
        </Field>
        <div className="rounded-md border border-border px-3 py-2">
          <Switch id="gc-active" label="Categoria Ativa" checked={f.active} onChange={(v) => setF({ ...f, active: v })} />
          <p className="text-xs text-text-muted">Categorias inativas não recebem distribuição</p>
        </div>
        {err.form && <p role="alert" className="text-sm text-danger">{err.form}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={busy} disabled={busy}>{initial ? "Salvar" : "Criar"}</Button>
        </div>
      </div>
    </Dialog>
  );
}

function MoveDialog({ cat, month, now, onClose, onSave }: { cat: CapitalCategory; month: string; now: string; onClose: () => void; onSave: (m: CapitalMove) => Promise<void> }) {
  const [moveKind, setMoveKind] = useState<"uso" | "aporte">("uso");
  const [value, setValue] = useState("");
  const [day, setDay] = useState(month === now.slice(0, 7) ? now : `${month}-01`);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    const cents = parseBRL(value);
    const e: Record<string, string> = {};
    if (cents == null || cents <= 0) e.value = "Informe o valor.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) e.day = "Informe a data.";
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await onSave({ id: crypto.randomUUID(), categoryId: cat.id, categoryName: cat.name, kind: moveKind, amountCents: cents!, month: day.slice(0, 7), movedOn: day, note: note.trim().slice(0, 300), createdAt: new Date().toISOString() });
    } catch (x) { setErr({ form: x instanceof Error ? x.message : "Não foi possível salvar." }); setBusy(false); }
  }

  return (
    <Dialog title={`Movimentar ${cat.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Segmented label="Tipo" value={moveKind} onChange={setMoveKind} options={[{ value: "uso", label: "Uso (saída)" }, { value: "aporte", label: "Aporte (entrada)" }]} />
        <p className="-mt-2 text-xs text-text-muted">{moveKind === "uso" ? "Quando você gasta o dinheiro reservado, por exemplo uma compra de estoque." : "Dinheiro extra que você coloca nesta categoria além da distribuição."}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (R$)" htmlFor="gc-mv-value" error={err.value}>
            <Input id="gc-mv-value" autoFocus inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" aria-invalid={!!err.value} />
          </Field>
          <Field label="Data" htmlFor="gc-mv-day" error={err.day}>
            <Input id="gc-mv-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-invalid={!!err.day} />
          </Field>
        </div>
        <Field label="Observação (opcional)" htmlFor="gc-mv-note">
          <Input id="gc-mv-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Ex: compra de mercadorias" />
        </Field>
        {err.form && <p role="alert" className="text-sm text-danger">{err.form}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={busy} disabled={busy}>Registrar</Button>
        </div>
      </div>
    </Dialog>
  );
}
