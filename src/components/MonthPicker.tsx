"use client";

import { today } from "@/lib/dates";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Ano + botões de Janeiro a Dezembro. */
export function MonthPicker({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const year = Number(month.slice(0, 4));
  const mm = Number(month.slice(5, 7));
  const thisYear = Number(today().slice(0, 4));
  const years = Array.from({ length: 6 }, (_, i) => thisYear - 4 + i);
  const pick = (y: number, m: number) => setMonth(`${y}-${String(m).padStart(2, "0")}-01`);
  return (
    <div className="flex flex-col gap-3">
      <label className="w-fit">
        <span className="sr-only">Ano</span>
        <select value={year} onChange={(e) => pick(Number(e.target.value), mm)}
          className="h-10 rounded-md border border-border bg-surface-raised px-3 font-semibold shadow-card">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <div role="radiogroup" aria-label="Mês" className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">
        {MONTHS.map((name, i) => (
          <button key={name} type="button" role="radio" aria-checked={mm === i + 1} onClick={() => pick(year, i + 1)}
            className="h-9 shrink-0 rounded-md border border-border bg-surface-raised px-3.5 text-sm text-text shadow-card hover:bg-surface
              aria-checked:border-accent aria-checked:bg-accent-soft aria-checked:font-semibold aria-checked:text-accent">
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
