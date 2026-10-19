"use client";

import { useState } from "react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { useShell } from "@/components/AppShell";
import { Card, PageTitle, ProgressBar, Skeleton, inputClass } from "@/components/ui";
import { repo, useSnapshot } from "@/lib/data";
import { formatBRL, parseBRL } from "@/lib/money";
import { monthTransactions } from "@/lib/summary";

export default function Categorias() {
  const snap = useSnapshot();
  const { month, toast } = useShell();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");

  if (!snap) return <Skeleton className="h-64" />;

  const spent = new Map<string, number>();
  for (const t of monthTransactions(snap, month)) if (t.kind === "expense" && t.categoryId) spent.set(t.categoryId, (spent.get(t.categoryId) ?? 0) + t.amountCents);

  async function saveLimit(id: string) {
    const cat = snap!.categories.find((c) => c.id === id)!;
    const cents = value.trim() ? parseBRL(value) : null;
    if (value.trim() && cents === null) return toast("Limite inválido. Use algo como 800,00.");
    await repo.upsertCategory({ ...cat, monthlyLimitCents: cents || null });
    setEditing(null); toast(cents ? "Limite salvo" : "Limite removido");
  }

  return (
    <div>
      <PageTitle>Categorias</PageTitle>
      <Card>
        <ul>
          {snap.categories.filter((c) => c.kind === "expense" && !c.archived).map((c) => {
            const s = spent.get(c.id) ?? 0;
            return (
              <li key={c.id} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                <CategoryIcon name={c.icon} />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{c.name}</span>
                    <span className={`num ${c.monthlyLimitCents && s > c.monthlyLimitCents ? "text-expense" : ""}`}>
                      {formatBRL(s)}{c.monthlyLimitCents ? ` de ${formatBRL(c.monthlyLimitCents)}` : ""}
                    </span>
                  </div>
                  {c.monthlyLimitCents ? <ProgressBar ratio={s / c.monthlyLimitCents} label={`Limite de ${c.name}`} /> : null}
                </div>
                {editing === c.id ? (
                  <form onSubmit={(e) => { e.preventDefault(); saveLimit(c.id); }} className="flex gap-2">
                    <input aria-label={`Limite de ${c.name}`} autoFocus inputMode="decimal" placeholder="Sem limite" value={value} onChange={(e) => setValue(e.target.value)} className={`${inputClass} h-9 w-28`} />
                    <button className="font-semibold text-accent">Salvar</button>
                  </form>
                ) : (
                  <button className="text-sm font-semibold text-accent" onClick={() => { setEditing(c.id); setValue(c.monthlyLimitCents ? String(c.monthlyLimitCents / 100).replace(".", ",") : ""); }}>
                    {c.monthlyLimitCents ? "Editar limite" : "Definir limite"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
