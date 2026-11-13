"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Building2, Calculator, FileText, Plus, Search } from "lucide-react";
import { useSpace } from "@/components/business";
import { NewQuoteDialog } from "@/components/quote/NewQuoteDialog";
import { QuoteCalculator } from "@/components/quote/QuoteCalculator";
import { useQuotes } from "@/components/quotes";
import { Card, Skeleton, inputClass } from "@/components/ui";
import { today } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { QUOTE_STATUSES, effectiveStatus, filterQuotes, formatNumber, quoteTotals, statusCounts, statusLabel, type MonthFilter } from "@/lib/quotes";
import type { QuoteStatus } from "@/lib/types";

const dateBR = (d: string) => d.split("-").reverse().join("/");

/** Orçamentos: contagem por situação, calculadora, filtros e a lista. */
export default function Orcamentos() {
  const { kind } = useSpace();
  const { list, error } = useQuotes();
  const [calc, setCalc] = useState(false);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<QuoteStatus | "vencido" | "all">("all");
  const [month, setMonth] = useState<MonthFilter>("all");

  if (kind !== "business") {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 aria-hidden className="size-9 text-text-muted" />
        <h1 className="font-semibold">Orçamentos fazem parte do Painel Empresarial</h1>
        <p className="max-w-md text-sm text-text-muted">Abra a aba Empresarial no topo da tela para criar orçamentos da sua empresa.</p>
      </Card>
    );
  }
  if (!list) return <div className="flex flex-col gap-4"><Skeleton className="h-16" /><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;

  const now = today();
  const counts = statusCounts(list, now);
  const shown = filterQuotes(list, { q, status, month }, now);
  const newButton = (extra = "") => (
    <button type="button" onClick={() => setCreating(true)} className={`inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover ${extra}`}>
      <Plus aria-hidden className="size-4" />Novo orçamento
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Link href="/" aria-label="Voltar ao Painel Empresarial" className="mt-1 rounded-sm p-1 text-text-muted hover:bg-surface hover:text-text"><ArrowLeft className="size-5" /></Link>
          <div>
            <h1 className="text-xl font-bold">Orçamentos</h1>
            <p className="text-sm text-text-muted">{list.length} {list.length === 1 ? "orçamento" : "orçamentos"} no total</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={calc} onClick={() => setCalc((v) => !v)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold hover:bg-surface aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent">
            <Calculator aria-hidden className="size-4" />Calculadora
          </button>
          {newButton()}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {QUOTE_STATUSES.map((s) => (
          <button key={s.value} type="button" aria-pressed={status === s.value} onClick={() => setStatus((v) => (v === s.value ? "all" : s.value))}
            className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-bg px-2 py-3 hover:bg-surface aria-pressed:border-accent aria-pressed:ring-1 aria-pressed:ring-accent">
            <span className={`num text-xl font-bold ${s.tone}`}>{counts[s.value]}</span>
            <span className="text-xs text-text-muted">{s.label}</span>
          </button>
        ))}
      </div>

      {calc && <QuoteCalculator />}

      <Card className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por cliente ou número..." aria-label="Buscar por cliente ou número"
            className="h-11 w-full rounded-md border border-border bg-bg pl-9 pr-3 text-base placeholder:text-text-muted" />
        </div>
        <select aria-label="Filtrar por status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputClass}>
          <option value="all">Todos os status</option>
          {QUOTE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select aria-label="Filtrar por mês" value={month} onChange={(e) => setMonth(e.target.value as MonthFilter)} className={inputClass}>
          <option value="all">Todos os meses</option>
          <option value="current">Mês atual</option>
        </select>
      </Card>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      {shown.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <FileText aria-hidden className="size-10 text-text-muted" />
          <h2 className="font-semibold">Nenhum orçamento encontrado</h2>
          <p className="text-sm text-text-muted">{list.length ? "Mude a busca ou os filtros para ver outros orçamentos" : "Crie seu primeiro orçamento profissional"}</p>
          {!list.length && newButton("mt-2")}
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((o) => {
            const st = effectiveStatus(o, now);
            const tone = QUOTE_STATUSES.find((s) => s.value === st)?.tone ?? "";
            return (
              <li key={o.id}>
                <Link href={`/empresa/orcamentos/orcamento?id=${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-bg px-4 py-3 hover:bg-surface">
                  <span className="num w-20 shrink-0 text-xs font-semibold text-text-muted">{formatNumber(o.number)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{o.clientName}</span>
                    <span className="block truncate text-xs text-text-muted">{o.title || (o.kind === "produtos" ? "Venda de produtos" : "Personalizado")} · {dateBR(o.issuedOn)} · válido até {dateBR(o.validUntil)}</span>
                  </span>
                  <span className={`rounded-pill bg-surface px-2 py-0.5 text-xs font-semibold ${tone}`}>{statusLabel(st)}</span>
                  <span className="num w-28 text-right font-bold">{formatBRL(quoteTotals(o).total)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {creating && <NewQuoteDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
