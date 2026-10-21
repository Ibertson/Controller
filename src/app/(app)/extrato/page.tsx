"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { Card, EmptyState, PageTitle, Skeleton, inputClass } from "@/components/ui";
import { useSnapshot } from "@/lib/data";
import { dayLabel } from "@/lib/dates";
import { formatBRL, formatSigned } from "@/lib/money";
import { accountStatement } from "@/lib/summary";

export default function Extrato() {
  const snap = useSnapshot();
  const { month } = useShell();
  const [chosen, setChosen] = useState("");

  if (!snap) return <Skeleton className="h-64" />;
  const accounts = snap.accounts.filter((a) => !a.archived);
  const accountId = chosen || accounts[0]?.id || "";
  if (!accountId) return <div><PageTitle>Extrato</PageTitle><Card><EmptyState icon={FileText} title="Cadastre uma conta para ver o extrato." /></Card></div>;
  const st = accountStatement(snap, accountId, month);

  return (
    <div>
      <PageTitle>Extrato</PageTitle>
      <select aria-label="Conta" value={accountId} onChange={(e) => setChosen(e.target.value)} className={`${inputClass} mb-4 sm:w-72`}>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <Card className="p-0">
        <div className="flex justify-between border-b border-border p-3 text-sm"><span className="text-text-muted">Saldo no início do mês</span><span className="num font-semibold">{formatBRL(st.openingCents)}</span></div>
        {st.lines.length ? (
          <ul>
            {st.lines.map(({ transaction: t, deltaCents, balanceCents }) => (
              <li key={t.id} className="grid grid-cols-[1fr_auto] gap-x-3 border-b border-border p-3 text-sm sm:grid-cols-[7rem_1fr_auto_8rem]">
                <span className="text-xs text-text-muted sm:text-sm">{dayLabel(t.occurredOn)}</span>
                <span className="col-start-1 truncate sm:col-start-2">{t.description || (t.kind === "transfer" ? "Transferência" : t.kind === "card_payment" ? "Pagamento de fatura" : "Lançamento")}</span>
                <span className={`num row-start-1 text-right font-semibold sm:row-auto ${deltaCents < 0 ? "text-expense" : "text-income"}`}>
                  {formatSigned(Math.abs(deltaCents), deltaCents < 0 ? "expense" : "income")}
                </span>
                <span className="num text-right text-text-muted">{formatBRL(balanceCents)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="p-6 text-center text-text-muted">Nenhum movimento pago nesta conta no mês.</p>}
        <div className="flex justify-between p-3 text-sm"><span className="text-text-muted">Saldo no fim do mês</span><span className="num font-semibold">{formatBRL(st.closingCents)}</span></div>
      </Card>
    </div>
  );
}
