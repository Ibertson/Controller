"use client";

import Link from "next/link";
import { useState } from "react";
import { Calculator, FilePlus2 } from "lucide-react";
import { Input } from "@/components/ui";
import { formatBRL, parseBRL } from "@/lib/money";
import { calcBudget, type CalcInput } from "@/lib/quotes";

const pct = (v: string) => { const n = Number(v.replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : 0; };
const money = (v: string) => (v ? parseBRL(v) ?? 0 : 0);

/** Calculadora de orçamento: materiais + mão de obra, margem, impostos e desconto. */
export function QuoteCalculator() {
  const [f, setF] = useState({ materials: "", labor: "", margin: "", tax: "", discount: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value.replace(/[^\d,.]/g, "") }));
  const input: CalcInput = { materials: money(f.materials), labor: money(f.labor), marginPct: pct(f.margin), taxPct: pct(f.tax), discount: money(f.discount) };
  const r = calcBudget(input);
  const params = new URLSearchParams({ tipo: "personalizado", mat: String(input.materials), mo: String(input.labor), mg: String(input.marginPct), im: String(input.taxPct), de: String(input.discount) });

  return (
    <section aria-label="Calculadora de Orçamento" className="flex flex-col gap-4 rounded-lg border border-dashed border-accent/50 bg-bg p-4">
      <h2 className="flex items-center gap-2 font-semibold"><Calculator aria-hidden className="size-4 text-accent" />Calculadora de Orçamento</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Money id="calc-mat" label="Materiais (R$)" value={f.materials} onChange={set("materials")} />
        <Money id="calc-mo" label="Mão de obra (R$)" value={f.labor} onChange={set("labor")} />
        <Num id="calc-mg" label="Margem (%)" value={f.margin} onChange={set("margin")} />
        <Num id="calc-im" label="Impostos (%)" value={f.tax} onChange={set("tax")} />
        <Money id="calc-de" label="Desconto (R$)" value={f.discount} onChange={set("discount")} />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
          <span>Subtotal: <strong className="num text-text">{formatBRL(r.subtotal)}</strong></span>
          <span>+ Margem: <strong className="num text-text">{formatBRL(r.margin)}</strong></span>
          <span>+ Impostos: <strong className="num text-text">{formatBRL(r.taxes)}</strong></span>
          {input.discount > 0 && <span>− Desconto: <strong className="num text-text">{formatBRL(input.discount)}</strong></span>}
        </p>
        <div className="flex items-end gap-3">
          {r.total > 0 && (
            <Link href={`/empresa/orcamentos/orcamento?${params}`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold hover:bg-surface">
              <FilePlus2 aria-hidden className="size-4" />Usar em novo orçamento
            </Link>
          )}
          <div className="text-right">
            <p className="text-xs text-text-muted">Total</p>
            <p className="num text-2xl font-bold text-income" aria-live="polite">{formatBRL(r.total)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Money({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-text-muted">{label}</label>
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">R$</span>
        <Input id={id} inputMode="decimal" placeholder="0,00" className="num pl-10" value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function Num({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-text-muted">{label}</label>
      <Input id={id} inputMode="decimal" placeholder="0" className="num" value={value} onChange={onChange} />
    </div>
  );
}
