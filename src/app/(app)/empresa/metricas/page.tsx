"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Building2, CalendarRange, CircleAlert, DollarSign, Minus, TrendingUp, type LucideIcon } from "lucide-react";
import { useSpace } from "@/components/business";
import { GroupedBars, IncomeExpenseChart, LineChart } from "@/components/charts";
import { Card, Skeleton } from "@/components/ui";
import { repo, useSnapshot } from "@/lib/data";
import { addMonths, monthLabel, today } from "@/lib/dates";
import { COMPARE_OPTIONS, RANGE_OPTIONS, change, changeText, monthRange, periodTotals, profitMargin } from "@/lib/metrics";
import { formatBRL } from "@/lib/money";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const REFRESH_MS = 60_000;
const selectClass = "h-9 rounded-md border border-border bg-surface-raised px-3 text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent";
const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const shortLabel = (m: string) => {
  const [name, year] = monthLabel(m).split(" ");
  return `${name.slice(0, 3)}/${year.slice(2)}`;
};

/** Busca o servidor de tempos em tempos enquanto a página está visível; devolve a hora da última atualização. */
function useLive() {
  const snap = useSnapshot();
  const [at, setAt] = useState<Date | null>(null);
  // A hora acompanha cada mudança nos dados (lançamento novo, outro aparelho).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (snap) setAt(new Date()); }, [snap]);
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") void repo.refresh().catch(() => {}); }, REFRESH_MS);
    return () => clearInterval(id);
  }, []);
  return at;
}

/** Métricas em Tempo Real: o mês escolhido comparado com outro e a evolução dos últimos meses. */
export default function Metricas() {
  const { kind, company } = useSpace();
  const snap = useSnapshot();
  const at = useLive();
  const now = today();
  const [month, setMonth] = useState(now.slice(0, 8) + "01");
  const [back, setBack] = useState<number>(1);
  const [range, setRange] = useState<number>(6);
  const chips = useRef<HTMLElement>(null);
  useEffect(() => { chips.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "nearest", inline: "center" }); }, [kind]);

  if (kind !== "business" || !company) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 aria-hidden className="size-9 text-text-muted" />
        <h1 className="font-semibold">Métricas em Tempo Real fazem parte do Painel Empresarial</h1>
        <p className="max-w-md text-sm text-text-muted">Abra a aba Empresarial no topo da tela para acompanhar o faturamento, as despesas e a margem da empresa.</p>
      </Card>
    );
  }
  if (!snap) return <div className="flex flex-col gap-4"><Skeleton className="h-20" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;

  const cur = periodTotals(snap, month);
  const prevMonth = addMonths(month, -back);
  const prev = periodTotals(snap, prevMonth);
  const months = monthRange(month, range);
  const points = months.map((m) => periodTotals(snap, m));
  const margins = points.map(profitMargin);
  const compareLabel = COMPARE_OPTIONS.find((o) => o.months === back)!.label;

  return (
    <div className="flex flex-col gap-4">
      <nav ref={chips} aria-label="Mês" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {MONTHS.map((m, i) => {
          const key = `${now.slice(0, 4)}-${String(i + 1).padStart(2, "0")}-01`;
          return (
            <button key={key} type="button" aria-pressed={month === key} onClick={() => setMonth(key)}
              className="h-9 shrink-0 rounded-md border border-border px-4 text-sm hover:bg-surface aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent">{m}</button>
          );
        })}
      </nav>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Métricas em Tempo Real</h1>
          <p className="text-sm text-text-muted">Dados atualizados automaticamente{at && <> · <span className="num">às {at.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></>}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-pill bg-accent opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-pill bg-accent" />
          </span>
          <Activity aria-hidden className="size-3.5" />Ao vivo
        </span>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold"><CalendarRange aria-hidden className="size-4 text-accent" />Comparação de Períodos</h2>
          <label className="sr-only" htmlFor="mt-back">Comparar com</label>
          <select id="mt-back" value={back} onChange={(e) => setBack(Number(e.target.value))} className={selectClass}>
            {COMPARE_OPTIONS.map((o) => <option key={o.months} value={o.months}>{o.label}</option>)}
          </select>
        </div>
        <p className="mb-3 text-xs text-text-muted">
          <span className="capitalize">{monthLabel(month)}</span> comparado com <span className="capitalize">{monthLabel(prevMonth)}</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Compare icon={DollarSign} label="Faturamento" cur={cur.incomeCents} prev={prev.incomeCents} />
          <Compare icon={CircleAlert} label="Despesas" cur={cur.expenseCents} prev={prev.expenseCents} upIsBad />
          <Compare icon={TrendingUp} label="Saldo" cur={cur.balanceCents} prev={prev.balanceCents} />
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Evolução Mensal</h2>
          <label className="sr-only" htmlFor="mt-range">Período do gráfico</label>
          <select id="mt-range" value={range} onChange={(e) => setRange(Number(e.target.value))} className={selectClass}>
            {RANGE_OPTIONS.map((n) => <option key={n} value={n}>Últimos {n} meses</option>)}
          </select>
        </div>
        <IncomeExpenseChart points={points.map((p) => ({ month: p.month, incomeCents: p.incomeCents, expenseCents: p.expenseCents }))} />
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Margem de Lucro (%)</h2>
        <p className="mb-3 text-xs text-text-muted">Quanto sobra de cada real faturado: (receitas − despesas) ÷ receitas.</p>
        <LineChart months={months} format={pct}
          label={`Margem de lucro por mês. ${months.map((m, i) => `${shortLabel(m)}: ${pct(margins[i])}`).join("; ")}`}
          series={[{ label: "Margem de lucro", color: "var(--color-chart-3)", values: margins }]} />
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Comparação Período Atual vs Anterior</h2>
        <p className="mb-3 text-xs text-text-muted">{shortLabel(month)} contra {shortLabel(prevMonth)} ({compareLabel.replace("vs. ", "").toLowerCase()}).</p>
        <GroupedBars
          label={`Atual ${shortLabel(month)}: receitas ${formatBRL(cur.incomeCents)}, despesas ${formatBRL(cur.expenseCents)}, saldo ${formatBRL(cur.balanceCents)}. Anterior ${shortLabel(prevMonth)}: receitas ${formatBRL(prev.incomeCents)}, despesas ${formatBRL(prev.expenseCents)}, saldo ${formatBRL(prev.balanceCents)}.`}
          series={[{ label: `Atual (${shortLabel(month)})`, color: "var(--color-chart-1)" }, { label: `Anterior (${shortLabel(prevMonth)})`, color: "var(--color-chart-6)" }]}
          groups={[
            { label: "Receitas", values: [cur.incomeCents, prev.incomeCents] },
            { label: "Despesas", values: [cur.expenseCents, prev.expenseCents] },
            { label: "Saldo", values: [cur.balanceCents, prev.balanceCents] },
          ]} />
      </Card>
    </div>
  );
}

function Compare({ icon: Icon, label, cur, prev, upIsBad }: { icon: LucideIcon; label: string; cur: number; prev: number; upIsBad?: boolean }) {
  const c = change(cur, prev);
  const up = c == null ? cur > prev : c > 0;
  const down = c != null && c < 0;
  const good = upIsBad ? down : up;
  const bad = upIsBad ? up : down;
  const Arrow = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="flex items-center gap-2 text-sm text-text-muted"><Icon aria-hidden className="size-4" />{label}</p>
      <p className={`num mt-1 text-2xl font-bold ${label === "Saldo" && cur < 0 ? "text-danger" : ""}`}>{formatBRL(cur)}</p>
      <p className={`num mt-1 flex items-center gap-1 text-xs font-semibold ${good ? "text-income" : bad ? "text-danger" : "text-text-muted"}`}>
        <Arrow aria-hidden className="size-3.5" />{changeText(c)}
        <span className="font-normal text-text-muted">· antes {formatBRL(prev)}</span>
      </p>
    </div>
  );
}
