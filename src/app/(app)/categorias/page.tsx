"use client";

import { useState } from "react";
import { ChevronRight, Plus, Tags } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { CategoryForm, CategoryKindPicker } from "@/components/CategoryModal";
import { useShell } from "@/components/AppShell";
import { Card, EmptyState, PageTitle, ProgressBar, Skeleton } from "@/components/ui";
import { useSnapshot } from "@/lib/data";
import { categoryFits } from "@/lib/categories";
import { formatBRL } from "@/lib/money";
import { monthTransactions } from "@/lib/summary";
import type { Category, CategoryKind } from "@/lib/types";

type Side = "expense" | "income";

export default function Categorias() {
  const snap = useSnapshot();
  const { month, toast } = useShell();
  const [side, setSide] = useState<Side>("expense");
  const [picking, setPicking] = useState(false);
  const [form, setForm] = useState<null | { kind: CategoryKind; category?: Category }>(null);

  if (!snap) return <Skeleton className="h-64" />;

  // Quanto saiu (despesas) ou entrou (receitas) em cada categoria no mês.
  const used = new Map<string, number>();
  for (const t of monthTransactions(snap, month)) {
    if (t.kind === side && t.categoryId) used.set(t.categoryId, (used.get(t.categoryId) ?? 0) + t.amountCents);
  }
  const list = snap.categories.filter((c) => !c.archived && categoryFits(c, side)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const income = side === "income";

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Categorias</PageTitle>
      <button type="button" onClick={() => setPicking(true)}
        className="flex h-11 items-center justify-center gap-2 rounded-md bg-accent font-semibold text-on-accent hover:opacity-90">
        <Plus aria-hidden className="size-5" />Adicionar Categoria
      </button>
      <div role="tablist" aria-label="Categorias" className="grid grid-cols-2 gap-2">
        {([["expense", "Despesas"], ["income", "Receitas"]] as const).map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={side === v} onClick={() => setSide(v)}
            className="h-10 rounded-md border border-border bg-surface-raised text-sm font-semibold text-text-muted aria-selected:border-accent aria-selected:bg-accent aria-selected:text-on-accent">
            {l}
          </button>
        ))}
      </div>
      <Card>
        {list.length ? (
          <ul>
            {list.map((c) => {
              const v = used.get(c.id) ?? 0;
              const over = !income && !!c.monthlyLimitCents && v > c.monthlyLimitCents;
              return (
                <li key={c.id} className="border-b border-border last:border-0">
                  <button type="button" onClick={() => setForm({ kind: c.kind, category: c })} aria-label={`Editar ${c.name}`}
                    className="flex w-full items-center gap-3 py-3 text-left hover:bg-surface">
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
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-text-muted" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : <EmptyState icon={Tags} title={income ? "Nenhuma categoria de receita." : "Nenhuma categoria de despesa."} />}
      </Card>

      {picking && <CategoryKindPicker onClose={() => setPicking(false)} onPick={(kind) => { setPicking(false); setForm({ kind }); }} />}
      {form && <CategoryForm category={form.category} initialKind={form.kind} existing={snap.categories} onClose={() => setForm(null)} onSaved={toast} />}
    </div>
  );
}
