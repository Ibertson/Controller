"use client";

import { useState } from "react";
import { ListOrdered } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { TransactionList } from "@/components/TransactionList";
import { Card, EmptyState, PageTitle, Skeleton, inputClass } from "@/components/ui";
import { useSnapshot } from "@/lib/data";
import { formatSigned } from "@/lib/money";
import { monthTotals, monthTransactions } from "@/lib/summary";

export default function Transacoes() {
  const snap = useSnapshot();
  const { month, toast } = useShell();
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [category, setCategory] = useState("");
  const [person, setPerson] = useState("");

  if (!snap) return <Skeleton className="h-64" />;

  const term = q.trim().toLowerCase();
  const items = monthTransactions(snap, month).filter((t) =>
    (!source || t.accountId === source || t.toAccountId === source || t.cardId === source) &&
    (!category || t.categoryId === category) &&
    (!person || t.personId === person) &&
    (!term || t.description.toLowerCase().includes(term)));
  const totals = monthTotals({ ...snap, transactions: items }, month);
  const filtered = !!(q || source || category || person);

  return (
    <div>
      <PageTitle>Transações</PageTitle>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input aria-label="Buscar" placeholder="Buscar descrição" value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} />
        <select aria-label="Conta ou cartão" value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
          <option value="">Todas as contas e cartões</option>
          {snap.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          {snap.cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Categoria" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
          <option value="">Todas as categorias</option>
          {snap.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {snap.people.length > 0 && (
          <select aria-label="Pessoa" value={person} onChange={(e) => setPerson(e.target.value)} className={inputClass}>
            <option value="">Todas as pessoas</option>
            {snap.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>
      <Card>
        {items.length ? (
          <>
            <div className="mb-3 flex gap-4 text-sm">
              <span className="num text-income">{formatSigned(totals.incomeCents, "income")}</span>
              <span className="num text-expense">{formatSigned(totals.expenseCents, "expense")}</span>
            </div>
            <TransactionList snap={snap} items={items} onDeleted={toast} />
          </>
        ) : <EmptyState icon={ListOrdered} title={filtered ? "Nada encontrado com esses filtros." : "Nenhum lançamento neste período."} />}
      </Card>
    </div>
  );
}
