"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeftRight, ArrowDown, ArrowUp, CreditCard, Download, Filter, Landmark, ListOrdered, Plus, TrendingUp, Upload, Users, Wallet,
} from "lucide-react";
import { useShell } from "@/components/AppShell";
import { LineChart } from "@/components/charts";
import { MonthPicker } from "@/components/MonthPicker";
import { TransactionList } from "@/components/TransactionList";
import { Card, EmptyState, Skeleton, inputClass } from "@/components/ui";
import { useSession, useSnapshot } from "@/lib/data";
import { monthOf, today } from "@/lib/dates";
import { transactionsCsv } from "@/lib/csv";
import { formatBRL } from "@/lib/money";
import { accountBalances, balanceSeries, monthTotals, monthTransactions, totalBalance, totalsByPerson } from "@/lib/summary";
import type { AccountKind } from "@/lib/types";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
const kindLabel: Record<AccountKind, string> = { checking: "Conta corrente", savings: "Poupança", wallet: "Dinheiro", other: "Outra" };

export default function Transacoes() {
  const snap = useSnapshot();
  const session = useSession();
  const { month, setMonth, openNew, toast } = useShell();
  const [side, setSide] = useState<"expense" | "income">("expense");
  const [tab, setTab] = useState<"all" | "card">("all");
  const [range, setRange] = useState<6 | 12>(6);
  const [showFilters, setShowFilters] = useState(false);
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [category, setCategory] = useState("");
  const [person, setPerson] = useState("");

  if (!snap) return <div className="flex flex-col gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>;

  const totals = monthTotals(snap, month);
  const net = totals.incomeCents - totals.expenseCents;

  // Pessoas: o titular (lançamentos sem pessoa) e cada pessoa cadastrada.
  const byPerson = totalsByPerson(snap, month, side);
  const people = [{ id: "", name: session?.name ?? "Você" }, ...snap.people.filter((p) => !p.archived)];

  const term = q.trim().toLowerCase();
  const items = monthTransactions(snap, month).filter((t) =>
    // Despesas mostra o que sai (inclui transferências e faturas pagas); Receitas mostra só o que entra.
    (side === "income" ? t.kind === "income" : t.kind !== "income") &&
    (tab === "card" && side === "expense" ? t.kind === "expense" && !!t.cardId : true) &&
    (!source || t.accountId === source || t.toAccountId === source || t.cardId === source) &&
    (!category || t.categoryId === category) &&
    (!person || t.personId === person) &&
    (!term || t.description.toLowerCase().includes(term)));
  const filtered = !!(q || source || category || person);

  const lastMonth = month > monthOf(today()) ? monthOf(today()) : month;
  const balances = balanceSeries(snap, lastMonth, range);

  const accBalances = accountBalances(snap);
  const accounts = snap.accounts.filter((a) => !a.archived);
  const groups = [
    { label: "Contas bancárias", list: accounts.filter((a) => a.kind === "checking" || a.kind === "savings") },
    { label: "Outros", list: accounts.filter((a) => a.kind === "wallet" || a.kind === "other") },
  ].filter((g) => g.list.length);

  function exportCsv() {
    const csv = transactionsCsv(snap!, items);
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `transacoes-${month.slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`${items.length} lançamentos exportados`);
  }

  return (
    <div className="flex flex-col gap-4">
      <MonthPicker month={month} setMonth={setMonth} />

      <div role="radiogroup" aria-label="Ver" className="grid grid-cols-2 gap-2">
        {([["expense", "Despesas"], ["income", "Receitas"]] as const).map(([v, label]) => (
          <button key={v} type="button" role="radio" aria-checked={side === v} onClick={() => setSide(v)}
            className="h-10 rounded-md border border-border bg-surface-raised font-semibold text-text-muted shadow-card aria-checked:border-accent aria-checked:bg-accent aria-checked:text-on-accent">
            {label}
          </button>
        ))}
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Users aria-hidden className="size-5 text-accent" />{side === "expense" ? "Gastos por pessoa" : "Receitas por pessoa"}</h2>
          <Link href="/pessoas" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-semibold text-on-accent hover:bg-accent-hover">
            <Plus aria-hidden className="size-4" />Adicionar pessoa
          </Link>
        </div>
        <ul className="flex flex-wrap gap-6">
          {people.map((p) => {
            const cents = byPerson.get(p.id) ?? 0;
            return (
              <li key={p.id || "me"} className="flex w-24 flex-col items-center gap-1.5 text-center">
                <span className="grid size-16 place-items-center rounded-pill bg-accent text-lg font-semibold text-on-accent ring-4 ring-accent-soft">{initials(p.name)}</span>
                <span className="w-full truncate text-sm font-medium">{p.name}</span>
                <span className={`num text-xs font-semibold ${side === "expense" ? "text-expense" : "text-income"}`}>{formatBRL(cents)}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-text-muted">Saldo do mês</h2>
          <div className={`num mt-1 text-xl font-bold ${net < 0 ? "text-expense" : "text-income"}`}>{formatBRL(net)}</div>
          <div className="mt-2 flex gap-6 text-sm">
            <div><div className="text-text-muted">Receitas</div><div className="num font-semibold text-income">{formatBRL(totals.incomeCents)}</div></div>
            <div><div className="text-text-muted">Despesas</div><div className="num font-semibold text-expense">{formatBRL(totals.expenseCents)}</div></div>
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-text-muted">Ações rápidas</h2>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => openNew("income")} className="flex flex-col items-center gap-1.5 rounded-md bg-accent-soft p-3 text-sm font-semibold text-income hover:opacity-90">
              <span className="grid size-10 place-items-center rounded-pill bg-income text-on-accent"><ArrowUp aria-hidden className="size-5" /></span>Receita
            </button>
            <button type="button" onClick={() => openNew("expense")} className="flex flex-col items-center gap-1.5 rounded-md bg-danger-soft p-3 text-sm font-semibold text-expense hover:opacity-90">
              <span className="grid size-10 place-items-center rounded-pill bg-expense text-on-accent"><ArrowDown aria-hidden className="size-5" /></span>Despesa
            </button>
            <button type="button" onClick={() => openNew("transfer")} className="flex flex-col items-center gap-1.5 rounded-md bg-surface p-3 text-sm font-semibold text-text hover:opacity-90">
              <span className="grid size-10 place-items-center rounded-pill bg-chart-6 text-on-accent"><ArrowLeftRight aria-hidden className="size-5" /></span>Transferir
            </button>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={exportCsv} disabled={!items.length}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold text-accent hover:bg-surface disabled:opacity-50">
              <Download aria-hidden className="size-4" />Exportar (Excel)
            </button>
            <button type="button" onClick={() => toast("Importar extrato do banco chega numa próxima etapa")}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold text-text-muted hover:bg-surface">
              <Upload aria-hidden className="size-4" />Importar extrato
            </button>
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold"><TrendingUp aria-hidden className="size-4 text-accent" />Evolução do saldo</h2>
          <div role="radiogroup" aria-label="Período" className="flex gap-1">
            {([6, 12] as const).map((n) => (
              <button key={n} type="button" role="radio" aria-checked={range === n} onClick={() => setRange(n)}
                className="h-8 whitespace-nowrap rounded-md px-3 text-xs font-semibold text-text-muted hover:bg-surface aria-checked:bg-accent aria-checked:text-on-accent">
                {n} meses
              </button>
            ))}
          </div>
        </div>
        <LineChart months={balances.map((b) => b.month)} label={`Saldo no fim de cada mês: ${balances.map((b) => formatBRL(b.balanceCents)).join(", ")}`}
          series={[{ label: "Saldo no fim do mês", color: "var(--color-accent)", values: balances.map((b) => b.balanceCents) }]} />
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Últimas movimentações</h2>
          <button type="button" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-text px-3 text-sm font-semibold text-bg hover:opacity-90">
            Filtrar<Filter aria-hidden className="size-4" />
          </button>
        </div>
        <div role="radiogroup" aria-label="Movimentações" className="mb-3 flex gap-2">
          {([["all", "Geral", ListOrdered], ["card", "Cartão", CreditCard]] as const).filter(([v]) => side === "expense" || v === "all").map(([v, label, Icon]) => (
            <button key={v} type="button" role="radio" aria-checked={tab === v || side === "income"} onClick={() => setTab(v)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold text-text-muted aria-checked:border-accent aria-checked:bg-accent aria-checked:text-on-accent">
              <Icon aria-hidden className="size-4" />{label}
            </button>
          ))}
        </div>
        {showFilters && (
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
        )}
        {items.length ? <TransactionList snap={snap} items={items} onDeleted={toast} /> : (
          <EmptyState icon={Wallet} title={filtered ? "Nada encontrado com esses filtros." : "Nenhuma transação neste mês. Adicione suas primeiras receitas e despesas."} />
        )}
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Contas</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => openNew("transfer")} className="h-9 rounded-md border border-border bg-surface-raised px-3 text-sm font-semibold hover:bg-surface">Transferir</button>
            <Link href="/contas" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-semibold text-on-accent hover:bg-accent-hover">
              <Plus aria-hidden className="size-4" />Conta
            </Link>
          </div>
        </div>
        <Card>
          <div className={`num text-xl font-bold ${totalBalance(snap) < 0 ? "text-expense" : "text-income"}`}>{formatBRL(totalBalance(snap))}</div>
          <div className="text-xs text-text-muted">Saldo total</div>
          {groups.length ? groups.map((g) => (
            <div key={g.label} className="mt-4">
              <h3 className="border-b border-border pb-1.5 text-sm font-semibold">{g.label}</h3>
              <ul>
                {g.list.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
                    <span className="grid size-9 place-items-center rounded-pill bg-accent-soft text-accent">
                      {a.kind === "wallet" ? <Wallet aria-hidden className="size-4" /> : <Landmark aria-hidden className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{a.name}</span><span className="text-xs text-text-muted">{kindLabel[a.kind]}</span></span>
                    <span className={`num font-semibold ${(accBalances.get(a.id) ?? 0) < 0 ? "text-expense" : ""}`}>{formatBRL(accBalances.get(a.id) ?? 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )) : (
            <Link href="/contas" className="mt-4 flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-accent p-6 font-semibold text-accent">
              <Landmark aria-hidden className="size-7" />Adicionar primeira conta
            </Link>
          )}
        </Card>
      </section>
    </div>
  );
}
