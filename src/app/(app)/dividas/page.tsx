"use client";

import { useState } from "react";
import { CalendarClock, CalendarDays, CircleCheck, DollarSign, Pencil, Plus, Trash2, TrendingDown, Undo2, User, Wallet } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { DebtModal } from "@/components/DebtModal";
import { Button, Card, Skeleton } from "@/components/ui";
import { repo, useSnapshot } from "@/lib/data";
import { addMonths, monthOf, today } from "@/lib/dates";
import { debtSummary, debtTypeLabel, extraCostTotals, isPaidOff, lastDue, nextDue, paidCents, remainingCents } from "@/lib/debts";
import { formatBRL } from "@/lib/money";
import type { Debt } from "@/lib/types";

const fmtDate = (d: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(d + "T00:00:00Z"));
const fmtMonth = (m: string) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(m + "T00:00:00Z"));
const pct = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export default function Dividas() {
  const snap = useSnapshot();
  const { toast } = useShell();
  const [view, setView] = useState<"dividas" | "financiamentos">("dividas");
  const [tab, setTab] = useState<"active" | "done">("active");
  const [form, setForm] = useState<null | { debt?: Debt }>(null);

  if (!snap) return <Skeleton className="h-64" />;
  const financing = view === "financiamentos";
  const all = (snap.debts ?? []).filter((d) => !financing || d.type === "financiamento");
  const sum = debtSummary(all);
  const active = all.filter((d) => !isPaidOff(d)), done = all.filter(isPaidOff);
  const list = (tab === "active" ? active : done).sort((a, b) => (nextDue(a) ?? "9999").localeCompare(nextDue(b) ?? "9999") || a.name.localeCompare(b.name, "pt-BR"));
  const person = (id: string | null) => snap.people.find((p) => p.id === id)?.name;

  async function pay(d: Debt, delta: 1 | -1) {
    const paid = Math.min(d.installmentsTotal, Math.max(0, d.installmentsPaid + delta));
    await repo.upsertDebt({ ...d, installmentsPaid: paid });
    const msg = delta > 0
      ? paid >= d.installmentsTotal ? `${d.name} quitada!` : `Parcela ${paid} de ${d.installmentsTotal} paga`
      : `Pagamento da parcela ${d.installmentsPaid} desfeito`;
    toast(msg, { label: "Desfazer", run: () => void repo.upsertDebt(d) });
  }
  async function remove(d: Debt) {
    if (!confirm(`Excluir "${d.name}"?`)) return;
    await repo.deleteDebt(d.id);
    toast("Dívida excluída", { label: "Desfazer", run: () => void repo.upsertDebt(d) });
  }

  const stats = [
    ["Dívida Total", formatBRL(sum.totalCents), DollarSign, ""],
    ["Já Pago", formatBRL(sum.paidCents), TrendingDown, "text-income"],
    ["Restante", formatBRL(sum.remainingCents), CalendarClock, "text-expense"],
    ["Parcelas/Mês", formatBRL(sum.monthlyCents), CalendarDays, ""],
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Tipo" className="grid grid-cols-2 gap-1 rounded-md bg-surface p-1">
        {([["dividas", "Dívidas"], ["financiamentos", "Financiamentos"]] as const).map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => { setView(v); setTab("active"); }}
            className="h-9 rounded-md text-sm font-semibold text-text-muted aria-selected:bg-surface-raised aria-selected:text-text aria-selected:shadow-card">{l}</button>
        ))}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{financing ? "Financiamentos" : "Dívidas Parceladas"}</h1>
          <p className="text-sm text-text-muted">{financing ? "Acompanhe seus financiamentos, o bem e os custos extras" : "Acompanhe e gerencie suas dívidas e financiamentos"}</p>
        </div>
        <Button onClick={() => setForm({})}><Plus aria-hidden className="size-4" />{financing ? "Novo Financiamento" : "Nova Dívida"}</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([label, value, Icon, tone]) => (
          <Card key={label} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 text-sm text-text-muted">{label}<Icon aria-hidden className={`size-4 shrink-0 ${tone}`} /></div>
            <p className={`num whitespace-nowrap text-base font-bold sm:text-2xl ${tone}`}>{value}</p>
          </Card>
        ))}
      </div>

      <div role="tablist" aria-label="Situação" className="mx-auto grid grid-cols-2 gap-1 rounded-md bg-surface p-1 sm:w-64">
        {([["active", `Ativas (${active.length})`], ["done", `Quitadas (${done.length})`]] as const).map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className="h-8 rounded-md px-3 text-sm font-medium text-text-muted aria-selected:bg-surface-raised aria-selected:text-text aria-selected:shadow-card">{l}</button>
        ))}
      </div>

      {!list.length ? (
        <Card className="flex flex-col items-center gap-1 py-12 text-center">
          <Wallet aria-hidden className="size-12 text-text-muted" strokeWidth={1.5} />
          <p className="mt-2 font-semibold">{tab === "active" ? `Nenhum${financing ? " financiamento ativo" : "a dívida ativa"}` : `Nenhum${financing ? " financiamento quitado" : "a dívida quitada"}`}</p>
          <p className="text-sm text-text-muted">{tab === "active"
            ? financing ? "Adicione seus financiamentos para acompanhar parcelas, o bem e os custos extras." : "Adicione suas dívidas parceladas para acompanhar os pagamentos."
            : "Quando todas as parcelas forem pagas, a dívida aparece aqui."}</p>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {list.map((d) => {
            const ratio = d.installmentsPaid / d.installmentsTotal;
            const next = nextDue(d);
            const late = !!next && next < today();
            const extra = extraCostTotals(d);
            const ready = d.monthsToReady ? addMonths(monthOf(d.startOn), d.monthsToReady) : null;
            const meta = [d.creditor, d.category, person(d.personId)].filter(Boolean);
            return (
              <li key={d.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold">{d.name}</h2>
                      <span className="rounded-pill bg-surface px-2 py-0.5 text-xs font-semibold text-text-muted">{debtTypeLabel(d.type)}</span>
                      {isPaidOff(d) && <span className="flex items-center gap-1 rounded-pill bg-income px-2 py-0.5 text-xs font-semibold text-white"><CircleCheck aria-hidden className="size-3.5" />Quitada</span>}
                    </div>
                    {meta.length > 0 && <p className="truncate text-sm text-text-muted">{meta.join(" · ")}</p>}
                  </div>
                  <span className="flex shrink-0 gap-1">
                    <button type="button" aria-label={`Editar ${d.name}`} title="Editar" onClick={() => setForm({ debt: d })}
                      className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-surface hover:text-text"><Pencil aria-hidden className="size-4" /></button>
                    <button type="button" aria-label={`Excluir ${d.name}`} title="Excluir" onClick={() => void remove(d)}
                      className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-surface hover:text-danger"><Trash2 aria-hidden className="size-4" /></button>
                  </span>
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span><span className="num font-semibold">{d.installmentsPaid}</span> de <span className="num">{d.installmentsTotal}</span> parcelas</span>
                    <span className="num text-text-muted">{formatBRL(d.installmentCents)}/mês</span>
                  </div>
                  <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} aria-label={`Parcelas pagas de ${d.name}`}
                    className="mt-1.5 h-2.5 overflow-hidden rounded-pill bg-surface">
                    <span className={`block h-full rounded-pill ${isPaidOff(d) ? "bg-income" : "bg-accent"}`} style={{ width: `${ratio * 100}%` }} />
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-xs text-text-muted">Total</dt><dd className="num font-semibold">{formatBRL(d.totalCents)}</dd></div>
                  <div><dt className="text-xs text-text-muted">Pago</dt><dd className="num font-semibold text-income">{formatBRL(paidCents(d))}</dd></div>
                  <div><dt className="text-xs text-text-muted">Restante</dt><dd className="num font-semibold text-expense">{formatBRL(remainingCents(d))}</dd></div>
                </dl>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                  {next ? <span className={`flex items-center gap-1 ${late ? "font-semibold text-expense" : ""}`}><CalendarDays aria-hidden className="size-3.5" />{late ? "Atrasada desde" : "Próxima parcela"} {fmtDate(next)}</span>
                    : <span>Última parcela em {fmtDate(lastDue(d))}</span>}
                  {d.interestRate ? <span>Juros {pct(d.interestRate)} a.m.</span> : null}
                  {person(d.personId) && <span className="flex items-center gap-1"><User aria-hidden className="size-3.5" />{person(d.personId)}</span>}
                </div>
                {d.type === "financiamento" && (d.assetDescription || d.assetFinalCents || ready || d.extraCosts.length > 0 || d.commissionCents > 0) && (
                  <div className="flex flex-col gap-1 rounded-md bg-surface p-3 text-sm">
                    {d.assetDescription && <p className="font-medium">{d.assetDescription}</p>}
                    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                      {d.assetFinalCents ? <span>Valor final do bem: <span className="num font-semibold text-text">{formatBRL(d.assetFinalCents)}</span></span> : null}
                      {d.commissionCents > 0 && <span>Comissão: <span className="num">{formatBRL(d.commissionCents)}</span>{d.commissionPct != null && ` (${pct(d.commissionPct)})`}{d.seller && ` · ${d.seller}`}</span>}
                      {ready && <span>Pronto em {fmtMonth(ready)}</span>}
                    </p>
                    {d.extraCosts.length > 0 && (
                      <p className="text-xs text-text-muted">Custos extras: {[
                        extra.unico && `${formatBRL(extra.unico)} único`, extra.mensal && `${formatBRL(extra.mensal)}/mês`, extra.anual && `${formatBRL(extra.anual)}/ano`,
                      ].filter(Boolean).join(" · ")} ({d.extraCosts.map((c) => c.name).join(", ")})</p>
                    )}
                  </div>
                )}
                {d.notes && <p className="line-clamp-2 text-sm text-text-muted">{d.notes}</p>}
                <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-3">
                  {!isPaidOff(d) && <Button size="sm" onClick={() => void pay(d, 1)}><CircleCheck aria-hidden className="size-4" />Pagar parcela</Button>}
                  {d.installmentsPaid > 0 && <Button size="sm" variant="secondary" onClick={() => void pay(d, -1)}><Undo2 aria-hidden className="size-4" />Desfazer pagamento</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {form && <DebtModal snap={snap} debt={form.debt} defaultType="financiamento"
        onClose={() => setForm(null)} onSaved={(m) => toast(m)} />}
    </div>
  );
}
