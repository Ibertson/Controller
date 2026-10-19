"use client";

import { useState, type FormEvent } from "react";
import { CreditCard, Plus } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { TransactionList } from "@/components/TransactionList";
import { Button, Card, EmptyState, Field, Input, PageTitle, ProgressBar, Skeleton, inputClass } from "@/components/ui";
import { repo, useSnapshot } from "@/lib/data";
import { formatBRL, parseBRL } from "@/lib/money";
import { addMonths, monthLabel, monthOf, statementMonthFor, today } from "@/lib/dates";

export default function Cartoes() {
  const snap = useSnapshot();
  const { toast } = useShell();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", limit: "", closing: "5", due: "12" });
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);

  if (!snap) return <Skeleton className="h-64" />;

  async function save(e: FormEvent) {
    e.preventDefault();
    const limit = parseBRL(form.limit);
    if (!form.name.trim()) return setError("Dê um nome para o cartão.");
    if (!limit) return setError("Informe o limite.");
    await repo.upsertCard({ name: form.name.trim(), limitCents: limit, closingDay: Number(form.closing), dueDay: Number(form.due), paymentAccountId: snap!.accounts[0]?.id ?? null, archived: false });
    setForm({ name: "", limit: "", closing: "5", due: "12" }); setError(""); setOpen(false); toast("Cartão criado");
  }

  async function pay(cardId: string, statement: string, amount: number, accountId: string | null) {
    if (!accountId) return toast("Escolha uma conta de pagamento para o cartão.");
    if (!confirm(`Pagar ${formatBRL(amount)} da fatura de ${monthLabel(statement)}?`)) return;
    await repo.createTransaction({ kind: "card_payment", amountCents: amount, occurredOn: today(), description: "Pagamento da fatura", accountId, cardId, statementMonth: statement });
    toast("Fatura paga");
  }

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));

  return (
    <div>
      <PageTitle actions={<Button size="sm" variant="secondary" onClick={() => setOpen(!open)}><Plus aria-hidden className="size-4" />Novo cartão</Button>}>Cartões</PageTitle>
      {open && (
        <Card className="mb-4">
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-[1fr_160px_110px_110px_auto] sm:items-end">
            <Field label="Nome" htmlFor="c-name" error={error}><Input id="c-name" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Cartão principal" /></Field>
            <Field label="Limite" htmlFor="c-limit"><Input id="c-limit" inputMode="decimal" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} placeholder="5.000,00" /></Field>
            <Field label="Fecha dia" htmlFor="c-close"><select id="c-close" className={inputClass} value={form.closing} onChange={(e) => setForm({ ...form, closing: e.target.value })}>{days.map((d) => <option key={d}>{d}</option>)}</select></Field>
            <Field label="Vence dia" htmlFor="c-due"><select id="c-due" className={inputClass} value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })}>{days.map((d) => <option key={d}>{d}</option>)}</select></Field>
            <Button type="submit">Salvar</Button>
          </form>
        </Card>
      )}
      {snap.cards.length === 0 && !open && (
        <Card><EmptyState icon={CreditCard} title="Cadastre um cartão para acompanhar a fatura e o limite."
          action={<Button onClick={() => setOpen(true)}><Plus aria-hidden className="size-4" />Novo cartão</Button>} /></Card>
      )}
      <div className="flex flex-col gap-4">
        {snap.cards.filter((c) => !c.archived).map((c) => {
          const current = addMonths(statementMonthFor(today(), c.closingDay), offset);
          const rows = snap.transactions.filter((t) => t.cardId === c.id);
          const spent = rows.filter((t) => t.kind === "expense").reduce((a, t) => a + t.amountCents, 0);
          const paid = rows.filter((t) => t.kind === "card_payment").reduce((a, t) => a + t.amountCents, 0);
          const used = spent - paid;
          const stmtRows = rows.filter((t) => t.kind === "expense" && t.statementMonth === current);
          const stmtTotal = stmtRows.reduce((a, t) => a + t.amountCents, 0);
          const stmtPaid = rows.filter((t) => t.kind === "card_payment" && t.statementMonth === current).reduce((a, t) => a + t.amountCents, 0);
          const isPast = current < monthOf(today()) || (current === monthOf(today()) && Number(today().slice(8)) >= c.closingDay);
          return (
            <Card key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-text-muted">Fecha dia {c.closingDay} · vence dia {c.dueDay}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-text-muted">Limite disponível</div>
                  <div className="num font-bold">{formatBRL(c.limitCents - used)}</div>
                </div>
              </div>
              <ProgressBar ratio={c.limitCents ? used / c.limitCents : 0} label={`Limite usado de ${c.name}`} />
              <div className="mt-1 text-xs text-text-muted"><span className="num">{formatBRL(used)}</span> usados de <span className="num">{formatBRL(c.limitCents)}</span></div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <button aria-label="Fatura anterior" onClick={() => setOffset(offset - 1)} className="rounded-sm border border-border px-2 py-1">‹</button>
                  <span className="font-semibold">Fatura de {monthLabel(current)}</span>
                  <button aria-label="Próxima fatura" onClick={() => setOffset(offset + 1)} className="rounded-sm border border-border px-2 py-1">›</button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="num font-bold text-expense">{formatBRL(stmtTotal)}</span>
                  {stmtTotal > stmtPaid && isPast && <Button size="sm" onClick={() => pay(c.id, current, stmtTotal - stmtPaid, c.paymentAccountId)}>Pagar fatura</Button>}
                  {stmtTotal > 0 && stmtPaid >= stmtTotal && <span className="rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">Paga</span>}
                </div>
              </div>
              {stmtRows.length ? <div className="mt-2"><TransactionList snap={snap} items={stmtRows} onDeleted={toast} /></div>
                : <p className="mt-3 text-text-muted">Nenhuma compra nesta fatura.</p>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
