"use client";

import { useState, type FormEvent } from "react";
import { Users } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { Button, Card, EmptyState, Input, PageTitle, ProgressBar, Skeleton } from "@/components/ui";
import { repo, useSnapshot } from "@/lib/data";
import { formatBRL, parseBRL } from "@/lib/money";
import { monthTransactions } from "@/lib/summary";

export default function Pessoas() {
  const snap = useSnapshot();
  const { month, toast } = useShell();
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("");

  if (!snap) return <Skeleton className="h-64" />;
  const spent = new Map<string, number>();
  for (const t of monthTransactions(snap, month)) if (t.kind === "expense" && t.personId) spent.set(t.personId, (spent.get(t.personId) ?? 0) + t.amountCents);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await repo.upsertPerson({ name: name.trim(), monthlyLimitCents: parseBRL(limit) || null, archived: false });
    setName(""); setLimit(""); toast("Pessoa adicionada");
  }

  return (
    <div>
      <PageTitle>Pessoas</PageTitle>
      <Card className="mb-4">
        <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
          <Input aria-label="Nome" placeholder="Nome (ex.: Ana)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input aria-label="Limite mensal" inputMode="decimal" placeholder="Limite (opcional)" value={limit} onChange={(e) => setLimit(e.target.value)} />
          <Button type="submit">Adicionar</Button>
        </form>
      </Card>
      <Card>
        {snap.people.length ? (
          <ul>{snap.people.map((p) => {
            const s = spent.get(p.id) ?? 0;
            return (
              <li key={p.id} className="border-b border-border py-3 last:border-0">
                <div className="flex justify-between"><span className="font-medium">{p.name}</span>
                  <span className="num">{formatBRL(s)}{p.monthlyLimitCents ? ` de ${formatBRL(p.monthlyLimitCents)}` : ""}</span></div>
                {p.monthlyLimitCents ? <ProgressBar ratio={s / p.monthlyLimitCents} label={`Limite de ${p.name}`} /> : null}
              </li>
            );
          })}</ul>
        ) : <EmptyState icon={Users} title="Adicione quem divide as contas com você para ver quanto cada um gasta." />}
      </Card>
    </div>
  );
}
