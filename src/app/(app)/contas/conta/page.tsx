"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowLeftRight, Calculator, CreditCard, Pencil, PiggyBank, Plus, Scale, Trash2, User } from "lucide-react";
import { AccountModal, BankAvatar, DeleteAccountDialog, RecalcModal, SubaccountModal } from "@/components/AccountModals";
import { useShell } from "@/components/AppShell";
import { cardBackground } from "@/components/CardModal";
import { TransactionList } from "@/components/TransactionList";
import { Button, Card, EmptyState, Skeleton, inputClass } from "@/components/ui";
import { ACCOUNT_KINDS, accountStats, accountTitle, accountTransactions, inMonth, subaccounts } from "@/lib/accounts";
import { useSession, useSnapshot } from "@/lib/data";
import { monthOf, today } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { accountBalances } from "@/lib/summary";
import { accountCardExpenses } from "@/lib/reconcile";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
type Tab = "extrato" | "transferencias" | "subcontas";
type Modal = null | "edit" | "sub" | "recalc" | "delete";

export default function ContaPage() {
  return <Suspense fallback={<Skeleton className="h-64" />}><Conta /></Suspense>;
}

function Conta() {
  const id = useSearchParams().get("id") ?? "";
  const snap = useSnapshot();
  const session = useSession();
  const router = useRouter();
  const { toast, openNew } = useShell();
  const [month, setMonth] = useState(() => monthOf(today()));
  const [tab, setTab] = useState<Tab>("extrato");
  const [modal, setModal] = useState<Modal>(null);
  const chips = useRef<HTMLDivElement>(null);
  const loaded = snap !== undefined;
  // No celular, deixa o mês escolhido à vista na fileira de meses.
  useEffect(() => { chips.current?.querySelector<HTMLElement>("[aria-checked=true]")?.scrollIntoView({ block: "nearest", inline: "center" }); }, [month, loaded]);

  if (!snap) return <Skeleton className="h-64" />;
  const account = snap.accounts.find((a) => a.id === id && !a.archived);
  if (!account) {
    return (
      <EmptyState icon={PiggyBank} title="Conta não encontrada. Ela pode ter sido excluída."
        action={<Link href="/contas" className="font-semibold text-accent underline">Voltar para Contas</Link>} />
    );
  }

  const st = accountStats(snap, account, month);
  const owner = snap.people.find((p) => p.id === account.personId)?.name ?? session?.name ?? "Titular";
  const parent = account.parentId ? snap.accounts.find((a) => a.id === account.parentId) : undefined;
  const monthItems = accountTransactions(snap, account.id).filter((t) => inMonth(t, month));
  const transfers = monthItems.filter((t) => t.kind === "transfer");
  const subs = subaccounts(snap, account.id);
  const balances = accountBalances(snap);
  const year = Number(month.slice(0, 4));
  const thisYear = Number(today().slice(0, 4));
  const years = Array.from(new Set([thisYear - 2, thisYear - 1, thisYear, thisYear + 1, year])).sort();
  const pick = (y: number, m: number) => setMonth(`${y}-${String(m + 1).padStart(2, "0")}-01`);
  const isSub = !!account.parentId;
  const cardExpense = accountCardExpenses(snap, account.id, month);
  const cardCount = snap.cards.filter((c) => c.paymentAccountId === account.id && !c.archived).length;

  const actions = [
    { label: "Transferir", icon: ArrowLeftRight, run: () => openNew("transfer", account.id) },
    ...(isSub ? [] : [{ label: "Subconta", icon: Plus, run: () => setModal("sub") }]),
    ...(isSub ? [] : [{ label: "Editar", icon: Pencil, run: () => setModal("edit") }]),
    { label: "Recalcular", icon: Calculator, run: () => setModal("recalc") },
    ...(isSub ? [] : [{ label: "Conciliação bancária", icon: Scale, run: () => router.push(`/contas/conciliacao?id=${encodeURIComponent(account.id)}`) }]),
  ];

  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-lg p-4 text-white shadow-card"
        style={{ background: isSub ? account.color ?? undefined : cardBackground({ color: account.color ?? "verde" }) }}>
        <div className="flex items-center gap-3">
          <Link href={parent ? `/contas/conta?id=${parent.id}` : "/contas"} aria-label="Voltar" className="-ml-1 rounded-sm p-1 hover:bg-white/15">
            <ArrowLeft className="size-5" />
          </Link>
          <BankAvatar name={accountTitle(account)} />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{accountTitle(account)}</h1>
            <div className="truncate text-xs opacity-80">
              {isSub ? `${account.subKind === "caixinha" ? "Caixinha" : "Poupança"} · ${parent ? accountTitle(parent) : ""}` : ACCOUNT_KINDS[account.kind]}
              {account.label ? ` · ${account.label}` : ""}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs opacity-80">Saldo atual</div>
            <div className="num text-2xl font-bold">{formatBRL(st.balanceCents)}</div>
            <div className="mt-1 flex items-center gap-1 text-xs opacity-90"><User aria-hidden className="size-3.5" />{owner}</div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-80">Total disponível</div>
            <div className="num text-lg font-semibold">{formatBRL(st.availableCents)}</div>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button key={a.label} size="sm" variant="secondary" onClick={a.run}><a.icon aria-hidden className="size-4" />{a.label}</Button>
        ))}
        <Button size="sm" variant="danger" onClick={() => setModal("delete")}><Trash2 aria-hidden className="size-4" />Excluir</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Saldo Conta" value={formatBRL(st.balanceCents)} tone={st.balanceCents < 0 ? "text-expense" : ""} />
        <Stat label="Cheque Especial" value={st.overdraftCents == null ? "Não possui" : formatBRL(st.overdraftCents)} />
        <Stat label="Receitas Mês" value={formatBRL(st.incomeCents)} tone="text-income" />
        <Stat label="Despesas Mês" value={formatBRL(st.expenseCents)} tone="text-expense" />
        {!isSub && (
          <Link href={`/contas/conciliacao?id=${encodeURIComponent(account.id)}&modo=fatura`} className="col-span-2 block lg:col-span-1">
            <Stat label="Despesas Cartão de Crédito" value={formatBRL(cardExpense)} tone="text-expense"
              hint={cardCount ? `${cardCount === 1 ? "1 cartão ligado" : `${cardCount} cartões ligados`}` : "Nenhum cartão ligado"} icon />
          </Link>
        )}
      </div>

      <Card>
        <div className="flex items-center gap-3">
          <label htmlFor="acc-year" className="text-sm font-semibold">Ano</label>
          <select id="acc-year" className={`${inputClass} !h-9 !w-28`} value={year} onChange={(e) => pick(Number(e.target.value), Number(month.slice(5, 7)) - 1)}>
            {years.map((y) => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div ref={chips} role="radiogroup" aria-label="Mês" className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {MONTHS.map((m, i) => {
            const on = Number(month.slice(5, 7)) === i + 1;
            return (
              <button key={m} type="button" role="radio" aria-checked={on} onClick={() => pick(year, i)}
                className="shrink-0 rounded-pill border border-border px-3 py-1.5 text-sm font-medium aria-checked:border-accent aria-checked:bg-accent aria-checked:text-on-accent hover:bg-surface aria-checked:hover:bg-accent">
                {m}
              </button>
            );
          })}
        </div>
      </Card>

      <div>
        <div role="tablist" aria-label="Movimentos da conta" className="mb-3 flex gap-1 rounded-md bg-surface p-1">
          {([["extrato", "Extrato"], ["transferencias", "Transferências"], ...(isSub ? [] : [["subcontas", `Subcontas${subs.length ? ` (${subs.length})` : ""}`]])] as [Tab, string][]).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className="h-9 flex-1 rounded-sm text-sm font-semibold text-text-muted aria-selected:bg-surface-raised aria-selected:text-text aria-selected:shadow-card">
              {label}
            </button>
          ))}
        </div>
        <Card>
          {tab === "extrato" && (monthItems.length
            ? <TransactionList snap={snap} items={monthItems} onDeleted={(m) => toast(m)} />
            : <p className="py-8 text-center text-sm text-text-muted">Nenhuma transação neste mês para esta conta.</p>)}
          {tab === "transferencias" && (transfers.length
            ? <TransactionList snap={snap} items={transfers} onDeleted={(m) => toast(m)} />
            : <p className="py-8 text-center text-sm text-text-muted">Nenhuma transferência neste mês para esta conta.</p>)}
          {tab === "subcontas" && !isSub && (
            <div>
              {subs.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-muted">Nenhuma subconta. Crie uma poupança ou caixinha para separar dinheiro desta conta.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {subs.map((s) => (
                    <li key={s.id}>
                      <Link href={`/contas/conta?id=${s.id}`} className="flex items-center gap-3 py-3 hover:bg-surface">
                        <span aria-hidden className="size-3 rounded-pill" style={{ background: s.color ?? "#0b7a5e" }} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{s.name}</div>
                          <div className="text-xs text-text-muted">{s.subKind === "caixinha" ? "Caixinha" : "Poupança"}</div>
                        </div>
                        <span className="num font-semibold">{formatBRL(balances.get(s.id) ?? 0)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex justify-center">
                <Button size="sm" variant="secondary" onClick={() => setModal("sub")}><Plus aria-hidden className="size-4" />Nova Subconta</Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {modal === "edit" && <AccountModal account={account} onClose={() => setModal(null)} onSaved={(m) => toast(m)} />}
      {modal === "sub" && <SubaccountModal parent={account} onClose={() => setModal(null)} onSaved={(m) => { toast(m); setTab("subcontas"); }} />}
      {modal === "recalc" && <RecalcModal account={account} onClose={() => setModal(null)} onSaved={(m) => toast(m)} />}
      {modal === "delete" && <DeleteAccountDialog account={account} onClose={() => setModal(null)}
        onDeleted={() => { toast("Conta excluída"); router.replace(parent ? `/contas/conta?id=${parent.id}` : "/contas"); }} />}
    </div>
  );
}

function Stat({ label, value, tone = "", hint, icon }: { label: string; value: string; tone?: string; hint?: string; icon?: boolean }) {
  return (
    <Card className="h-full p-3">
      <div className="flex items-center gap-1 text-xs font-medium text-text-muted">{icon && <CreditCard aria-hidden className="size-3.5" />}{label}</div>
      <div className={`num mt-1 text-base font-bold ${tone}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-text-muted">{hint}</div>}
    </Card>
  );
}
