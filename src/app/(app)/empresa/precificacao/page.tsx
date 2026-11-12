"use client";

import { useState } from "react";
import { Card, Field, Input, PageTitle } from "@/components/ui";
import { priceFor } from "@/lib/business";
import { formatBRL, parseBRL } from "@/lib/money";

const pct = (v: string) => { const n = Number(v.replace(",", ".")); return v.trim() === "" ? 0 : Number.isFinite(n) ? n : NaN; };

/** Calculadora de preço de venda (markup): custo + percentuais sobre a venda. */
export default function Precificacao() {
  const [f, setF] = useState({ cost: "", fixed: "10", tax: "6", fee: "3", commission: "0", margin: "20" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const cost = parseBRL(f.cost) ?? 0;
  const vals = { fixedPct: pct(f.fixed), taxPct: pct(f.tax), feePct: pct(f.fee), commissionPct: pct(f.commission), marginPct: pct(f.margin) };
  const bad = Object.values(vals).some((v) => Number.isNaN(v));
  const r = bad ? null : priceFor({ costCents: cost, ...vals });
  const total = bad ? 0 : Object.values(vals).reduce((a, b) => a + b, 0);
  const pf = (k: keyof typeof f, id: string, label: string, hint: string) => (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="relative"><Input id={id} inputMode="decimal" value={f[k]} onChange={set(k)} className="num pr-8" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">%</span></div>
    </Field>
  );
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Precificação</PageTitle>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <p className="mb-3 text-sm text-text-muted">Informe o custo e quanto de cada venda vai para despesas, impostos, taxas, comissão e lucro. O preço sugerido cobre tudo isso.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Custo do produto ou serviço" htmlFor="pr-cost" hint="Compra, matéria-prima ou mão de obra de uma unidade.">
              <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">R$</span>
                <Input id="pr-cost" inputMode="decimal" value={f.cost} onChange={set("cost")} placeholder="0,00" className="num pl-10" /></div>
            </Field>
            {pf("fixed", "pr-fixed", "Despesas fixas", "Aluguel, luz, salários… em % do faturamento.")}
            {pf("tax", "pr-tax", "Impostos sobre a venda", "Ex.: alíquota do Simples Nacional.")}
            {pf("fee", "pr-fee", "Taxa do cartão / maquininha", "Média das taxas cobradas.")}
            {pf("commission", "pr-commission", "Comissão de venda", "Vendedor, marketplace ou app.")}
            {pf("margin", "pr-margin", "Lucro desejado", "O que sobra limpo para a empresa.")}
          </div>
        </Card>
        <Card className="h-fit">
          <h2 className="text-sm font-bold uppercase tracking-wide">Preço sugerido</h2>
          {r ? (
            <>
              <div role="status" className="num mt-2 text-3xl font-bold text-accent">{formatBRL(r.priceCents)}</div>
              <p className="text-xs text-text-muted">Markup de {r.markup.toFixed(2).replace(".", ",")}× sobre o custo</p>
              <dl className="mt-3 border-t border-border pt-2 text-sm">
                {r.parts.map((p) => <div key={p.label} className="flex justify-between py-1"><dt>{p.label}</dt><dd className="num">{formatBRL(p.cents)}</dd></div>)}
                <div className="flex justify-between py-1 font-semibold text-income"><dt>Lucro por unidade</dt><dd className="num">{formatBRL(r.profitCents)}</dd></div>
              </dl>
            </>
          ) : (
            <p role="status" className="mt-2 text-sm text-text-muted">
              {bad ? "Use só números nos percentuais." : cost <= 0 ? "Informe o custo para calcular." : `Os percentuais somam ${total.toString().replace(".", ",")}%. Eles precisam ficar abaixo de 100%.`}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
