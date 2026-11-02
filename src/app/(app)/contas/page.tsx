"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeftRight, ChevronRight, Plus } from "lucide-react";
import { AccountModal, BankAvatar } from "@/components/AccountModals";
import { useShell } from "@/components/AppShell";
import { cardBackground } from "@/components/CardModal";
import { Button, Card, PageTitle, Skeleton } from "@/components/ui";
import { ACCOUNT_KINDS, accountHref, accountTitle, subaccounts } from "@/lib/accounts";
import { useSnapshot } from "@/lib/data";
import { formatBRL } from "@/lib/money";
import { accountBalances, totalBalance } from "@/lib/summary";


export default function Contas() {
  const snap = useSnapshot();
  const { toast, openNew } = useShell();
  const [open, setOpen] = useState(false);

  if (!snap) return <Skeleton className="h-64" />;
  const balances = accountBalances(snap);
  const accounts = snap.accounts.filter((a) => !a.archived && !a.parentId);

  return (
    <div>
      <PageTitle actions={
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => openNew("transfer")}><ArrowLeftRight aria-hidden className="size-4" />Transferir</Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus aria-hidden className="size-4" />Conta</Button>
        </div>
      }>Contas Bancárias</PageTitle>

      {accounts.length === 0 ? (
        <button type="button" onClick={() => setOpen(true)}
          className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-text-muted hover:bg-surface">
          <Plus aria-hidden className="size-6" /><span className="font-semibold">Adicionar primeira conta bancária</span>
        </button>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => {
            const subs = subaccounts(snap, a.id);
            const subTotal = subs.reduce((s, x) => s + (balances.get(x.id) ?? 0), 0);
            const bal = balances.get(a.id) ?? 0;
            return (
              <Link key={a.id} href={accountHref(a.id)} className="block rounded-lg p-4 text-white shadow-card transition-transform hover:-translate-y-0.5"
                style={{ background: cardBackground({ color: a.color ?? "verde" }) }}>
                <div className="flex items-center gap-3">
                  <BankAvatar name={accountTitle(a)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{accountTitle(a)}</div>
                    <div className="truncate text-xs opacity-80">{ACCOUNT_KINDS[a.kind]}{a.label ? ` · ${a.label}` : ""}</div>
                  </div>
                  <ChevronRight aria-hidden className="size-5 opacity-80" />
                </div>
                <div className="mt-3 text-xs opacity-80">Saldo atual</div>
                <div className={`num text-xl font-bold ${bal < 0 ? "text-red-200" : ""}`}>{formatBRL(bal)}</div>
                {subs.length > 0 && <div className="mt-1 text-xs opacity-80">+ {formatBRL(subTotal)} em {subs.length === 1 ? "1 subconta" : `${subs.length} subcontas`}</div>}
              </Link>
            );
          })}
        </div>
      )}

      <Card className="mt-4"><div className="num text-xl font-bold">{formatBRL(totalBalance(snap))}</div><div className="text-xs font-medium text-text-muted">Saldo total</div></Card>
      {open && <AccountModal onClose={() => setOpen(false)} onSaved={(msg) => toast(msg)} />}
    </div>
  );
}
