"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { cashFlow } from "@/lib/business";
import { useSnapshot } from "@/lib/data";
import { monthLabel, today } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

/** Entradas e saídas que passaram pelas contas, mês a mês, com o saldo no fim de cada mês. */
export default function FluxoDeCaixa() {
  const snap = useSnapshot();
  const [year, setYear] = useState(() => Number(today().slice(0, 4)));
  if (!snap) return <Skeleton className="h-64" />;
  const { openingCents, months } = cashFlow(snap, year);
  const sum = (k: "inCents" | "outCents" | "netCents" | "toReceiveCents" | "toPayCents") => months.reduce((a, m) => a + m[k], 0);
  const cur = today().slice(0, 8) + "01";
  const max = Math.max(1, ...months.map((m) => Math.max(m.inCents, m.outCents)));
  return (
    <div className="flex flex-col gap-4">
      <PageTitle actions={
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface-raised p-1">
          <button type="button" aria-label="Ano anterior" onClick={() => setYear(year - 1)} className="rounded-sm p-1.5 hover:bg-surface"><ChevronLeft className="size-4" /></button>
          <span className="num min-w-14 text-center text-sm font-semibold" aria-live="polite">{year}</span>
          <button type="button" aria-label="Próximo ano" onClick={() => setYear(year + 1)} className="rounded-sm p-1.5 hover:bg-surface"><ChevronRight className="size-4" /></button>
        </div>
      }>Fluxo de Caixa</PageTitle>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Saldo em 01/01/${year}`} value={openingCents} />
        <Stat label="Entradas no ano" value={sum("inCents")} tone="in" />
        <Stat label="Saídas no ano" value={-sum("outCents")} tone="out" />
        <Stat label={`Saldo em 31/12/${year}`} value={months[11].closingCents} />
      </div>

      <Card>
        <h2 className="mb-1 text-sm font-semibold">Entradas e saídas por mês</h2>
        <p className="mb-3 text-xs text-text-muted">Só o que já foi recebido ou pago nas contas. Compras no cartão entram quando a fatura é paga.</p>
        <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Gráfico de entradas e saídas por mês">
          {months.map((m) => (
            <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <div className="flex h-full w-full items-end justify-center gap-0.5">
                <div className="w-1/2 max-w-3 rounded-t-sm bg-income" style={{ height: `${(m.inCents / max) * 100}%` }} />
                <div className="w-1/2 max-w-3 rounded-t-sm bg-danger" style={{ height: `${(m.outCents / max) * 100}%` }} />
              </div>
              <span className="text-[10px] capitalize text-text-muted">{monthLabel(m.month).slice(0, 3)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-text-muted">
              <th className="py-2 pr-2 font-semibold">Mês</th>
              <th className="py-2 pr-2 text-right font-semibold" title="Recebido nas contas">Entradas</th>
              <th className="py-2 pr-2 text-right font-semibold" title="Pago pelas contas">Saídas</th>
              <th className="py-2 pr-2 text-right font-semibold" title="Entradas menos saídas">Resultado do mês</th>
              <th className="py-2 pr-2 text-right font-semibold" title="Saldo das contas no último dia do mês">Saldo final</th>
              <th className="py-2 pr-2 text-right font-semibold" title="Lançado para o mês e ainda não recebido">A receber</th>
              <th className="py-2 text-right font-semibold" title="Lançado para o mês e ainda não pago">A pagar</th>
            </tr></thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month} aria-current={m.month === cur ? "date" : undefined} className="border-b border-border last:border-0 aria-[current=date]:bg-accent-soft/50">
                  <td className="py-2 pr-2 capitalize">{monthLabel(m.month).split(" ")[0]}</td>
                  <td className="num py-2 pr-2 text-right text-income">{m.inCents ? formatBRL(m.inCents) : "—"}</td>
                  <td className="num py-2 pr-2 text-right text-danger">{m.outCents ? formatBRL(-m.outCents) : "—"}</td>
                  <td className={`num py-2 pr-2 text-right font-semibold ${m.netCents < 0 ? "text-danger" : m.netCents > 0 ? "text-income" : ""}`}>{formatBRL(m.netCents)}</td>
                  <td className={`num py-2 pr-2 text-right ${m.closingCents < 0 ? "text-danger" : ""}`}>{formatBRL(m.closingCents)}</td>
                  <td className="num py-2 pr-2 text-right text-text-muted">{m.toReceiveCents ? formatBRL(m.toReceiveCents) : "—"}</td>
                  <td className="num py-2 text-right text-text-muted">{m.toPayCents ? formatBRL(-m.toPayCents) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t-2 border-border font-semibold">
              <td className="py-2 pr-2">Total</td>
              <td className="num py-2 pr-2 text-right text-income">{formatBRL(sum("inCents"))}</td>
              <td className="num py-2 pr-2 text-right text-danger">{formatBRL(-sum("outCents"))}</td>
              <td className="num py-2 pr-2 text-right">{formatBRL(sum("netCents"))}</td>
              <td className="num py-2 pr-2 text-right">{formatBRL(months[11].closingCents)}</td>
              <td className="num py-2 pr-2 text-right text-text-muted">{formatBRL(sum("toReceiveCents"))}</td>
              <td className="num py-2 text-right text-text-muted">{formatBRL(-sum("toPayCents"))}</td>
            </tr></tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "in" | "out" }) {
  return (
    <Card>
      <div className="text-xs text-text-muted">{label}</div>
      <div className={`num mt-1 text-lg font-bold ${tone === "in" ? "text-income" : tone === "out" || value < 0 ? "text-danger" : ""}`}>{formatBRL(value)}</div>
    </Card>
  );
}
