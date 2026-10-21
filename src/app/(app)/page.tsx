"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle, ArrowDownCircle, ArrowUpCircle, CalendarCheck, CheckCircle2, CreditCard, ListOrdered, Plus, TrendingDown, TrendingUp, Wallet,
  type LucideIcon,
} from "lucide-react";
import { useShell } from "@/components/AppShell";
import { Bars, Donut, Empty, IncomeExpenseChart } from "@/components/charts";
import { TransactionList } from "@/components/TransactionList";
import { Button, Card, EmptyState, ProgressBar, Skeleton } from "@/components/ui";
import { repo, useSnapshot } from "@/lib/data";
import { formatBRL } from "@/lib/money";
import { dayLabel, monthOf, today } from "@/lib/dates";
import {
  categoryUsage, incomeByAccount, monthBreakdown, monthSeries, monthTransactions, totalBalance, totalsByCategory, upcomingBills,
} from "@/lib/summary";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function MonthPicker({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const year = Number(month.slice(0, 4));
  const mm = Number(month.slice(5, 7));
  const thisYear = Number(today().slice(0, 4));
  const years = Array.from({ length: 6 }, (_, i) => thisYear - 4 + i);
  const pick = (y: number, m: number) => setMonth(`${y}-${String(m).padStart(2, "0")}-01`);
  return (
    <div className="flex flex-col gap-3">
      <label className="w-fit">
        <span className="sr-only">Ano</span>
        <select value={year} onChange={(e) => pick(Number(e.target.value), mm)}
          className="h-10 rounded-md border border-border bg-surface-raised px-3 font-semibold shadow-card">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <div role="radiogroup" aria-label="Mês" className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">
        {MONTHS.map((name, i) => (
          <button key={name} type="button" role="radio" aria-checked={mm === i + 1} onClick={() => pick(year, i + 1)}
            className="h-9 shrink-0 rounded-md border border-border bg-surface-raised px-3.5 text-sm text-text shadow-card hover:bg-surface
              aria-checked:border-accent aria-checked:bg-accent-soft aria-checked:font-semibold aria-checked:text-accent">
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Title({ icon: Icon, children, aside }: { icon?: LucideIcon; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-semibold">{Icon && <Icon aria-hidden className="size-4 text-accent" />}{children}</h2>
      {aside}
    </div>
  );
}

function MiniStat({ icon: Icon, tone, label, value, hint }: { icon: LucideIcon; tone: string; label: string; value: number; hint: string }) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-sm font-semibold"><Icon aria-hidden className={`size-4 ${tone}`} />{label}</div>
      <div className="num mt-2 text-lg font-bold">{formatBRL(value)}</div>
      <div className="mt-0.5 text-xs text-text-muted">{hint}</div>
    </Card>
  );
}

function QuickAction({ icon: Icon, tone, label, onClick, href }: { icon: LucideIcon; tone: string; label: string; onClick?: () => void; href?: string }) {
  const cls = "flex items-center gap-3 rounded-lg border border-border bg-surface-raised p-3 text-left font-semibold shadow-card hover:bg-surface";
  const body = <><span className={`grid size-10 shrink-0 place-items-center rounded-pill ${tone}`}><Icon aria-hidden className="size-5" /></span>{label}</>;
  return href ? <Link href={href} className={cls}>{body}</Link> : <button type="button" onClick={onClick} className={cls}>{body}</button>;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function Dashboard() {
  const snap = useSnapshot();
  const { month, setMonth, openNew, toast } = useShell();
  const [range, setRange] = useState<6 | 12>(6);

  if (!snap) return <div className="flex flex-col gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>;

  const b = monthBreakdown(snap, month);
  const expense = b.cashExpenseCents + b.cardCents;
  const net = b.incomeCents - expense;
  const balance = totalBalance(snap);
  const bills = upcomingBills(snap, today());
  const txs = monthTransactions(snap, month);
  const incomeCount = txs.filter((t) => t.kind === "income").length;
  const cashCount = txs.filter((t) => t.kind === "expense" && !t.cardId).length;
  const cardCount = txs.filter((t) => t.kind === "expense" && t.cardId).length;
  const byCategory = totalsByCategory(snap, month, "expense");
  const incomeCats = totalsByCategory(snap, month, "income");
  const incomeAccounts = incomeByAccount(snap, month);
  const usage = categoryUsage(snap, month).filter((u) => u.limitCents).slice(0, 5);
  const recent = [...txs].sort((a, b2) => b2.occurredOn.localeCompare(a.occurredOn) || b2.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const catName = (id: string) => snap.categories.find((c) => c.id === id)?.name ?? "";
  // O gráfico termina no mês escolhido, ou no mês atual se a pessoa olha para o futuro.
  const lastMonth = month > monthOf(today()) ? monthOf(today()) : month;
  const series = monthSeries(snap, lastMonth, range);
  const summaryRows = [
    { label: "Receitas", cents: b.incomeCents, color: "var(--color-income)" },
    { label: "Saídas", cents: b.cashExpenseCents, color: "var(--color-expense)" },
    { label: "Cartão de crédito", cents: b.cardCents, color: "var(--color-chart-3)" },
    { label: "A pagar", cents: b.pendingCents, color: "var(--color-chart-4)" },
  ];
  const summaryMax = Math.max(1, ...summaryRows.map((r) => r.cents));

  return (
    <div className="flex flex-col gap-4">
      <MonthPicker month={month} setMonth={setMonth} />

      <Card>
        <Title icon={Wallet}>Saldo atual</Title>
        <p className="-mt-2 text-xs text-text-muted">Soma de todas as contas e da carteira</p>
        <div className={`num mt-2 text-xl font-bold ${balance < 0 ? "text-expense" : ""}`}>{formatBRL(balance)}</div>
        <div className="num mt-1 flex gap-4 text-xs">
          <span className="flex items-center gap-1 text-income"><ArrowUpCircle aria-hidden className="size-3.5" />{formatBRL(b.incomeCents)}</span>
          <span className="flex items-center gap-1 text-expense"><ArrowDownCircle aria-hidden className="size-3.5" />{formatBRL(expense)}</span>
        </div>
      </Card>

      <Card>
        <Title aside={
          <span className={`rounded-pill px-2.5 py-0.5 text-xs font-semibold ${net >= 0 ? "bg-accent-soft text-income" : "bg-danger-soft text-expense"}`}>
            {net >= 0 ? "Sobrou no mês" : "Gastou mais que recebeu"}
          </span>
        }>Receitas x despesas</Title>
        <div className={`num text-xl font-bold ${net >= 0 ? "text-income" : "text-expense"}`}>{formatBRL(net)}</div>
        {[{ label: "Receitas", cents: b.incomeCents, icon: TrendingUp, color: "var(--color-income)" },
          { label: "Despesas", cents: expense, icon: TrendingDown, color: "var(--color-expense)" }].map((r) => (
          <div key={r.label} className="mt-3">
            <div className="flex justify-between text-xs text-text-muted">
              <span className="flex items-center gap-1"><r.icon aria-hidden className="size-3.5" />{r.label}</span>
              <span className="num font-semibold text-text">{formatBRL(r.cents)}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-pill bg-surface">
              <span className="block h-full rounded-pill" style={{ width: `${(r.cents / Math.max(1, b.incomeCents, expense)) * 100}%`, background: r.color }} />
            </div>
          </div>
        ))}
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MiniStat icon={ArrowUpCircle} tone="text-income" label="Entradas" value={b.incomeCents}
          hint={incomeCount ? plural(incomeCount, "lançamento", "lançamentos") : "Sem entradas"} />
        <MiniStat icon={ArrowDownCircle} tone="text-expense" label="Saídas" value={b.cashExpenseCents}
          hint={cashCount ? plural(cashCount, "lançamento", "lançamentos") : "Sem saídas"} />
        <MiniStat icon={CreditCard} tone="text-chart-3" label="Fatura do cartão" value={b.cardOpenCents}
          hint={cardCount ? (b.cardOpenCents ? `${plural(cardCount, "compra", "compras")} nesta fatura` : "Fatura paga") : "Sem compras"} />
        <MiniStat icon={CheckCircle2} tone="text-accent" label="Contas a pagar" value={b.pendingCents}
          hint={b.pendingCount ? plural(b.pendingCount, "conta em aberto", "contas em aberto") : "Tudo em dia!"} />
      </div>

      {bills.slice(0, 3).map((t) => (
        <div key={t.id} role="status" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md bg-warning-soft px-4 py-3 font-medium text-warning">
          <span className="flex items-center gap-2"><AlertTriangle aria-hidden className="size-4" />
            {t.description || "Conta"} {t.dueOn! < today() ? "venceu" : "vence"} {dayLabel(t.dueOn!).toLowerCase()}: {formatBRL(t.amountCents)}
          </span>
          <button className="font-semibold underline" onClick={async () => { await repo.markPaid(t.id); toast("Marcada como paga"); }}>Marcar como paga</button>
        </div>
      ))}

      <Card>
        <Title>Resumo do mês</Title>
        <ul className="flex flex-col gap-3">
          {summaryRows.map((r) => (
            <li key={r.label} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[10rem_1fr_7rem]">
              <span className="flex items-center gap-2"><span className="size-2.5 rounded-pill" style={{ background: r.color }} />{r.label}</span>
              <span className="h-2 overflow-hidden rounded-pill bg-surface">
                <span className="block h-full rounded-pill" style={{ width: `${(r.cents / summaryMax) * 100}%`, background: r.color }} />
              </span>
              <span className="num text-right font-semibold">{formatBRL(r.cents)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <section>
        <h2 className="mb-3 text-base font-semibold">Ações rápidas</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <QuickAction icon={TrendingUp} tone="bg-accent-soft text-income" label="Nova receita" onClick={() => openNew("income")} />
          <QuickAction icon={TrendingDown} tone="bg-danger-soft text-expense" label="Nova despesa" onClick={() => openNew("expense")} />
          <QuickAction icon={ListOrdered} tone="bg-surface text-chart-2" label="Ver extrato" href="/extrato" />
          <QuickAction icon={CalendarCheck} tone="bg-surface text-chart-4" label="Fechar o mês" href="/fechamento" />
        </div>
      </section>

      <Card>
        <Title aside={
          <div role="radiogroup" aria-label="Período" className="flex gap-1">
            {([6, 12] as const).map((n) => (
              <button key={n} type="button" role="radio" aria-checked={range === n} onClick={() => setRange(n)}
                className="h-8 whitespace-nowrap rounded-md px-3 text-xs font-semibold text-text-muted hover:bg-surface aria-checked:bg-accent aria-checked:text-on-accent">
                {n} meses
              </button>
            ))}
          </div>
        }>Receitas x despesas por mês</Title>
        <IncomeExpenseChart points={series} />
      </Card>

      <Card>
        <Title>Despesas por categoria</Title>
        {byCategory.length ? <Donut slices={byCategory} label={`Despesas do mês por categoria: ${byCategory.map((s) => `${s.label} ${formatBRL(s.cents)}`).join(", ")}`} />
          : <Empty>Sem despesas neste mês.</Empty>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Title>Receitas por conta</Title>
          {incomeAccounts.length ? <Bars slices={incomeAccounts} /> : <Empty>Sem receitas neste mês.</Empty>}
        </Card>
        <Card>
          <Title>Receitas por categoria</Title>
          {incomeCats.length ? <Bars slices={incomeCats} color="var(--color-chart-2)" /> : <Empty>Sem receitas neste mês.</Empty>}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <Title aside={recent.length > 0 && <Link href="/extrato" className="text-sm font-semibold text-accent">Ver todos</Link>}>Últimos lançamentos</Title>
          {recent.length ? <TransactionList snap={snap} items={recent} onDeleted={toast} /> : (
            <EmptyState icon={Wallet} title="Comece registrando o primeiro gasto. Leva 5 segundos."
              action={<Button onClick={() => openNew()}><Plus aria-hidden className="size-4" />Novo lançamento</Button>} />
          )}
        </Card>
        <Card>
          <Title aside={<Link href="/categorias" className="text-sm font-semibold text-accent">Ver todas</Link>}>Limites por categoria</Title>
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
          ) : <Empty>Defina limites em Categorias para acompanhar seus gastos aqui.</Empty>}
        </Card>
      </div>
    </div>
  );
}
