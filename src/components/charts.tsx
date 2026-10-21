import { formatBRL } from "@/lib/money";
import type { MonthPoint, Slice } from "@/lib/summary";

// Gráficos em SVG puro, sem biblioteca: poucos dados e cores dos tokens do tema.
const palette = ["--color-chart-1", "--color-chart-2", "--color-chart-3", "--color-chart-4", "--color-chart-5", "--color-chart-6"];
export const sliceColor = (i: number) => `var(${palette[i % palette.length]})`;

const shortMonth = (m: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(new Date(m + "T00:00:00Z")).replace(".", "");

/** "R$ 1,2 mil" nos eixos, onde não cabe o valor inteiro. */
function compactBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);
}

export function Empty({ children }: { children: string }) {
  return <p className="grid min-h-40 place-items-center text-center text-sm text-text-muted">{children}</p>;
}

interface LineSeries { label: string; color: string; values: number[]; }

/** Linhas por mês. Linhas em SVG esticado; textos e pontos em HTML para não distorcer. Aceita valores negativos. */
export function LineChart({ months, series, label }: { months: string[]; series: LineSeries[]; label: string }) {
  const all = series.flatMap((s) => s.values);
  const max = Math.max(1, ...all);
  const min = Math.min(0, ...all);
  const x = (i: number) => (months.length === 1 ? 50 : (i * 100) / (months.length - 1));
  const y = (v: number) => 100 * (1 - (v - min) / (max - min));
  const ticks = min < 0 ? [max, 0, min] : [max, max / 2, 0];

  return (
    <figure role="img" aria-label={label}>
      <div aria-hidden className="grid grid-cols-[auto_1fr] gap-x-2">
        <div className="relative h-48 w-16 text-right text-[11px] leading-none text-text-muted">
          {ticks.map((v) => (
            <span key={v} className="num absolute right-0 -translate-y-1/2" style={{ top: `${Math.min(100, Math.max(0, y(v)))}%` }}>{compactBRL(v)}</span>
          ))}
        </div>
        <div className="relative h-48 border-b border-l border-border">
          {ticks.map((v) => <div key={v} className="absolute inset-x-0 border-t border-dashed border-border" style={{ top: `${y(v)}%` }} />)}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            {series.map((s) => (
              <polyline key={s.label} points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none"
                strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ stroke: s.color }} />
            ))}
          </svg>
          {series.map((s) => s.values.map((v, i) => (
            <span key={s.label + months[i]} className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-pill"
              style={{ left: `${x(i)}%`, top: `${y(v)}%`, background: s.color }} />
          )))}
        </div>
        <span />
        <div className="relative mt-1.5 h-4 text-[11px] text-text-muted">
          {months.map((m, i) => (
            <span key={m} className={`absolute top-0 ${i === 0 ? "" : i === months.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: `${x(i)}%` }}>{shortMonth(m)}</span>
          ))}
        </div>
      </div>
      <figcaption className="mt-3 flex gap-4 text-xs text-text-muted">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5"><span className="size-2.5 rounded-pill" style={{ background: s.color }} />{s.label}</span>
        ))}
      </figcaption>
    </figure>
  );
}

/** Receitas e despesas por mês. */
export function IncomeExpenseChart({ points }: { points: MonthPoint[] }) {
  const summary = points.map((p) => `${shortMonth(p.month)}: receitas ${formatBRL(p.incomeCents)}, despesas ${formatBRL(p.expenseCents)}`).join("; ");
  return (
    <LineChart months={points.map((p) => p.month)} label={`Receitas e despesas por mês. ${summary}`} series={[
      { label: "Receitas", color: "var(--color-income)", values: points.map((p) => p.incomeCents) },
      { label: "Despesas", color: "var(--color-expense)", values: points.map((p) => p.expenseCents) },
    ]} />
  );
}

/** Rosca com legenda (valor e porcentagem sempre em texto). */
export function Donut({ slices, label }: { slices: Slice[]; label: string }) {
  const total = slices.reduce((a, s) => a + s.cents, 0);
  const r = 70, c = 2 * Math.PI * r;
  const lens = slices.map((s) => (s.cents / total) * c);
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, v) => a + v, 0));
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg viewBox="0 0 180 180" role="img" aria-label={label} className="size-44 shrink-0 -rotate-90">
        <circle cx={90} cy={90} r={r} fill="none" strokeWidth={26} style={{ stroke: "var(--color-surface)" }} />
        {slices.map((s, i) => (
          <circle key={s.id} cx={90} cy={90} r={r} fill="none" strokeWidth={26} strokeDasharray={`${lens[i]} ${c - lens[i]}`}
            strokeDashoffset={-starts[i]} style={{ stroke: sliceColor(i) }} />
        ))}
      </svg>
      <ul className="flex w-full flex-col gap-2">
        {slices.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-pill" style={{ background: sliceColor(i) }} />
            <span className="flex-1 truncate">{s.label}</span>
            <span className="num text-text-muted">{Math.round((s.cents / total) * 100)}%</span>
            <span className="num w-28 text-right font-semibold">{formatBRL(s.cents)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontais com nome e valor. */
export function Bars({ slices, color = "var(--color-income)" }: { slices: Slice[]; color?: string }) {
  const max = Math.max(1, ...slices.map((s) => s.cents));
  return (
    <ul className="flex flex-col gap-3">
      {slices.map((s) => (
        <li key={s.id}>
          <div className="flex justify-between gap-2 text-sm"><span className="truncate">{s.label}</span><span className="num font-semibold">{formatBRL(s.cents)}</span></div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-pill bg-surface">
            <span className="block h-full rounded-pill" style={{ width: `${(s.cents / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
