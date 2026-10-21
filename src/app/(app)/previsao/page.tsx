"use client";

import { Card, PageTitle, Skeleton } from "@/components/ui";
import { useSnapshot } from "@/lib/data";
import { monthLabel, monthOf, today } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { forecast } from "@/lib/summary";

export default function Previsao() {
  const snap = useSnapshot();
  if (!snap) return <Skeleton className="h-64" />;
  const months = forecast(snap, monthOf(today()), 6);

  return (
    <div>
      <PageTitle>Previsão</PageTitle>
      <p className="-mt-2 mb-4 text-text-muted">Saldo dos próximos meses com o que já está lançado: parcelas, faturas, contas a pagar e receitas futuras.</p>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="text-left text-xs text-text-muted">
            <tr className="border-b border-border">
              <th className="p-3 font-semibold">Mês</th>
              <th className="p-3 text-right font-semibold">Entra</th>
              <th className="p-3 text-right font-semibold">Sai</th>
              <th className="p-3 text-right font-semibold">Saldo previsto</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className="border-b border-border last:border-0">
                <td className="p-3 font-medium capitalize">{monthLabel(m.month)}</td>
                <td className="num p-3 text-right text-income">{formatBRL(m.incomeCents)}</td>
                <td className="num p-3 text-right text-expense">{formatBRL(m.expenseCents)}</td>
                <td className={`num p-3 text-right font-semibold ${m.balanceCents < 0 ? "text-expense" : ""}`}>{formatBRL(m.balanceCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
