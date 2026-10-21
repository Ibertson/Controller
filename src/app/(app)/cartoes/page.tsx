"use client";

import { useState } from "react";
import { CreditCard, Pencil, Plus } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { CardModal, cardBackground } from "@/components/CardModal";
import { TransactionList } from "@/components/TransactionList";
import { Button, Card, ProgressBar, Skeleton } from "@/components/ui";
import { repo, useSnapshot } from "@/lib/data";
import { formatBRL } from "@/lib/money";
import { monthLabel, monthOf, today } from "@/lib/dates";
import type { Card as CardT, Snapshot } from "@/lib/types";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Limite usado (compras menos pagamentos) e a fatura do mês escolhido. */
function cardFigures(snap: Snapshot, c: CardT, statement: string) {
  const rows = snap.transactions.filter((t) => t.cardId === c.id);
  const sum = (f: (t: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((a, t) => a + t.amountCents, 0);
  const used = sum((t) => t.kind === "expense") - sum((t) => t.kind === "card_payment");
  const stmtRows = rows.filter((t) => t.kind === "expense" && t.statementMonth === statement);
  const stmtTotal = stmtRows.reduce((a, t) => a + t.amountCents, 0);
  const stmtPaid = sum((t) => t.kind === "card_payment" && t.statementMonth === statement);
  const closed = statement < monthOf(today()) || (statement === monthOf(today()) && Number(today().slice(8)) >= c.closingDay);
  return { used, stmtRows, stmtTotal, stmtPaid, closed };
}

export default function Cartoes() {
  const snap = useSnapshot();
  const { month, setMonth, toast } = useShell();
  const [modal, setModal] = useState<false | "new" | CardT>(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!snap) return <Skeleton className="h-64" />;

  const cards = snap.cards.filter((c) => !c.archived);
  const selected = cards.find((c) => c.id === selectedId) ?? cards[0];
  const year = Number(month.slice(0, 4));
  const mm = Number(month.slice(5, 7));
  const thisYear = Number(today().slice(0, 4));
  const pick = (y: number, m: number) => setMonth(`${y}-${String(m).padStart(2, "0")}-01`);

  async function pay(c: CardT, amount: number) {
    if (!c.paymentAccountId) { toast("Escolha a conta que paga a fatura em Editar cartão."); return setModal(c); }
    if (!confirm(`Pagar ${formatBRL(amount)} da fatura de ${monthLabel(month)}?`)) return;
    await repo.createTransaction({ kind: "card_payment", amountCents: amount, occurredOn: today(), description: "Pagamento da fatura", accountId: c.paymentAccountId, cardId: c.id, statementMonth: month });
    toast("Fatura paga");
  }

  const selectClass = "h-9 rounded-md border border-border bg-surface-raised px-2.5 text-sm shadow-card";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Cartões de crédito</h1>
          <p className="text-xs text-text-muted">{cap(monthLabel(month))}</p>
        </div>
        <div className="flex gap-2">
          <label><span className="sr-only">Mês</span>
            <select className={selectClass} value={mm} onChange={(e) => pick(year, Number(e.target.value))}>
              {MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
            </select>
          </label>
          <label><span className="sr-only">Ano</span>
            <select className={selectClass} value={year} onChange={(e) => pick(Number(e.target.value), mm)}>
              {Array.from({ length: 6 }, (_, i) => thisYear - 4 + i).map((y) => <option key={y}>{y}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <button type="button" onClick={() => setModal("new")}
          className="flex h-24 flex-col items-center justify-center gap-2 rounded-lg border-2 sm:h-auto sm:aspect-[1.7] border-dashed border-border text-text-muted hover:border-accent hover:text-accent">
          <Plus aria-hidden className="size-7" />
          <span className="text-sm font-semibold">Novo cartão</span>
        </button>
        {cards.map((c) => {
          const f = cardFigures(snap, c, month);
          return (
            <button key={c.id} type="button" aria-pressed={selected?.id === c.id} onClick={() => setSelectedId(c.id)}
              style={{ background: cardBackground(c) }}
              className="flex aspect-[1.7] flex-col justify-between rounded-lg p-4 text-left text-white shadow-card ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-accent">
              <div className="flex items-start justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-white/80">
                <span className="truncate">{c.bank || "Cartão"}</span>
                <span>{c.brand}</span>
              </div>
              <div>
                <div className="truncate text-base font-semibold">{c.name}</div>
                <div className="num text-sm tracking-widest text-white/80">•••• {c.last4 || "····"}</div>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="text-[11px] text-white/75">Fatura de {MONTHS[mm - 1].toLowerCase()}</div>
                  <div className="num font-bold">{formatBRL(f.stmtTotal)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-white/75">Disponível</div>
                  <div className="num font-semibold">{formatBRL(c.limitCents - f.used)}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {cards.length === 0 && (
        <section className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-12 text-center">
          <CreditCard aria-hidden className="size-8 text-text-muted" />
          <h2 className="font-semibold">Nenhum cartão cadastrado</h2>
          <p className="text-sm text-text-muted">Cadastre um cartão para acompanhar a fatura e o limite.</p>
          <Button className="mt-2" onClick={() => setModal("new")}><Plus aria-hidden className="size-4" />Novo cartão</Button>
        </section>
      )}

      {selected && (() => {
        const f = cardFigures(snap, selected, month);
        const account = snap.accounts.find((a) => a.id === selected.paymentAccountId);
        const person = snap.people.find((p) => p.id === selected.personId);
        return (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{selected.name}</h2>
                <p className="text-xs text-text-muted">
                  Fecha dia {selected.closingDay} · vence dia {selected.dueDay}
                  {account && <> · paga com {account.name}</>}{person && <> · {person.name}</>}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setModal(selected)}><Pencil aria-hidden className="size-4" />Editar</Button>
            </div>
            <div className="mt-3">
              <ProgressBar ratio={selected.limitCents ? f.used / selected.limitCents : 0} label={`Limite usado de ${selected.name}`} />
              <div className="mt-1 text-xs text-text-muted"><span className="num">{formatBRL(f.used)}</span> usados de <span className="num">{formatBRL(selected.limitCents)}</span></div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <span className="font-semibold">Fatura de {monthLabel(month)}</span>
              <div className="flex items-center gap-3">
                <span className="num font-bold text-expense">{formatBRL(f.stmtTotal)}</span>
                {f.stmtTotal > f.stmtPaid && f.closed && <Button size="sm" onClick={() => pay(selected, f.stmtTotal - f.stmtPaid)}>Pagar fatura</Button>}
                {f.stmtTotal > 0 && f.stmtPaid >= f.stmtTotal && <span className="rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">Paga</span>}
              </div>
            </div>
            {f.stmtRows.length ? <div className="mt-2"><TransactionList snap={snap} items={f.stmtRows} onDeleted={toast} /></div>
              : <p className="mt-3 text-text-muted">Nenhuma compra nesta fatura.</p>}
          </Card>
        );
      })()}

      {modal && <CardModal card={modal === "new" ? undefined : modal} onClose={() => setModal(false)} onSaved={toast} />}
    </div>
  );
}
