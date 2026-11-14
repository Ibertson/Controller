"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, CalendarDays, DollarSign, Package, Percent, TrendingUp, Trophy, type LucideIcon } from "lucide-react";
import { useSpace } from "@/components/business";
import { useOrders } from "@/components/orders";
import { Card, Skeleton } from "@/components/ui";
import { today } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { RANGES, monthDates, productRanking, rangeDates, rankBy, type ProductRank, type RangeKey, type RankBy } from "@/lib/ranking";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const TABS: [RankBy, string][] = [["qty", "Por Quantidade"], ["revenueCents", "Por Faturamento"], ["profitCents", "Por Lucro"]];
const TOP = 10;
const br = (d: string) => d.split("-").reverse().join("/");
const pct = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const units = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const MEDAL = ["bg-chart-3/20 text-chart-3", "bg-chart-6/20 text-chart-6", "bg-chart-5/15 text-chart-5"];

/** Ranking de Produtos: o que mais vende, mais fatura e mais dá lucro nos pedidos do período. */
export default function RankingProdutos() {
  const { kind, company } = useSpace();
  const { data, error } = useOrders();
  const now = today();
  const [range, setRange] = useState<RangeKey>("30");
  const [month, setMonth] = useState<string | null>(null);
  const [tab, setTab] = useState<RankBy>("qty");

  if (kind !== "business" || !company) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 aria-hidden className="size-9 text-text-muted" />
        <h1 className="font-semibold">Ranking de Produtos faz parte do Painel Empresarial</h1>
        <p className="max-w-md text-sm text-text-muted">Abra a aba Empresarial no topo da tela para ver os produtos que mais vendem.</p>
      </Card>
    );
  }
  if (!data) return <div className="flex flex-col gap-4"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-72" /></div>;

  const { from, to } = month ? monthDates(month) : rangeDates(range, now);
  const title = month ? `${MONTHS[Number(month.slice(5)) - 1]} de ${month.slice(0, 4)}` : RANGES.find((r) => r.key === range)!.title;
  const r = productRanking(data.orders, data.products, from, to);
  const ranked = rankBy(r.items, tab);
  const top = ranked.slice(0, TOP);
  const max = Math.max(1, ...top.map((i) => Math.abs(i[tab])));
  const value = (i: ProductRank) => (tab === "qty" ? `${units(i.qty)} un.` : formatBRL(i[tab]));
  const anyNoCost = r.items.some((i) => i.noCost);

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Mês" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {MONTHS.map((m, i) => {
          const key = `${now.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button key={key} type="button" aria-pressed={month === key} onClick={() => setMonth(month === key ? null : key)}
              className="h-9 shrink-0 rounded-md border border-border px-4 text-sm hover:bg-surface aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent">{m}</button>
          );
        })}
      </nav>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><TrendingUp aria-hidden className="size-5 text-accent" />Ranking de Produtos</h1>
          <p className="text-sm text-text-muted">{title} • <span className="num">{br(from)} a {br(to)}</span></p>
        </div>
        <label className="flex h-9 items-center gap-2 rounded-md border border-border bg-surface-raised px-3 text-sm focus-within:outline-2 focus-within:outline-accent">
          <CalendarDays aria-hidden className="size-4 text-text-muted" />
          <span className="sr-only">Período</span>
          <select value={month ? "" : range} onChange={(e) => { setMonth(null); setRange(e.target.value as RangeKey); }} className="bg-transparent outline-none">
            {month && <option value="" disabled>Mês escolhido</option>}
            {RANGES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
      </Card>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={DollarSign} tone="bg-chart-3/15 text-chart-3" label="Faturamento" value={formatBRL(r.revenueCents)} />
        <Kpi icon={TrendingUp} tone="bg-income/15 text-income" label="Lucro" value={formatBRL(r.profitCents)} negative={r.profitCents < 0} />
        <Kpi icon={Package} tone="bg-chart-2/15 text-chart-2" label="Produtos Vendidos" value={units(r.units)} />
        <Kpi icon={Percent} tone="bg-chart-4/15 text-chart-4" label="Ticket Médio" value={formatBRL(r.ticketCents)} hint={r.orders ? `${r.orders} ${r.orders === 1 ? "pedido" : "pedidos"}` : undefined} />
      </div>

      <Card>
        <div role="tablist" aria-label="Ordenar ranking" className="grid grid-cols-3 gap-1 rounded-md bg-surface p-1">
          {TABS.map(([id, label]) => (
            <button key={id} id={`rk-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls="rk-panel" onClick={() => setTab(id)}
              className="h-9 rounded-sm px-1 text-sm text-text-muted hover:text-text aria-selected:bg-surface-raised aria-selected:font-semibold aria-selected:text-text aria-selected:shadow-sm"><span className="hidden sm:inline">{label}</span><span className="sm:hidden">{label.replace("Por ", "")}</span></button>
          ))}
        </div>
        <div id="rk-panel" role="tabpanel" aria-labelledby={`rk-tab-${tab}`} className="pt-4">
          {top.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
              <Package aria-hidden className="size-9 text-text-muted" />
              <p className="text-sm text-text-muted">Nenhuma venda de produtos no período selecionado</p>
              <Link href="/empresa/pedidos" className="text-sm font-semibold text-accent hover:underline">Registrar um pedido</Link>
            </div>
          ) : (
            <ol className="flex flex-col gap-3">
              {top.map((i, n) => (
                <li key={i.key} className="flex items-center gap-3">
                  <span className={`num grid size-8 shrink-0 place-items-center rounded-pill text-sm font-bold ${MEDAL[n] ?? "bg-surface text-text-muted"}`}>
                    {n < 3 ? <Trophy aria-label={`${n + 1}º lugar`} className="size-4" /> : `${n + 1}º`}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{i.name}</span>
                      <span className={`num shrink-0 font-semibold ${i[tab] < 0 ? "text-danger" : ""}`}>{value(i)}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-pill bg-surface">
                      <span className={`block h-full rounded-pill ${i[tab] < 0 ? "bg-danger" : "bg-accent"}`} style={{ width: `${(Math.abs(i[tab]) / max) * 100}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {ranked.length > TOP && <p className="mt-3 text-xs text-text-muted">Mostrando os {TOP} primeiros de {ranked.length} produtos. Todos aparecem no detalhamento abaixo.</p>}
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Detalhamento por Produto</h2>
        <p className="mb-3 text-xs text-text-muted">Vendas dos Pedidos do período (cancelados não contam). O desconto do pedido é dividido entre os itens e o custo é o cadastrado no produto hoje.</p>
        {ranked.length === 0 ? <p className="py-6 text-center text-sm text-text-muted">Nenhum dado disponível</p> : <>
          <div className="-mx-4 hidden overflow-x-auto px-4 md:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-text-muted">
                <th className="py-2 pr-2 font-semibold">#</th>
                <th className="py-2 pr-2 font-semibold">Produto</th>
                <th className="py-2 pr-2 text-right font-semibold">Qtd.</th>
                <th className="py-2 pr-2 text-right font-semibold">Faturamento</th>
                <th className="py-2 pr-2 text-right font-semibold">Custo</th>
                <th className="py-2 pr-2 text-right font-semibold">Lucro</th>
                <th className="py-2 pr-2 text-right font-semibold">Margem</th>
                <th className="py-2 text-right font-semibold">% do total</th>
              </tr></thead>
              <tbody>
                {ranked.map((i, n) => (
                  <tr key={i.key} className="border-b border-border last:border-0">
                    <td className="num py-2 pr-2 text-text-muted">{n + 1}</td>
                    <td className="py-2 pr-2 font-medium">{i.name}{i.noCost && <span className="ml-1 text-xs font-normal text-text-muted" title="Sem custo cadastrado: o lucro considera custo zero">(sem custo)</span>}</td>
                    <td className="num py-2 pr-2 text-right">{units(i.qty)}</td>
                    <td className="num py-2 pr-2 text-right">{formatBRL(i.revenueCents)}</td>
                    <td className="num py-2 pr-2 text-right text-text-muted">{formatBRL(i.costCents)}</td>
                    <td className={`num py-2 pr-2 text-right font-semibold ${i.profitCents < 0 ? "text-danger" : "text-income"}`}>{formatBRL(i.profitCents)}</td>
                    <td className="num py-2 pr-2 text-right">{pct(i.margin)}</td>
                    <td className="num py-2 text-right text-text-muted">{pct(i.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col divide-y divide-border md:hidden">
            {ranked.map((i, n) => (
              <li key={i.key} className="py-3">
                <p className="flex justify-between gap-2 text-sm font-medium"><span className="truncate">{n + 1}. {i.name}</span><span className="num shrink-0">{formatBRL(i.revenueCents)}</span></p>
                <p className="num mt-1 text-xs text-text-muted">
                  {units(i.qty)} un. · custo {formatBRL(i.costCents)}{i.noCost ? " (sem custo)" : ""} · lucro <span className={i.profitCents < 0 ? "text-danger" : "text-income"}>{formatBRL(i.profitCents)}</span> · margem {pct(i.margin)} · {pct(i.share)} do total
                </p>
              </li>
            ))}
          </ul>
          {anyNoCost && <p className="mt-3 text-xs text-text-muted">Produtos marcados “sem custo” não têm custo cadastrado (ou foram excluídos), então o lucro deles considera custo zero.</p>}
        </>}
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, tone, label, value, hint, negative }: { icon: LucideIcon; tone: string; label: string; value: string; hint?: string; negative?: boolean }) {
  return (
    <Card className="flex items-center gap-3">
      <span aria-hidden className={`hidden size-10 shrink-0 place-items-center rounded-pill sm:grid ${tone}`}><Icon className="size-5" /></span>
      <div className="min-w-0">
        <p className="text-xs text-text-muted">{label}</p>
        <p className={`num text-lg font-bold sm:text-xl ${negative ? "text-danger" : ""}`}>{value}</p>
        {hint && <p className="text-xs text-text-muted">{hint}</p>}
      </div>
    </Card>
  );
}
