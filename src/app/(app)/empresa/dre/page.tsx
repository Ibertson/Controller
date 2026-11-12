"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { MonthPicker } from "@/components/MonthPicker";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { dre, type DreGroup } from "@/lib/business";
import { useSnapshot } from "@/lib/data";
import { monthLabel } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

/** Demonstração do Resultado do mês: receita, impostos, custos, despesas e o resultado líquido. */
export default function DrePage() {
  const snap = useSnapshot();
  const { month, setMonth } = useShell();
  const [open, setOpen] = useState<DreGroup | null>(null);
  if (!snap) return <Skeleton className="h-64" />;
  const d = dre(snap, month);
  const pctOf = (v: number) => (d.grossCents ? `${((v / d.grossCents) * 100).toFixed(1).replace(".", ",")}%` : "—");

  const line = (label: string, cents: number, opts: { minus?: boolean; total?: boolean; group?: DreGroup; hint?: string } = {}) => {
    const expandable = !!opts.group && d.detail[opts.group].length > 0;
    const isOpen = open === opts.group;
    return (
      <>
        <tr className={`border-b border-border ${opts.total ? "bg-surface font-semibold" : ""}`}>
          <td className="py-2 pr-2">
            {expandable ? (
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : opts.group!)} className="flex items-center gap-1 text-left hover:underline">
                <ChevronDown aria-hidden className={`size-4 transition-transform ${isOpen ? "" : "-rotate-90"}`} />{opts.minus ? "(−) " : ""}{label}
              </button>
            ) : <span className={opts.total ? "" : "pl-5"}>{opts.minus ? "(−) " : opts.total ? "(=) " : ""}{label}</span>}
            {opts.hint && <span className="block pl-5 text-xs font-normal text-text-muted">{opts.hint}</span>}
          </td>
          <td className={`num py-2 pr-2 text-right ${opts.minus && cents ? "text-danger" : opts.total && cents < 0 ? "text-danger" : ""}`}>{formatBRL(opts.minus && cents ? -cents : cents)}</td>
          <td className="num py-2 text-right text-text-muted">{pctOf(cents)}</td>
        </tr>
        {expandable && isOpen && d.detail[opts.group!].map((r) => (
          <tr key={r.name} className="border-b border-border text-xs text-text-muted">
            <td className="py-1.5 pl-10 pr-2">{r.name}</td>
            <td className="num py-1.5 pr-2 text-right">{formatBRL(-r.cents)}</td>
            <td className="num py-1.5 text-right">{pctOf(r.cents)}</td>
          </tr>
        ))}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>DRE Simplificado</PageTitle>
      <MonthPicker month={month} setMonth={setMonth} />
      <Card>
        <h2 className="text-sm font-semibold">Resultado de <span className="capitalize">{monthLabel(month)}</span></h2>
        <p className="mb-3 text-xs text-text-muted">Por competência: tudo que foi lançado no mês, pago ou não. As despesas entram em cada linha pelo nome da categoria.</p>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-text-muted">
              <th className="py-2 pr-2 font-semibold">Descrição</th><th className="py-2 pr-2 text-right font-semibold">Valor</th>
              <th className="py-2 text-right font-semibold" title="Em relação à receita bruta">% da receita</th>
            </tr></thead>
            <tbody>
              {line("Receita bruta", d.grossCents, { total: true, hint: "Vendas e serviços do mês" })}
              {line("Impostos sobre vendas", d.taxesCents, { minus: true, group: "taxes" })}
              {line("Receita líquida", d.netRevenueCents, { total: true })}
              {line("Custos (mercadorias, matéria-prima, frete)", d.costsCents, { minus: true, group: "costs" })}
              {line("Lucro bruto", d.grossProfitCents, { total: true })}
              {line("Despesas operacionais", d.opexCents, { minus: true, group: "opex" })}
              {line("Resultado operacional", d.operatingCents, { total: true })}
              {line("Pró-labore", d.prolaboreCents, { minus: true, group: "prolabore" })}
              {line("Despesas financeiras (juros, empréstimos, taxas)", d.financialCents, { minus: true, group: "financial" })}
              {line("Resultado líquido", d.resultCents, { total: true })}
            </tbody>
          </table>
        </div>
        <div role="status" className={`mt-3 rounded-md p-2 text-center text-sm font-bold ${d.resultCents >= 0 ? "bg-accent-soft text-income" : "bg-danger/10 text-danger"}`}>
          {d.grossCents === 0 && d.resultCents === 0 ? "Nenhum lançamento neste mês." : d.resultCents >= 0 ? `Lucro de ${formatBRL(d.resultCents)} no mês` : `Prejuízo de ${formatBRL(-d.resultCents)} no mês`}
        </div>
      </Card>
    </div>
  );
}
