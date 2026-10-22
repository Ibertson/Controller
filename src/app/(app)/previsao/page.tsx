"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CalendarDays, CalendarCheck, ChevronRight, CircleAlert, CircleDollarSign, HandCoins, Lightbulb, Plus, Repeat, TrendingDown, TrendingUp, Users, Wallet,
} from "lucide-react";
import { useShell } from "@/components/AppShell";
import { Bars, LineChart } from "@/components/charts";
import { Dialog } from "@/components/Dialog";
import { RecurringModal } from "@/components/RecurringModal";
import { Button, Card, PageTitle, Skeleton, inputClass } from "@/components/ui";
import { repo, useSnapshot } from "@/lib/data";
import { addMonths, daysInMonth, today } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import {
  activeRecurring, agendaEvents, expensesByPerson, monthClosing, pendingTotals, recurringDate, recurringLaunch, type AgendaEvent,
} from "@/lib/previsao";
import { categoryUsage, monthSeries, monthTransactions, totalsByCategory } from "@/lib/summary";
import type { Recurring, Snapshot } from "@/lib/types";

const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const longDay = (d: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(d + "T00:00:00Z"));
const signed = (c: number) => `${c >= 0 ? "+" : "-"}${formatBRL(Math.abs(c))}`;
const tone = (c: number) => (c >= 0 ? "text-income" : "text-expense");

function Section({ icon: Icon, title, badge, action, children }: {
  icon?: typeof Wallet; title: string; badge?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          {Icon && <Icon aria-hidden className="size-5 text-accent" />}{title}
          {badge && <span className="rounded-pill bg-surface px-2 py-0.5 text-xs font-medium text-text-muted">{badge}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Previsao() {
  const snap = useSnapshot();
  const { month, toast } = useShell();
  const [day, setDay] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const [edit, setEdit] = useState<null | { kind: Recurring["kind"]; item?: Recurring }>(null);
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [span, setSpan] = useState(6);
  const [busy, setBusy] = useState<string | null>(null);

  if (!snap) return <Skeleton className="h-64" />;

  const now = today();
  const events = agendaEvents(snap, month);
  const closing = monthClosing(snap, month);
  const pending = pendingTotals(snap, month);
  const byCategory = totalsByCategory(snap, month, "expense");
  const history = monthSeries(snap, month, span);

  // Lança o fixo do mês como lançamento pago (ou paga a conta pendente da agenda).
  async function settle(e: AgendaEvent | { recurring: Recurring }) {
    const key = "recurring" in e ? e.recurring.id : e.id;
    setBusy(key);
    try {
      if ("recurring" in e || e.ref.recurringId) {
        const r = "recurring" in e ? e.recurring : snap!.recurring!.find((x) => x.id === e.ref.recurringId)!;
        const accountId = r.accountId ?? snap!.accounts.find((a) => !a.archived)?.id;
        if (!accountId) { toast("Cadastre uma conta antes de lançar."); return; }
        await repo.createTransaction({
          kind: r.kind, amountCents: r.amountCents, occurredOn: recurringDate(r, month), description: r.description,
          categoryId: r.categoryId, accountId, personId: r.personId, recurringId: r.id, isPaid: true,
        });
        toast(r.kind === "income" ? "Receita fixa recebida" : "Gasto fixo pago");
      } else if (e.ref.transactionId) {
        await repo.markPaid(e.ref.transactionId);
        toast(e.kind === "income" ? "Marcada como recebida" : "Marcada como paga");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível lançar.");
    } finally { setBusy(null); }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageTitle>Previsão</PageTitle>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Agenda month={month} now={now} events={events} onPick={setDay} />
        <Card className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
            <CalendarCheck aria-hidden className="size-4" />Fechamento do mês
          </h2>
          <div>
            <p className="text-sm text-text-muted">Você deve fechar o mês com</p>
            <p className={`num text-4xl font-bold ${tone(closing.resultCents)}`}>{signed(closing.resultCents)}</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-muted">Composição do mês</p>
            <Composition income={closing.incomeCents} expense={closing.expenseCents} />
          </div>
          <button type="button" onClick={() => setDetails(true)}
            className="mt-auto flex items-center justify-center gap-1 rounded-md py-2 text-sm font-semibold text-accent hover:bg-accent-soft">
            Ver mais detalhes<ChevronRight aria-hidden className="size-4" />
          </button>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-8">
          <Section title="Contas a Pagar e Receitas a Receber">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="flex flex-col gap-1">
                <p className="text-sm font-medium text-expense">Contas a Pagar</p>
                <p className="num text-2xl font-bold text-expense">-{formatBRL(pending.payCents)}</p>
                <p className="text-sm text-text-muted">{pending.payCount ? `${pending.payCount} ${pending.payCount === 1 ? "conta pendente" : "contas pendentes"}` : "Nenhuma conta pendente"}</p>
              </Card>
              <Card className="flex flex-col gap-1">
                <p className="text-sm font-medium text-income">Receitas a Receber</p>
                <p className="num text-2xl font-bold text-income">+{formatBRL(pending.receiveCents)}</p>
                <p className="text-sm text-text-muted">{pending.receiveCount ? `${pending.receiveCount} a receber` : "Todas recebidas"}</p>
              </Card>
              <Card className="flex flex-col gap-1">
                <p className={`text-sm font-medium ${tone(pending.balanceCents)}`}>Saldo Previsto</p>
                <p className={`num text-2xl font-bold ${tone(pending.balanceCents)}`}>{signed(pending.balanceCents)}</p>
                <p className="text-sm text-text-muted">{pending.balanceCents >= 0 ? "Suas receitas pendentes cobrem as contas a pagar" : `Faltam ${formatBRL(-pending.balanceCents)} para cobrir as contas a pagar`}</p>
                <dl className="mt-2 flex flex-col gap-1 border-t border-border pt-2 text-xs">
                  <div className="flex justify-between"><dt>Receitas</dt><dd className="num text-income">+{formatBRL(pending.receiveCents)}</dd></div>
                  <div className="flex justify-between"><dt>Contas</dt><dd className="num text-expense">-{formatBRL(pending.payCents)}</dd></div>
                </dl>
              </Card>
            </div>
          </Section>

          <Section title="Entradas x Saídas" badge="Previsão">
            <p className="-mt-2 text-sm text-text-muted">Valores esperados para o mês, incluindo contas fixas, cartões e receitas pendentes.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {([["Entradas", TrendingUp, closing.incomeCents, "text-income"], ["Saídas", TrendingDown, closing.expenseCents, "text-expense"],
                ["Diferença", CircleDollarSign, closing.resultCents, tone(closing.resultCents)]] as const).map(([label, Icon, v, cls]) => (
                <Card key={label} className="flex flex-col items-center gap-1 text-center">
                  <p className="flex items-center gap-1.5 text-sm text-text-muted"><Icon aria-hidden className="size-4" />{label}</p>
                  <p className={`num text-2xl font-bold ${cls}`}>{label === "Diferença" ? signed(v) : formatBRL(v)}</p>
                </Card>
              ))}
            </div>
          </Section>

          <Section title="Onde está indo seu dinheiro">
            <Card>
              {byCategory.length ? <Bars slices={byCategory.slice(0, 8)} color="var(--color-expense)" />
                : <p className="py-6 text-center text-sm text-text-muted">Nenhuma despesa registrada neste mês</p>}
            </Card>
          </Section>
        </div>

        <aside className="flex flex-col gap-8">
          <Section icon={Lightbulb} title="Oportunidades de Economia">
            <Card className="flex flex-col gap-3">{savings(snap, month).map((t) => <Tip key={t.title} {...t} />)}</Card>
          </Section>
          <Section title="Insights">
            <Card className="flex flex-col gap-3">{insights(snap, month).map((t) => <Tip key={t} icon={CircleAlert} text={t} />)}</Card>
          </Section>
        </aside>
      </div>

      {(["expense", "income"] as const).map((kind) => (
        <FixedList key={kind} snap={snap} month={month} kind={kind} busy={busy}
          onAdd={() => setEdit({ kind })} onEdit={(item) => setEdit({ kind, item })} onSettle={(r) => settle({ recurring: r })} />
      ))}

      <Section icon={Users} title="Gastos por Pessoa">
        <Card className="flex flex-col gap-4">
          <div role="tablist" aria-label="Período" className="grid grid-cols-2 gap-1 rounded-md bg-surface p-1">
            {([["month", "Este Mês"], ["year", "Este Ano"]] as const).map(([v, l]) => (
              <button key={v} type="button" role="tab" aria-selected={period === v} onClick={() => setPeriod(v)}
                className="h-9 rounded-md text-sm font-semibold text-text-muted aria-selected:bg-surface-raised aria-selected:text-text aria-selected:shadow-card">{l}</button>
            ))}
          </div>
          <PeopleBars snap={snap} month={month} period={period} />
        </Card>
      </Section>

      <Section title={`Histórico (últimos ${span} meses)`} action={
        <select aria-label="Período do histórico" className={`${inputClass} !w-auto`} value={span} onChange={(e) => setSpan(Number(e.target.value))}>
          <option value={3}>Últimos 3 meses</option><option value={6}>Últimos 6 meses</option><option value={12}>Últimos 12 meses</option>
        </select>
      }>
        <Card>
          <LineChart months={history.map((p) => p.month)} label={`Entradas, saídas e diferença dos últimos ${span} meses`} series={[
            { label: "Entradas", color: "var(--color-income)", values: history.map((p) => p.incomeCents) },
            { label: "Saídas", color: "var(--color-expense)", values: history.map((p) => p.expenseCents) },
            { label: "Diferença", color: "var(--color-chart-3)", values: history.map((p) => p.incomeCents - p.expenseCents) },
          ]} />
        </Card>
      </Section>

      {day && (
        <Dialog onClose={() => setDay(null)} title={<h2 className="text-lg font-semibold">{longDay(day)}</h2>}>
          <DayEvents events={events.filter((e) => e.date === day)} busy={busy} onSettle={settle} />
        </Dialog>
      )}
      {details && <ClosingDetails closing={closing} month={month} onClose={() => setDetails(false)} />}
      {edit && <RecurringModal snap={snap} kind={edit.kind} item={edit.item} onClose={() => setEdit(null)} onSaved={(m) => toast(m)} />}
    </div>
  );
}

/* ------------------------------- Agenda financeira ------------------------------- */

function Agenda({ month, now, events, onPick }: { month: string; now: string; events: AgendaEvent[]; onPick: (d: string) => void }) {
  const first = new Date(month + "T00:00:00Z").getUTCDay();
  const n = daysInMonth(month);
  const byDay = new Map<string, AgendaEvent[]>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
        <CalendarDays aria-hidden className="size-4" />Agenda financeira
      </h2>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-text-muted">
        {WEEK.map((w) => <span key={w}>{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: first }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: n }, (_, i) => {
          const d = `${month.slice(0, 8)}${String(i + 1).padStart(2, "0")}`;
          const ev = byDay.get(d) ?? [];
          const isToday = d === now;
          const kinds = new Set(ev.map((e) => e.kind));
          return (
            <button key={d} type="button" onClick={() => onPick(d)} aria-current={isToday ? "date" : undefined}
              aria-label={`${longDay(d)}${ev.length ? `, ${ev.length} ${ev.length === 1 ? "evento" : "eventos"}` : ""}`}
              className={`flex h-11 flex-col items-center justify-center gap-0.5 rounded-md text-sm hover:bg-surface ${isToday ? "bg-accent font-bold text-on-accent hover:bg-accent" : ""}`}>
              {i + 1}
              <span className="flex h-1.5 gap-0.5">
                {kinds.has("income") && <span className={`size-1.5 rounded-pill ${isToday ? "bg-on-accent" : "bg-income"}`} />}
                {kinds.has("expense") && <span className={`size-1.5 rounded-pill ${isToday ? "bg-on-accent" : "bg-expense"}`} />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-pill bg-income" />Receita a receber</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-pill bg-expense" />Despesa a pagar</span>
      </div>
    </Card>
  );
}

function DayEvents({ events, busy, onSettle }: { events: AgendaEvent[]; busy: string | null; onSettle: (e: AgendaEvent) => void }) {
  if (!events.length) return <p className="py-6 text-center text-text-muted">Nenhum evento neste dia</p>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {events.map((e) => (
        <li key={e.id} className="flex items-center gap-3 py-3">
          <span className={`grid size-9 shrink-0 place-items-center rounded-pill ${e.kind === "income" ? "bg-income/15 text-income" : "bg-expense/15 text-expense"}`}>
            {e.kind === "income" ? <TrendingUp aria-hidden className="size-4" /> : <TrendingDown aria-hidden className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{e.label}</p>
            <p className="text-xs text-text-muted">{e.type}</p>
          </div>
          <span className={`num shrink-0 font-semibold ${e.kind === "income" ? "text-income" : "text-expense"}`}>{e.kind === "income" ? "+" : "-"}{formatBRL(e.amountCents)}</span>
          {e.ref.cardId ? <Link href="/cartoes" className="shrink-0 text-sm font-semibold text-accent">Ver fatura</Link> : (
            <Button size="sm" variant="secondary" loading={busy === e.id || busy === e.ref.recurringId} onClick={() => onSettle(e)}>
              {e.kind === "income" ? "Receber" : "Pagar"}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------- Fechamento do mês ------------------------------- */

function Composition({ income, expense }: { income: number; expense: number }) {
  const total = income + expense;
  return (
    <div className="flex flex-col gap-2 text-sm">
      {total > 0 && (
        <div className="flex h-2.5 overflow-hidden rounded-pill bg-surface" aria-hidden>
          <span className="bg-income" style={{ width: `${(income / total) * 100}%` }} />
          <span className="bg-expense" style={{ width: `${(expense / total) * 100}%` }} />
        </div>
      )}
      <div className="flex justify-between"><span className="flex items-center gap-2"><span className="size-2 rounded-pill bg-income" />Receitas</span><span className="num">{formatBRL(income)}</span></div>
      <div className="flex justify-between"><span className="flex items-center gap-2"><span className="size-2 rounded-pill bg-expense" />Despesas</span><span className="num">{formatBRL(expense)}</span></div>
    </div>
  );
}

function Line({ name, v, cls }: { name: string; v: number; cls: string }) {
  return <div className="flex justify-between py-1.5 text-sm"><span>{name}</span><span className={`num font-medium ${cls}`}>{formatBRL(v)}</span></div>;
}

function ClosingDetails({ closing: c, month, onClose }: { closing: ReturnType<typeof monthClosing>; month: string; onClose: () => void }) {
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(month + "T00:00:00Z"));
  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-semibold">Fechamento de {label}</h2>}>
      <div className="flex flex-col gap-4">
        <div className="rounded-md bg-surface p-4 text-center">
          <p className="text-sm text-text-muted">Resultado do mês</p>
          <p className={`num text-3xl font-bold ${tone(c.resultCents)}`}>{signed(c.resultCents)}</p>
        </div>
        <div>
          <h3 className="flex items-center justify-between border-b border-border pb-1.5 font-semibold text-income">
            <span className="flex items-center gap-2"><TrendingUp aria-hidden className="size-4" />Entradas</span><span className="num">{formatBRL(c.incomeCents)}</span>
          </h3>
          <Line name="Receitas avulsas" v={c.looseIncomeCents} cls="text-income" />
          <Line name="Receitas fixas" v={c.fixedIncomeCents} cls="text-income" />
        </div>
        <div>
          <h3 className="flex items-center justify-between border-b border-border pb-1.5 font-semibold text-expense">
            <span className="flex items-center gap-2"><TrendingDown aria-hidden className="size-4" />Saídas</span><span className="num">{formatBRL(c.expenseCents)}</span>
          </h3>
          <Line name="Despesas avulsas" v={c.looseExpenseCents} cls="text-expense" />
          <Line name="Gastos fixos" v={c.fixedExpenseCents} cls="text-expense" />
        </div>
        <p className="text-xs text-text-muted">Inclui o que já foi lançado no mês, pago ou não, e os fixos que ainda vão ser lançados.</p>
      </div>
    </Dialog>
  );
}

/* ------------------------------- Fixos ------------------------------- */

function FixedList({ snap, month, kind, busy, onAdd, onEdit, onSettle }: {
  snap: Snapshot; month: string; kind: Recurring["kind"]; busy: string | null;
  onAdd: () => void; onEdit: (r: Recurring) => void; onSettle: (r: Recurring) => void;
}) {
  const income = kind === "income";
  const all = (snap.recurring ?? []).filter((r) => r.kind === kind).sort((a, b) => a.day - b.day || a.description.localeCompare(b.description, "pt-BR"));
  const active = activeRecurring(snap, month, kind);
  const total = active.reduce((a, r) => a + r.amountCents, 0);
  const cat = (id: string | null) => snap.categories.find((c) => c.id === id)?.name;
  return (
    <Section icon={income ? HandCoins : Repeat} title={income ? "Receitas Fixas Mensais" : "Gastos Fixos"}
      action={<Button size="sm" onClick={onAdd}><Plus aria-hidden className="size-4" />Adicionar</Button>}>
      <Card className="flex flex-col gap-2">
        <div className="flex items-start justify-between border-b border-border pb-3">
          <span className="font-semibold">Resumo</span>
          <div className="text-right">
            <p className={`num text-xl font-bold ${income ? "text-income" : ""}`}>{formatBRL(total)}</p>
            <p className="text-xs text-text-muted">{active.length} {income ? (active.length === 1 ? "receita ativa" : "receitas ativas") : (active.length === 1 ? "gasto ativo" : "gastos ativos")}</p>
          </div>
        </div>
        {all.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {all.map((r) => {
              const on = active.includes(r);
              const done = on ? recurringLaunch(snap, r, month) : undefined;
              return (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <button type="button" onClick={() => onEdit(r)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Editar ${r.description}`}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-pill bg-surface text-xs font-bold">{r.day}</span>
                    <span className="min-w-0">
                      <span className={`block truncate font-medium ${on ? "" : "text-text-muted line-through"}`}>{r.description}</span>
                      <span className="block truncate text-xs text-text-muted">Todo dia {r.day}{cat(r.categoryId) ? ` · ${cat(r.categoryId)}` : ""}{on ? "" : " · inativo"}</span>
                    </span>
                  </button>
                  <span className={`num shrink-0 font-semibold ${income ? "text-income" : "text-expense"}`}>{formatBRL(r.amountCents)}</span>
                  {on && (done ? <span className="w-20 shrink-0 text-center text-xs font-semibold text-income">{income ? "Recebida" : "Pago"}</span> : (
                    <Button size="sm" variant="secondary" className="w-20 shrink-0" loading={busy === r.id} onClick={() => onSettle(r)}>{income ? "Receber" : "Pagar"}</Button>
                  ))}
                </li>
              );
            })}
          </ul>
        ) : <p className="py-8 text-center text-sm text-text-muted">{income ? "Nenhuma receita fixa cadastrada" : "Nenhum gasto fixo cadastrado"}</p>}
      </Card>
    </Section>
  );
}

/* ------------------------------- Pessoas, dicas e insights ------------------------------- */

function PeopleBars({ snap, month, period }: { snap: Snapshot; month: string; period: "month" | "year" }) {
  const sums = expensesByPerson(snap, month, period);
  const slices = snap.people.filter((p) => (sums.get(p.id) ?? 0) > 0).map((p) => ({ id: p.id, label: p.name, cents: sums.get(p.id)! }))
    .sort((a, b) => b.cents - a.cents);
  return slices.length ? <Bars slices={slices} color="var(--color-accent)" />
    : <p className="py-10 text-center text-sm text-text-muted">Nenhum gasto associado a pessoas neste período</p>;
}

function Tip({ icon: Icon = Lightbulb, title, text }: { icon?: typeof Lightbulb; title?: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-md border border-border p-3 text-sm">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-text-muted" />
      <div>{title && <p className="font-semibold">{title}</p>}<p className="text-text-muted">{text}</p></div>
    </div>
  );
}

function savings(s: Snapshot, month: string): { title: string; text: string }[] {
  const out: { title: string; text: string }[] = [];
  for (const u of categoryUsage(s, month)) {
    if (u.limitCents && u.spentCents > u.limitCents) {
      const name = s.categories.find((c) => c.id === u.categoryId)?.name ?? "Categoria";
      out.push({ title: `${name} passou do limite`, text: `Gastou ${formatBRL(u.spentCents - u.limitCents)} além dos ${formatBRL(u.limitCents)} planejados.` });
    }
  }
  if (!activeRecurring(s, month, "expense").length) {
    out.push({ title: "Cadastre seus gastos fixos", text: "Registre suas contas mensais (aluguel, internet, etc.) para ter melhor controle do seu orçamento." });
  }
  if (!s.categories.some((c) => c.monthlyLimitCents && !c.archived)) {
    out.push({ title: "Defina limites por categoria", text: "Com um limite mensal, o Sobra avisa quando um gasto passar do planejado." });
  }
  return out.length ? out : [{ title: "Tudo dentro do planejado", text: "Nenhuma categoria passou do limite neste mês." }];
}

function insights(s: Snapshot, month: string): string[] {
  const tx = monthTransactions(s, month);
  if (tx.length < 5) return ["Registre mais transações para obter insights personalizados"];
  const out: string[] = [];
  const top = totalsByCategory(s, month, "expense")[0];
  const spent = tx.filter((t) => t.kind === "expense").reduce((a, t) => a + t.amountCents, 0);
  if (top && spent) out.push(`${top.label} é sua maior despesa: ${Math.round((top.cents / spent) * 100)}% do que saiu no mês.`);
  const prev = monthSeries(s, addMonths(month, -1), 1)[0];
  if (prev.expenseCents) {
    const diff = Math.round(((spent - prev.expenseCents) / prev.expenseCents) * 100);
    out.push(diff === 0 ? "Você gastou o mesmo que no mês passado." : `Você gastou ${Math.abs(diff)}% ${diff > 0 ? "a mais" : "a menos"} que no mês passado.`);
  }
  const income = tx.filter((t) => t.kind === "income").reduce((a, t) => a + t.amountCents, 0);
  if (income) out.push(`Você está guardando ${Math.round(((income - spent) / income) * 100)}% do que recebeu.`);
  return out;
}
