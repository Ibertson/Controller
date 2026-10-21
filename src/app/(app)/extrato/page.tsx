"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, FileDown, FileSpreadsheet, Filter, Info, Search, Trash2, Wallet, X } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { BulkDeleteModal, TrashModal, download, printHtml } from "@/components/QuickActions";
import { TransactionList } from "@/components/TransactionList";
import { Card, Skeleton, inputClass } from "@/components/ui";
import { useSession, useSnapshot } from "@/lib/data";
import { daysInMonth, monthOf, today } from "@/lib/dates";
import { activeFilterCount, emptyFilters, filterStatement, statementTotals, type ExtratoFilters, type ExtratoKind } from "@/lib/extrato";
import { formatBRL, parseBRL } from "@/lib/money";
import { dataSheet, reportHtml } from "@/lib/report";
import { totalBalance } from "@/lib/summary";
import { writeXlsx } from "@/lib/xlsx";

const monthRange = (month: string) => ({ from: month, to: month.slice(0, 8) + String(daysInMonth(month)).padStart(2, "0") });
const brDate = (d: string) => d.split("-").reverse().join("/");
const rangeTitle = (from: string, to: string) =>
  !from && !to ? "Todo o período" : `${from ? brDate(from) : "início"} a ${to ? brDate(to) : "hoje"}`;

const pill = "inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface-raised px-3.5 text-sm font-semibold hover:bg-surface";
const label = "mb-1 block text-xs font-semibold text-text-muted";

export default function Extrato() {
  const snap = useSnapshot();
  const session = useSession();
  const router = useRouter();
  const { month, setMonth, toast } = useShell();
  const [filters, setF] = useState<ExtratoFilters>(() => emptyFilters("", ""));
  // Sem período escolhido à mão (null), o extrato acompanha o mês do topo.
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [tool, setTool] = useState<null | "trash" | "bulk">(null);
  const periodRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!periodOpen) return;
    const away = (e: MouseEvent) => { if (!periodRef.current?.contains(e.target as Node)) setPeriodOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPeriodOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [periodOpen]);

  if (!snap) return <Skeleton className="h-64" />;

  const set = (patch: Partial<ExtratoFilters>) => setF((x) => ({ ...x, ...patch }));
  const f: ExtratoFilters = { ...filters, ...(custom ?? monthRange(month)) };
  const setDates = (patch: { from?: string; to?: string }) => setCustom({ from: f.from, to: f.to, ...patch });
  const selfName = session?.name ?? "Você";
  const items = filterStatement(snap, f);
  const totals = statementTotals(items);
  const title = rangeTitle(f.from, f.to);
  const people = [{ id: "", name: selfName }, ...snap.people.filter((p) => !p.archived)];
  const sources = f.tab === "cartao" ? snap.cards.filter((c) => !c.archived) : snap.accounts.filter((a) => !a.archived);
  const categories = [...snap.categories].filter((c) => !c.archived).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const fileBase = `extrato-${f.from || "inicio"}-a-${f.to || "hoje"}`;

  function clearFilters() {
    setF((x) => ({ ...emptyFilters("", ""), tab: x.tab }));
    setMin(""); setMax("");
  }

  const cards = [
    { label: "Total de Despesas", value: totals.expense, tone: "text-expense" },
    { label: "Total de Receitas", value: totals.income, tone: "text-income" },
    { label: "Saldo do Mês", value: totals.net, tone: totals.net < 0 ? "text-expense" : "text-income", info: "Receitas menos despesas do período e dos filtros escolhidos." },
    { label: "Saldo Total", value: totalBalance(snap), tone: totalBalance(snap) < 0 ? "text-expense" : "text-income", icon: Wallet, info: "Soma do saldo atual de todas as contas." },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">Extrato</h1>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => router.back()} className={pill}><ArrowLeft aria-hidden className="size-4" />Voltar</button>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setTool("trash")} className={pill}>
            <Trash2 aria-hidden className="size-4" />Lixeira{snap.trash?.length ? ` (${snap.trash.length})` : ""}
          </button>
          <button type="button" onClick={() => setTool("bulk")} className={`${pill} border-danger/40 bg-danger-soft text-expense`}>
            <Trash2 aria-hidden className="size-4" />Excluir em Massa
          </button>
          <button type="button" disabled={!items.length} className={`${pill} disabled:opacity-50`} onClick={() => {
            printHtml(reportHtml(snap, items, selfName, title));
            toast("Escolha “Salvar como PDF” na janela de impressão");
          }}><FileDown aria-hidden className="size-4" />Exportar PDF</button>
          <button type="button" disabled={!items.length} className={`${pill} disabled:opacity-50`} onClick={() => {
            download(writeXlsx(dataSheet(snap, items, selfName)), `${fileBase}.xlsx`);
            toast("Planilha exportada");
          }}><FileSpreadsheet aria-hidden className="size-4" />Exportar Excel</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <h2 className="flex items-center gap-1.5 text-sm text-text-muted">
              {c.icon && <c.icon aria-hidden className="size-4" />}{c.label}
              {c.info && <span title={c.info} aria-label={c.info} className="inline-flex"><Info aria-hidden className="size-3.5" /></span>}
            </h2>
            <div className={`num mt-2 whitespace-nowrap text-lg font-bold sm:text-2xl ${c.tone}`}>{formatBRL(c.value)}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold">Extrato</h2>
            <div role="radiogroup" aria-label="Tipo de extrato" className="flex gap-1 rounded-pill bg-surface p-1">
              {([["geral", "Geral"], ["cartao", "Cartão"]] as const).map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={f.tab === v} onClick={() => set({ tab: v, sourceId: "" })}
                  className="h-8 rounded-pill px-3 text-sm font-semibold text-text-muted aria-checked:bg-surface-raised aria-checked:text-text aria-checked:shadow-card">
                  {l}
                </button>
              ))}
            </div>
            <span className="text-sm text-text-muted">{title}</span>
          </div>
          <div className="flex gap-2">
            <button type="button" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)} className={`${pill} aria-expanded:bg-surface`}>
              <Filter aria-hidden className="size-4" />Filtros
              {activeFilterCount(f) > 0 && <span className="grid size-5 place-items-center rounded-pill bg-accent text-[11px] text-on-accent">{activeFilterCount(f)}</span>}
            </button>
            <div ref={periodRef} className="relative">
              <button type="button" aria-expanded={periodOpen} aria-haspopup="dialog" onClick={() => setPeriodOpen((v) => !v)}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent hover:opacity-90">
                Período<ChevronDown aria-hidden className="size-4" />
              </button>
              {periodOpen && (
                <div role="dialog" aria-label="Período" className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-border bg-surface-raised p-4 shadow-card">
                  <label htmlFor="ext-from" className={label}>Data Inicial</label>
                  <div className="mb-3">
                    <input id="ext-from" type="date" className={inputClass} value={f.from} max={f.to || undefined} onChange={(e) => setDates({ from: e.target.value })} />
                  </div>
                  <label htmlFor="ext-to" className={label}>Data Final</label>
                  <div className="mb-4">
                    <input id="ext-to" type="date" className={inputClass} value={f.to} min={f.from || undefined} onChange={(e) => setDates({ to: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" className={`${pill} justify-center`} onClick={() => setDates({ from: "", to: "" })}>Limpar</button>
                    <button type="button" className="h-10 rounded-md bg-accent text-sm font-semibold text-on-accent hover:opacity-90" onClick={() => {
                      const now = monthOf(today());
                      setMonth(now);
                      setCustom(null);
                      setPeriodOpen(false);
                    }}>Mês Atual</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 rounded-md bg-surface p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label htmlFor="ext-q" className={label}>Buscar</label>
                <div className="relative">
                  <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
                  <input id="ext-q" type="search" placeholder="Descrição..." className={`${inputClass} pl-9`} value={f.search} onChange={(e) => set({ search: e.target.value })} />
                </div>
              </div>
              <div>
                <label htmlFor="ext-cat" className={label}>Categoria</label>
                <select id="ext-cat" className={inputClass} value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
                  <option value="">Todas</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ext-kind" className={label}>Tipo</label>
                <select id="ext-kind" className={inputClass} value={f.kind} onChange={(e) => set({ kind: e.target.value as ExtratoKind })}>
                  <option value="all">Todos</option><option value="income">Receitas</option>
                  <option value="expense">Despesas</option><option value="transfer">Transferências</option>
                </select>
              </div>
              <div>
                <label htmlFor="ext-person" className={label}>Pessoa</label>
                <select id="ext-person" className={inputClass} value={f.personId ?? "*"} onChange={(e) => set({ personId: e.target.value === "*" ? null : e.target.value })}>
                  <option value="*">Todas</option>
                  {people.map((p) => <option key={p.id || "me"} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ext-src" className={label}>{f.tab === "cartao" ? "Cartão" : "Conta"}</label>
                <select id="ext-src" className={inputClass} value={f.sourceId} onChange={(e) => set({ sourceId: e.target.value })}>
                  <option value="">Todos</option>
                  {sources.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ext-benefit" className={label}>Benefício</label>
                <select id="ext-benefit" className={inputClass} disabled title="Benefícios ainda não existem no Sobra"><option>Todos</option></select>
              </div>
              <div>
                <label htmlFor="ext-min" className={label}>Valor Mín.</label>
                <input id="ext-min" inputMode="decimal" placeholder="R$ 0,00" className={`${inputClass} num`} value={min}
                  onChange={(e) => { setMin(e.target.value); set({ minCents: e.target.value.trim() ? parseBRL(e.target.value) : null }); }} />
              </div>
              <div>
                <label htmlFor="ext-max" className={label}>Valor Máx.</label>
                <input id="ext-max" inputMode="decimal" placeholder="R$ 0,00" className={`${inputClass} num`} value={max}
                  onChange={(e) => { setMax(e.target.value); set({ maxCents: e.target.value.trim() ? parseBRL(e.target.value) : null }); }} />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-text">
                <X aria-hidden className="size-4" />Limpar filtros
              </button>
            </div>
          </div>
        )}

        <div className="mt-4">
          {items.length ? <TransactionList snap={snap} items={items} onDeleted={toast} />
            : <p className="py-12 text-center text-text-muted">Nenhuma transação encontrada</p>}
        </div>
      </Card>

      {tool === "trash" && <TrashModal snap={snap} onClose={() => setTool(null)} onDone={toast} />}
      {tool === "bulk" && <BulkDeleteModal snap={snap} month={month} onClose={() => setTool(null)}
        onDone={(msg, undo) => toast(msg, undo ? { label: "Desfazer", run: undo } : undefined)} />}
    </div>
  );
}
