"use client";

import { useState, type FormEvent } from "react";
import { Landmark, Plus } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { Button, Card, Field, Input, PageTitle, Skeleton, inputClass } from "@/components/ui";
import { repo, useSnapshot } from "@/lib/data";
import { formatBRL, parseBRL } from "@/lib/money";
import { accountBalances, totalBalance } from "@/lib/summary";
import type { AccountKind } from "@/lib/types";

const kinds: Record<AccountKind, string> = { checking: "Conta corrente", savings: "Poupança", wallet: "Dinheiro", other: "Outra" };

export default function Contas() {
  const snap = useSnapshot();
  const { toast } = useShell();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("checking");
  const [initial, setInitial] = useState("");
  const [error, setError] = useState("");

  if (!snap) return <Skeleton className="h-64" />;
  const balances = accountBalances(snap);

  async function save(e: FormEvent) {
    e.preventDefault();
    const neg = initial.trim().startsWith("-");
    const cents = initial.trim() ? parseBRL(initial.replace("-", "")) : 0;
    if (!name.trim()) return setError("Dê um nome para a conta.");
    if (cents === null) return setError("Saldo inválido. Use algo como 1.250,00.");
    await repo.upsertAccount({ name: name.trim(), kind, initialBalanceCents: neg ? -cents : cents, archived: false });
    setName(""); setInitial(""); setError(""); setOpen(false); toast("Conta criada");
  }

  return (
    <div>
      <PageTitle actions={<Button size="sm" variant="secondary" onClick={() => setOpen(!open)}><Plus aria-hidden className="size-4" />Nova conta</Button>}>Contas</PageTitle>
      <Card className="mb-4"><div className="text-xs font-medium text-text-muted">Saldo total</div><div className="num mt-1 text-xl font-bold">{formatBRL(totalBalance(snap))}</div></Card>
      {open && (
        <Card className="mb-4">
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-[1fr_180px_180px_auto] sm:items-end">
            <Field label="Nome" htmlFor="acc-name" error={error}><Input id="acc-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Banco do dia a dia" /></Field>
            <Field label="Tipo" htmlFor="acc-kind">
              <select id="acc-kind" value={kind} onChange={(e) => setKind(e.target.value as AccountKind)} className={inputClass}>
                {Object.entries(kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Saldo de hoje" htmlFor="acc-initial"><Input id="acc-initial" inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} placeholder="0,00" /></Field>
            <Button type="submit">Salvar</Button>
          </form>
        </Card>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {snap.accounts.filter((a) => !a.archived).map((a) => (
          <Card key={a.id}>
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-pill bg-accent-soft text-accent"><Landmark aria-hidden className="size-[18px]" /></span>
              <div className="min-w-0 flex-1"><div className="truncate font-semibold">{a.name}</div><div className="text-xs text-text-muted">{kinds[a.kind]}</div></div>
            </div>
            <div className={`num mt-3 text-lg font-bold ${balances.get(a.id)! < 0 ? "text-expense" : ""}`}>{formatBRL(balances.get(a.id) ?? 0)}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
