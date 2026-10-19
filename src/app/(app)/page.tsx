"use client";

import Link from "next/link";
import { AlertTriangle, Plus, Wallet } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { TransactionList } from "@/components/TransactionList";
import { Button, Card, EmptyState, ProgressBar, Skeleton } from "@/components/ui";
import { repo, useSnapshot } from "@/lib/data";
import { formatBRL, formatSigned } from "@/lib/money";
import { dayLabel, today } from "@/lib/dates";
import { categoryUsage, monthTotals, monthTransactions, projectedLeftover, totalBalance, upcomingBills } from "@/lib/summary";

function Stat({ label, value, tone, wide }: { label: string; value: string; tone?: "income" | "expense"; wide?: boolean }) {
  return (
    <Card className={wide ? "col-span-2 lg:col-span-1" : ""}>
      <div className="text-xs font-medium text-text-muted">{label}</div>
      <div className={`num mt-1.5 whitespace-nowrap font-bold ${wide ? "text-xl" : "text-lg lg:text-xl"} ${tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : ""}`}>{value}</div>
    </Card>
  );
}

export default function Dashboard() {
  const snap = useSnapshot();
  const { month, openNew, toast } = useShell();

  if (!snap) return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>;

  const totals = monthTotals(snap, month);
  const balance = totalBalance(snap);
  const leftover = projectedLeftover(snap, month);
  const bills = upcomingBills(snap, today());
  const usage = categoryUsage(snap, month).filter((u) => u.limitCents).slice(0, 5);
  const recent = monthTransactions(snap, month).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const catName = (id: string) => snap.categories.find((c) => c.id === id)?.name ?? "";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat wide label="Saldo nas contas" value={formatBRL(balance)} tone={balance < 0 ? "expense" : undefined} />
        <Stat label="Receitas do mês" value={formatSigned(totals.incomeCents, "income")} tone="income" />
        <Stat label="Despesas do mês" value={formatSigned(totals.expenseCents, "expense")} tone="expense" />
        <Stat wide label="Sobra prevista" value={formatBRL(leftover)} tone={leftover < 0 ? "expense" : undefined} />
      </div>

      {bills.slice(0, 3).map((b) => (
        <div key={b.id} role="status" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md bg-warning-soft px-4 py-3 font-medium text-warning">
          <span className="flex items-center gap-2"><AlertTriangle aria-hidden className="size-4" />
            {b.description || "Conta"} {b.dueOn! < today() ? "venceu" : "vence"} {dayLabel(b.dueOn!).toLowerCase()}: {formatBRL(b.amountCents)}
          </span>
          <button className="font-semibold underline" onClick={async () => { await repo.markPaid(b.id); toast("Marcada como paga"); }}>Marcar como paga</button>
        </div>
      ))}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold">Últimos lançamentos</h2>
            {recent.length > 0 && <Link href="/extrato" className="text-sm font-semibold text-accent">Ver extrato</Link>}
          </div>
          {recent.length ? <TransactionList snap={snap} items={recent} onDeleted={toast} /> : (
            <EmptyState icon={Wallet} title="Comece registrando o primeiro gasto. Leva 5 segundos."
              action={<Button onClick={openNew}><Plus aria-hidden className="size-4" />Novo lançamento</Button>} />
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-base font-semibold">Limites por categoria</h2>
          {usage.length ? (
            <ul className="flex flex-col gap-3.5">
              {usage.map((u) => (
                <li key={u.categoryId}>
                  <div className="flex justify-between gap-2">
                    <span>{catName(u.categoryId)}</span>
                    <span className={`num ${u.ratio! > 1 ? "text-expense" : ""}`}>{formatBRL(u.spentCents)} de {formatBRL(u.limitCents!)}</span>
                  </div>
                  <ProgressBar ratio={u.ratio!} label={`Limite de ${catName(u.categoryId)}`} />
                </li>
              ))}
            </ul>
          ) : <p className="text-text-muted">Defina limites em Categorias para acompanhar seus gastos aqui.</p>}
          <Link href="/categorias" className="mt-4 inline-flex h-10 items-center rounded-md border border-border px-4 font-semibold hover:bg-surface">Ver categorias</Link>
        </Card>
      </div>
    </div>
  );
}
