"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, LayoutGrid, List, Pencil, Plus, Tags } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { CategoryForm, CategoryKindPicker } from "@/components/CategoryModal";
import { useShell } from "@/components/AppShell";
import { Card, EmptyState, PageTitle, ProgressBar, Skeleton } from "@/components/ui";
import { useSnapshot } from "@/lib/data";
import { categoryFits, subcategoriesOf } from "@/lib/categories";
import { formatBRL } from "@/lib/money";
import { monthTransactions } from "@/lib/summary";
import type { Category, CategoryKind } from "@/lib/types";

type Side = "expense" | "income";
type FormState = { kind: CategoryKind; category?: Category; parent?: Category };

const plural = (n: number) => `${n} ${n === 1 ? "subcategoria" : "subcategorias"}`;

export default function Categorias() {
  const snap = useSnapshot();
  const { month, toast } = useShell();
  const [side, setSide] = useState<Side>("expense");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);

  if (!snap) return <Skeleton className="h-64" />;

  // Quanto saiu (despesas) ou entrou (receitas) em cada categoria no mês.
  const used = new Map<string, number>();
  for (const t of monthTransactions(snap, month)) {
    if (t.kind === side && t.categoryId) used.set(t.categoryId, (used.get(t.categoryId) ?? 0) + t.amountCents);
  }
  const subsOf = (c: Category) => subcategoriesOf(snap.categories, c.id);
  // A categoria soma os lançamentos dela e os das subcategorias.
  const total = (c: Category) => (used.get(c.id) ?? 0) + subsOf(c).reduce((s, x) => s + (used.get(x.id) ?? 0), 0);
  const ids = new Set(snap.categories.map((c) => c.id));
  const list = snap.categories
    .filter((c) => !c.archived && categoryFits(c, side) && (!c.parentId || !ids.has(c.parentId)))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const income = side === "income";
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const edit = (c: Category, parent?: Category) => setForm({ kind: c.kind, category: c, parent });
  const addSub = (parent: Category) => setForm({ kind: parent.kind, parent });

  function subList(parent: Category) {
    const subs = subsOf(parent);
    if (!subs.length) return <p className="py-2 text-sm text-text-muted">Nenhuma subcategoria ainda.</p>;
    return (
      <ul className="flex flex-col">
        {subs.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => edit(s, parent)} aria-label={`Editar ${s.name}`}
              className="flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-left text-sm hover:bg-surface">
              <CategoryIcon name={s.icon} color={s.color} className="size-7" />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="num shrink-0 text-text-muted">{formatBRL(used.get(s.id) ?? 0)}</span>
              <Pencil aria-hidden className="size-3.5 shrink-0 text-text-muted" />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Categorias</PageTitle>
      <button type="button" onClick={() => setPicking(true)}
        className="flex h-11 items-center justify-center gap-2 rounded-md bg-accent font-semibold text-on-accent hover:opacity-90">
        <Plus aria-hidden className="size-5" />Adicionar Categoria
      </button>
      <div className="flex gap-2">
        <div role="tablist" aria-label="Categorias" className="grid flex-1 grid-cols-2 gap-2">
          {([["expense", "Despesas"], ["income", "Receitas"]] as const).map(([v, l]) => (
            <button key={v} type="button" role="tab" aria-selected={side === v} onClick={() => setSide(v)}
              className="h-10 rounded-md border border-border bg-surface-raised text-sm font-semibold text-text-muted aria-selected:border-accent aria-selected:bg-accent aria-selected:text-on-accent">
              {l}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Visualização" className="flex gap-1 rounded-md border border-border bg-surface-raised p-1">
          {([["grid", "Cartões", LayoutGrid], ["list", "Lista", List]] as const).map(([v, l, Icon]) => (
            <button key={v} type="button" role="radio" aria-checked={view === v} aria-label={l} title={l} onClick={() => setView(v)}
              className="grid size-8 place-items-center rounded text-text-muted aria-checked:bg-accent-soft aria-checked:text-accent">
              <Icon aria-hidden className="size-4" />
            </button>
          ))}
        </div>
      </div>

      {!list.length ? (
        <Card><EmptyState icon={Tags} title={income ? "Nenhuma categoria de receita." : "Nenhuma categoria de despesa."} /></Card>
      ) : view === "grid" ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const v = total(c);
            const n = subsOf(c).length;
            const over = !income && !!c.monthlyLimitCents && v > c.monthlyLimitCents;
            const expanded = open.has(c.id);
            return (
              <li key={c.id} className="overflow-hidden rounded-lg border border-border bg-surface-raised shadow-card">
                <div className={`relative grid h-24 place-items-center ${c.color ? "" : "bg-accent-soft"}`}
                  style={c.color ? { background: `${c.color}2e` } : undefined}>
                  <CategoryIcon name={c.icon} color={c.color ?? "#0b7a5e"} className="size-14 shadow-card [&_svg]:size-7" />
                  <button type="button" onClick={() => edit(c)} aria-label={`Editar ${c.name}`} title="Editar"
                    className="absolute right-2 top-2 grid size-8 place-items-center rounded-pill bg-surface-raised/90 text-text-muted shadow-card hover:text-text">
                    <Pencil aria-hidden className="size-4" />
                  </button>
                </div>
                <div className="flex flex-col gap-3 p-4">
                  <div className="flex items-center gap-2.5">
                    <CategoryIcon name={c.icon} color={c.color} className="size-8" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c.name}{c.kind === "both" && <span className="ml-2 rounded-pill bg-surface px-2 py-0.5 text-xs font-normal text-text-muted">Ambos</span>}</p>
                      <button type="button" onClick={() => toggle(c.id)} aria-expanded={expanded}
                        className="flex items-center gap-1 text-xs text-text-muted hover:text-text">
                        {plural(n)}{expanded ? <ChevronDown aria-hidden className="size-3.5" /> : <ChevronRight aria-hidden className="size-3.5" />}
                      </button>
                    </div>
                  </div>
                  {expanded && <div className="border-y border-border py-1">{subList(c)}</div>}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-surface p-2.5">
                      <p className="text-xs text-text-muted">{income ? "Meta" : "Limite"}</p>
                      <p className="num truncate font-semibold">{c.monthlyLimitCents ? formatBRL(c.monthlyLimitCents) : income ? "Sem meta" : "Sem limite"}</p>
                    </div>
                    <div className="rounded-md bg-surface p-2.5">
                      <p className="text-xs text-text-muted">{income ? "Recebido" : "Gasto"}</p>
                      <p className={`num truncate font-semibold ${over ? "text-expense" : income ? "text-income" : ""}`}>{formatBRL(v)}</p>
                    </div>
                  </div>
                  {!!c.monthlyLimitCents && <ProgressBar ratio={v / c.monthlyLimitCents} label={`${income ? "Meta" : "Limite"} de ${c.name}`} />}
                  <button type="button" onClick={() => addSub(c)}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-sm font-medium text-text-muted hover:border-accent hover:text-accent">
                    <Plus aria-hidden className="size-4" />Adicionar subcategoria
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <ul>
            {list.map((c) => {
              const v = total(c);
              const n = subsOf(c).length;
              const over = !income && !!c.monthlyLimitCents && v > c.monthlyLimitCents;
              const expanded = open.has(c.id);
              return (
                <li key={c.id} className="border-b border-border last:border-0">
                  <div className="flex items-center gap-3 py-3">
                    <button type="button" onClick={() => edit(c)} aria-label={`Editar ${c.name}`}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <CategoryIcon name={c.icon} color={c.color} />
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-2">
                          <span className="truncate font-medium">{c.name}{c.kind === "both" && <span className="ml-2 rounded-pill bg-surface px-2 py-0.5 text-xs text-text-muted">Ambos</span>}</span>
                          <span className={`num shrink-0 ${over ? "text-expense" : ""}`}>
                            {formatBRL(v)}{c.monthlyLimitCents ? ` de ${formatBRL(c.monthlyLimitCents)}` : ""}
                          </span>
                        </div>
                        {c.monthlyLimitCents ? <ProgressBar ratio={v / c.monthlyLimitCents} label={`${income ? "Meta" : "Limite"} de ${c.name}`} />
                          : <p className="text-xs text-text-muted">{income ? "Sem meta" : "Sem limite"}</p>}
                      </div>
                    </button>
                    <button type="button" onClick={() => toggle(c.id)} aria-expanded={expanded} aria-label={`${plural(n)} de ${c.name}`}
                      className="flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-xs text-text-muted hover:bg-surface">
                      {n}{expanded ? <ChevronDown aria-hidden className="size-4" /> : <ChevronRight aria-hidden className="size-4" />}
                    </button>
                  </div>
                  {expanded && (
                    <div className="mb-3 ml-12 flex flex-col gap-1">
                      {subList(c)}
                      <button type="button" onClick={() => addSub(c)}
                        className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-sm text-text-muted hover:border-accent hover:text-accent">
                        <Plus aria-hidden className="size-4" />Adicionar subcategoria
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {picking && <CategoryKindPicker onClose={() => setPicking(false)} onPick={(kind) => { setPicking(false); setForm({ kind }); }} />}
      {form && <CategoryForm category={form.category} parent={form.parent} initialKind={form.kind} existing={snap.categories} onClose={() => setForm(null)} onSaved={toast} />}
    </div>
  );
}
