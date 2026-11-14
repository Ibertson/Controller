"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Building2, DollarSign, Minus, PieChart, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { useSpace } from "@/components/business";
import { Bars, Donut, Empty, GroupedBars, IncomeExpenseChart, LineChart } from "@/components/charts";
import { Card, Skeleton } from "@/components/ui";
import { useSnapshot } from "@/lib/data";
import { addMonths, today } from "@/lib/dates";
import { categoriesOver, projection, topSlices, yearKpis, yearMonths, yearSeries, yearsWithData } from "@/lib/analytics";
import { change, changeText, periodTotals, profitMargin } from "@/lib/metrics";
import { formatBRL } from "@/lib/money";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const TABS = [["evolucao", "Evolução Mensal"], ["anual", "Comparação Anual"], ["projecao", "Projeção"], ["categoria", "Por Categoria"]] as const;
type Tab = (typeof TABS)[number][0];
type Metric = "incomeCents" | "expenseCents" | "balanceCents";
const METRICS: [Metric, string][] = [["incomeCents", "Receitas"], ["expenseCents", "Despesas"], ["balanceCents", "Lucro"]];
const selectClass = "h-9 rounded-md border border-border bg-surface-raised px-3 text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent";
const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const monthIdx = (m: string) => Number(m.slice(5, 7)) - 1;

/** Analytics Avançado: o ano inteiro em indicadores, evolução, comparação com o ano anterior, projeção e categorias. */
export default function Analytics() {
  const { kind, company } = useSpace();
  const snap = useSnapshot();
  const now = today();
  const curMonth = now.slice(0, 8) + "01";
  const [year, setYear] = useState(() => Number(now.slice(0, 4)));
  const [mi, setMi] = useState(() => monthIdx(now));
  const [tab, setTab] = useState<Tab>("evolucao");
  const [metric, setMetric] = useState<Metric>("incomeCents");
  const [scope, setScope] = useState<"ano" | "mes">("ano");
  const chips = useRef<HTMLElement>(null);
  useEffect(() => { chips.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "nearest", inline: "center" }); }, [kind]);

  if (kind !== "business" || !company) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 aria-hidden className="size-9 text-text-muted" />
        <h1 className="font-semibold">Analytics faz parte do Painel Empresarial</h1>
        <p className="max-w-md text-sm text-text-muted">Abra a aba Empresarial no topo da tela para analisar o desempenho da empresa ao longo do ano.</p>
      </Card>
    );
  }
  if (!snap) return <div className="flex flex-col gap-4"><Skeleton className="h-20" /><Skeleton className="h-28" /><Skeleton className="h-72" /></div>;

  const months = yearMonths(year);
  const month = months[mi];
  const series = yearSeries(snap, year);
  const prevSeries = yearSeries(snap, year - 1);
  const k = yearKpis(snap, year);
  const prevK = yearKpis(snap, year - 1);
  const monthChange = change(periodTotals(snap, month).incomeCents, periodTotals(snap, addMonths(month, -1)).incomeCents);
  const years = yearsWithData(snap, Number(now.slice(0, 4)));
  if (!years.includes(year)) years.push(year);

  return (
    <div className="flex flex-col gap-4">
      <nav ref={chips} aria-label="Mês" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {MONTHS.map((m, i) => (
          <button key={m} type="button" aria-pressed={mi === i} onClick={() => setMi(i)}
            className="h-9 shrink-0 rounded-md border border-border px-4 text-sm hover:bg-surface aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent">{m}</button>
        ))}
      </nav>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics Avançado</h1>
          <p className="text-sm text-text-muted">Análise completa do desempenho do seu negócio</p>
        </div>
        <label className="sr-only" htmlFor="an-year">Ano</label>
        <select id="an-year" value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectClass}>
          {years.sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi title="Receita total" value={k.incomeCents} icon={TrendingUp} tone="bg-income/15 text-income">
          <ChangeLine value={monthChange} /> {MONTHS[mi].toLowerCase()} vs {MONTHS[(mi + 11) % 12].toLowerCase()}
        </Kpi>
        <Kpi title="Lucro líquido" value={k.profitCents} icon={DollarSign} tone="bg-chart-2/15 text-chart-2" negative={k.profitCents < 0}>
          Margem de {pct(k.margin)}
        </Kpi>
        <Kpi title="Despesas totais" value={k.expenseCents} icon={TrendingDown} tone="bg-danger/15 text-danger">
          {k.incomeCents > 0 ? `${pct(k.expensePct)} da receita` : "Sem receita no ano"}
        </Kpi>
        <Kpi title="Ticket médio" value={k.ticketCents} icon={PieChart} tone="bg-chart-4/15 text-chart-4">
          Por transação · {k.salesCount} {k.salesCount === 1 ? "receita" : "receitas"} no ano
        </Kpi>
      </div>

      <div role="tablist" aria-label="Análises" className="grid grid-cols-2 gap-1 rounded-md bg-surface p-1 sm:grid-cols-4">
        {TABS.map(([id, label]) => (
          <button key={id} id={`an-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls="an-panel" onClick={() => setTab(id)}
            className="h-9 rounded-sm text-sm text-text-muted hover:text-text aria-selected:bg-surface-raised aria-selected:font-semibold aria-selected:text-text aria-selected:shadow-sm">{label}</button>
        ))}
      </div>

      <div id="an-panel" role="tabpanel" aria-labelledby={`an-tab-${tab}`} className="flex flex-col gap-4">
        {tab === "evolucao" && <>
          <Card>
            <h2 className="mb-3 font-semibold">Evolução Mensal de Receitas e Despesas</h2>
            <IncomeExpenseChart points={series} />
          </Card>
          <Card>
            <h2 className="mb-1 font-semibold">Margem de Lucro Mensal (%)</h2>
            <p className="mb-3 text-xs text-text-muted">(receitas − despesas) ÷ receitas de cada mês. Mês sem receita fica em 0%.</p>
            <LineChart months={months} format={pct} label={`Margem de lucro por mês em ${year}. ${series.map((p, i) => `${SHORT[i]}: ${pct(profitMargin(p))}`).join("; ")}`}
              series={[{ label: "Margem de lucro", color: "var(--color-chart-4)", values: series.map(profitMargin) }]} />
          </Card>
        </>}

        {tab === "anual" && <>
          <div className="grid gap-3 sm:grid-cols-3">
            <YearCompare label="Receitas" cur={k.incomeCents} prev={prevK.incomeCents} year={year} />
            <YearCompare label="Despesas" cur={k.expenseCents} prev={prevK.expenseCents} year={year} upIsBad />
            <YearCompare label="Lucro" cur={k.profitCents} prev={prevK.profitCents} year={year} />
          </div>
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{year} vs {year - 1}, mês a mês</h2>
              <div role="radiogroup" aria-label="Indicador" className="flex gap-1 rounded-md bg-surface p-1">
                {METRICS.map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={metric === id} onClick={() => setMetric(id)}
                    className="h-8 rounded-sm px-3 text-sm text-text-muted aria-checked:bg-surface-raised aria-checked:font-semibold aria-checked:text-text aria-checked:shadow-sm">{label}</button>
                ))}
              </div>
            </div>
            <GroupedBars compact
              label={`${METRICS.find((m) => m[0] === metric)![1]} por mês. ${series.map((p, i) => `${SHORT[i]}: ${year} ${formatBRL(p[metric])}, ${year - 1} ${formatBRL(prevSeries[i][metric])}`).join("; ")}`}
              series={[{ label: String(year), color: "var(--color-chart-1)" }, { label: String(year - 1), color: "var(--color-chart-6)" }]}
              groups={series.map((p, i) => ({ label: SHORT[i], values: [p[metric], prevSeries[i][metric]] }))} />
          </Card>
        </>}

        {tab === "projecao" && <ProjectionTab snap={snap} year={year} curMonth={curMonth} />}

        {tab === "categoria" && <>
          <div role="radiogroup" aria-label="Período" className="flex w-fit gap-1 rounded-md bg-surface p-1">
            {([["ano", `Ano de ${year}`], ["mes", MONTHS[mi]]] as const).map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={scope === id} onClick={() => setScope(id)}
                className="h-8 rounded-sm px-3 text-sm text-text-muted aria-checked:bg-surface-raised aria-checked:font-semibold aria-checked:text-text aria-checked:shadow-sm">{label}</button>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <CategoryCard title="Despesas por categoria" kind="expense" snap={snap} months={scope === "ano" ? months : [month]} />
            <CategoryCard title="Receitas por categoria" kind="income" snap={snap} months={scope === "ano" ? months : [month]} />
          </div>
        </>}
      </div>
    </div>
  );
}

function Kpi({ title, value, icon: Icon, tone, negative, children }: { title: string; value: number; icon: LucideIcon; tone: string; negative?: boolean; children: React.ReactNode }) {
  return (
    <Card className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted sm:text-xs">{title}</p>
        <p className={`num mt-1 text-lg font-bold sm:text-2xl ${negative ? "text-danger" : ""}`}>{formatBRL(value)}</p>
        <p className="mt-1 text-xs text-text-muted">{children}</p>
      </div>
      <span aria-hidden className={`hidden size-11 shrink-0 place-items-center rounded-pill sm:grid ${tone}`}><Icon className="size-5" /></span>
    </Card>
  );
}

function ChangeLine({ value, upIsBad }: { value: number | null; upIsBad?: boolean }) {
  const up = value == null || value > 0;
  const down = value != null && value < 0;
  const Arrow = value === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const good = value !== 0 && (upIsBad ? down : up);
  const bad = value !== 0 && (upIsBad ? up : down);
  return <span className={`num inline-flex items-center gap-0.5 font-semibold ${good ? "text-income" : bad ? "text-danger" : ""}`}><Arrow aria-hidden className="size-3.5" />{changeText(value)}</span>;
}

function YearCompare({ label, cur, prev, year, upIsBad }: { label: string; cur: number; prev: number; year: number; upIsBad?: boolean }) {
  return (
    <Card>
      <p className="text-sm text-text-muted">{label} em {year}</p>
      <p className={`num mt-1 text-xl font-bold ${cur < 0 ? "text-danger" : ""}`}>{formatBRL(cur)}</p>
      <p className="mt-1 text-xs text-text-muted"><ChangeLine value={change(cur, prev)} upIsBad={upIsBad} /> vs {year - 1} (<span className="num">{formatBRL(prev)}</span>)</p>
    </Card>
  );
}

function ProjectionTab({ snap, year, curMonth }: { snap: NonNullable<ReturnType<typeof useSnapshot>>; year: number; curMonth: string }) {
  const p = projection(snap, year, curMonth);
  const sum = (key: "incomeCents" | "expenseCents" | "balanceCents") => p.months.reduce((a, m) => a + m[key], 0);
  const closed = p.firstProjected === 12;
  const base = p.baseMonths.map((m) => SHORT[monthIdx(m)]).join(", ");
  return <>
    <div className="grid gap-3 sm:grid-cols-3">
      {([["Receita", "projetada", "incomeCents"], ["Despesas", "projetadas", "expenseCents"], ["Lucro", "projetado", "balanceCents"]] as const).map(([label, word, key]) => (
        <Card key={key}>
          <p className="text-sm text-text-muted">{label} {closed ? "no ano" : `${word} no ano`}</p>
          <p className={`num mt-1 text-xl font-bold ${sum(key) < 0 ? "text-danger" : ""}`}>{formatBRL(sum(key))}</p>
          {!closed && <p className="mt-1 text-xs text-text-muted">Lançado <span className="num">{formatBRL(p.months.slice(0, p.firstProjected).reduce((a, m) => a + m[key], 0))}</span> + projetado <span className="num">{formatBRL(p.months.slice(p.firstProjected).reduce((a, m) => a + m[key], 0))}</span></p>}
        </Card>
      ))}
    </div>
    <Card>
      <h2 className="mb-1 font-semibold">Projeção de Receitas e Despesas</h2>
      <p className="mb-3 text-xs text-text-muted">
        {closed ? `${year} já terminou: o gráfico mostra o que foi lançado.`
          : `Meses futuros usam a média de ${base}: receita ${formatBRL(p.baseIncomeCents)} e despesas ${formatBRL(p.baseExpenseCents)} por mês. É uma estimativa, não inclui sazonalidade.`}
      </p>
      <LineChart months={p.months.map((m) => m.month)} shadeFrom={closed ? undefined : p.firstProjected}
        label={`Receitas e despesas de ${year}, com projeção a partir de ${closed ? "nenhum mês" : SHORT[p.firstProjected]}. ${p.months.map((m, i) => `${SHORT[i]}${m.projected ? " (projetado)" : ""}: receitas ${formatBRL(m.incomeCents)}, despesas ${formatBRL(m.expenseCents)}`).join("; ")}`}
        series={[
          { label: "Receitas", color: "var(--color-income)", values: p.months.map((m) => m.incomeCents) },
          { label: "Despesas", color: "var(--color-expense)", values: p.months.map((m) => m.expenseCents) },
        ]} />
    </Card>
  </>;
}

function CategoryCard({ title, kind, snap, months }: { title: string; kind: "expense" | "income"; snap: NonNullable<ReturnType<typeof useSnapshot>>; months: string[] }) {
  const list = categoriesOver(snap, months, kind);
  return (
    <Card>
      <h2 className="mb-3 font-semibold">{title}</h2>
      {list.length === 0 ? <Empty>{kind === "expense" ? "Nenhuma despesa no período." : "Nenhuma receita no período."}</Empty>
        : kind === "expense" ? <Donut slices={topSlices(list)} label={`${title}: ${list.map((s) => `${s.label} ${formatBRL(s.cents)}`).join("; ")}`} />
          : <Bars slices={topSlices(list, 8)} />}
    </Card>
  );
}
