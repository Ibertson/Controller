"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Box, Building2, Clock, Package, Pencil, Plus, Search } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { useSpace } from "@/components/business";
import { Dialog } from "@/components/Dialog";
import { useProducts } from "@/components/products";
import { Button, Card, Field, Input, Skeleton } from "@/components/ui";
import { repo } from "@/lib/data";
import { today } from "@/lib/dates";
import { formatBRL, parseBRL } from "@/lib/money";
import { formatQty, lowStock, parseQty, searchProducts } from "@/lib/products";
import { expiringSoon, monthTotals, stockSummary } from "@/lib/stock";
import type { Product, StockMovement } from "@/lib/types";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const dateBR = (d: string) => d.split("-").reverse().join("/");
type View = "all" | "low" | "expiring";

/** Controle de Estoque: alertas, valor parado, entradas e saídas por produto e o histórico do mês. */
export default function Estoque() {
  const { kind } = useSpace();
  const { list, error, setList } = useProducts();
  const now = today();
  const [month, setMonth] = useState(now.slice(0, 7));
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("all");
  const [moving, setMoving] = useState<{ p: Product; kind: "in" | "out" } | null>(null);
  const [moves, setMoves] = useState<{ month: string; list: StockMovement[]; v: number } | null>(null);
  const [version, setVersion] = useState(0);
  const months = useRef<HTMLElement>(null);
  // No celular a fileira de meses começa em Janeiro: mostra o mês atual.
  useEffect(() => { months.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "nearest", inline: "center" }); }, [kind]);

  useEffect(() => {
    if (kind !== "business") return;
    let alive = true;
    repo.listStockMovements(month)
      .then((l) => { if (alive) setMoves({ month, list: l, v: version }); })
      .catch(() => { if (alive) setMoves({ month, list: [], v: version }); });
    return () => { alive = false; };
  }, [kind, month, version]);

  if (kind !== "business") {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 aria-hidden className="size-9 text-text-muted" />
        <h1 className="font-semibold">Estoque faz parte do Painel Empresarial</h1>
        <p className="max-w-md text-sm text-text-muted">Abra a aba Empresarial no topo da tela para controlar o estoque da sua empresa.</p>
      </Card>
    );
  }
  if (!list) return <div className="flex flex-col gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;

  const s = stockSummary(list, now);
  const shown = searchProducts(list, q).filter((p) => (view === "low" ? lowStock(p) : view === "expiring" ? expiringSoon(p, now) : true));
  const monthMoves = moves?.month === month ? moves.list : null;
  const mt = monthTotals(monthMoves ?? []);
  const year = now.slice(0, 4);

  const stat = (v: View, label: string, value: string, icon: React.ReactNode, tone: string) => (
    <button type="button" aria-pressed={view === v} onClick={() => setView((x) => (x === v ? "all" : v))}
      className="flex items-center gap-3 rounded-lg border border-border bg-bg p-4 text-left shadow-card hover:bg-surface aria-pressed:border-accent aria-pressed:ring-1 aria-pressed:ring-accent">
      <span className={`grid size-10 shrink-0 place-items-center rounded-pill ${tone}`}>{icon}</span>
      <span><span className="block text-xs text-text-muted">{label}</span><span className="num block text-xl font-bold">{value}</span></span>
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <nav ref={months} aria-label="Mês" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {MONTHS.map((m, i) => {
          const key = `${year}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button key={key} type="button" aria-pressed={month === key} onClick={() => setMonth(key)}
              className="h-9 shrink-0 rounded-md border border-border px-4 text-sm hover:bg-surface aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent">{m}</button>
          );
        })}
      </nav>

      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold"><Package aria-hidden className="size-5 text-accent" />Controle de Estoque</h1>
        <p className="text-sm text-text-muted">Gerencie entradas, saídas e alertas do seu estoque</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stat("low", "Estoque Baixo", String(s.low), <AlertTriangle aria-hidden className="size-5" />, "bg-warning-soft text-warning")}
        {stat("expiring", "Próx. Validade", String(s.expiring), <Clock aria-hidden className="size-5" />, "bg-accent-soft text-accent")}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-bg p-4 shadow-card">
          <span className="grid size-10 shrink-0 place-items-center rounded-pill bg-surface text-text-muted"><Box aria-hidden className="size-5" /></span>
          <span><span className="block text-xs text-text-muted">Valor em Estoque</span><span className="num block text-xl font-bold">{formatBRL(s.valueCents)}</span></span>
        </div>
      </div>
      <p className="-mt-2 text-xs text-text-muted">Valor em estoque a preço de custo. Próx. validade: produtos com lote vencendo em até 30 dias. Toque em um cartão para filtrar.</p>

      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produtos..." aria-label="Buscar produtos"
          className="h-11 w-full rounded-md border border-border bg-bg pl-9 pr-3 text-base placeholder:text-text-muted" />
      </div>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      {list.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <Package aria-hidden className="size-10 text-text-muted" />
          <h2 className="font-semibold">Nenhum produto no estoque</h2>
          <p className="text-sm text-text-muted">Cadastre seus produtos para controlar entradas e saídas</p>
          <Link href="/empresa/produtos/produto" className="mt-2 inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">
            <Plus aria-hidden className="size-4" />Cadastrar Produto
          </Link>
        </Card>
      ) : shown.length === 0 ? (
        <Card className="py-10 text-center text-sm text-text-muted">Nenhum produto encontrado{q && ` para “${q}”`}.</Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((p) => {
            const low = lowStock(p), exp = expiringSoon(p, now);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-bg px-4 py-3 shadow-card">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}{!p.active && <span className="ml-2 text-xs font-medium text-text-muted">(inativo)</span>}</p>
                  <p className="flex flex-wrap gap-x-3 text-xs text-text-muted">
                    <span>Estoque: <strong className={`num ${low ? "text-warning" : "text-text"}`}>{formatQty(p.stock)}</strong> {p.unit}</span>
                    <span>Mínimo: <span className="num">{formatQty(p.minStock)}</span></span>
                    <span>Custo: <span className="num">{formatBRL(p.costCents)}</span></span>
                    {p.expiresOn && p.stock > 0 && <span className={exp ? "font-semibold text-warning" : ""}>Validade: {dateBR(p.expiresOn)}</span>}
                  </p>
                </div>
                <span className="num font-bold">{formatBRL(p.priceCents)}</span>
                <div className="flex">
                  <Link href={`/empresa/produtos/produto?id=${p.id}`} aria-label={`Editar ${p.name}`} className="rounded-sm p-2 text-text-muted hover:bg-surface hover:text-text"><Pencil className="size-4" /></Link>
                  <button type="button" aria-label={`Entrada de ${p.name}`} title="Entrada" onClick={() => setMoving({ p, kind: "in" })} className="rounded-sm p-2 text-income hover:bg-surface"><ArrowUp className="size-4" /></button>
                  <button type="button" aria-label={`Saída de ${p.name}`} title="Saída" onClick={() => setMoving({ p, kind: "out" })} className="rounded-sm p-2 text-danger hover:bg-surface"><ArrowDown className="size-4" /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Movimentações de {MONTHS[Number(month.slice(5)) - 1]}</h2>
          <p className="flex gap-4 text-xs text-text-muted">
            <span>Entradas: <strong className="num text-income">{formatQty(mt.inQty)}</strong> ({formatBRL(mt.inCents)})</span>
            <span>Saídas: <strong className="num text-danger">{formatQty(mt.outQty)}</strong> ({formatBRL(mt.outCents)})</span>
          </p>
        </div>
        {!monthMoves ? <Skeleton className="h-16" /> : monthMoves.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-muted">Nenhuma entrada ou saída neste mês.</p>
        ) : (
          <ul className="divide-y divide-border">
            {monthMoves.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2 text-sm">
                <span className={`grid size-8 shrink-0 place-items-center rounded-pill ${m.kind === "in" ? "bg-accent-soft text-income" : "bg-danger-soft text-danger"}`}>
                  {m.kind === "in" ? <ArrowUp aria-label="Entrada" className="size-4" /> : <ArrowDown aria-label="Saída" className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{m.productName}</span>
                  <span className="block truncate text-xs text-text-muted">{dateBR(m.occurredOn)}{m.note && ` · ${m.note}`}{m.expiresOn && ` · validade ${dateBR(m.expiresOn)}`}</span>
                </span>
                <span className={`num font-semibold ${m.kind === "in" ? "text-income" : "text-danger"}`}>{m.kind === "in" ? "+" : "−"}{formatQty(m.qty)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {moving && (
        <MoveDialog product={moving.p} kind={moving.kind} onClose={() => setMoving(null)}
          onDone={(p) => { setList(list.map((x) => (x.id === p.id ? p : x))); setMoving(null); setVersion((v) => v + 1); }} />
      )}
    </div>
  );
}

function MoveDialog({ product, kind, onClose, onDone }: { product: Product; kind: "in" | "out"; onClose: () => void; onDone: (p: Product) => void }) {
  const { toast } = useShell();
  const [f, setF] = useState({ qty: "", cost: "", expires: "", note: "", day: today() });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => { setF((x) => ({ ...x, [k]: v })); setErr({}); };
  const qty = parseQty(f.qty);
  const after = qty != null && qty > 0 ? product.stock + (kind === "in" ? qty : -qty) : null;
  const isIn = kind === "in";

  async function save() {
    const e: Record<string, string> = {};
    const cost = f.cost ? parseBRL(f.cost) : null;
    if (qty == null || qty <= 0) e.qty = "Informe a quantidade.";
    else if (!isIn && qty > product.stock) e.qty = `A saída é maior que o estoque atual (${formatQty(product.stock)}).`;
    if (f.cost && cost == null) e.cost = "Valor inválido.";
    if (!f.day) e.day = "Informe a data.";
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const p = await repo.moveStock({ productId: product.id, kind, qty: qty!, unitCostCents: isIn ? cost : null, note: f.note.trim(), expiresOn: isIn && f.expires ? f.expires : null, occurredOn: f.day });
      toast(isIn ? "Entrada registrada" : "Saída registrada");
      onDone(p);
    } catch (x) { setErr({ form: x instanceof Error ? x.message : "Não foi possível registrar." }); }
    finally { setBusy(false); }
  }

  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-bold">{isIn ? "Entrada de estoque" : "Saída de estoque"}<span className="block text-sm font-normal text-text-muted">{product.name}</span></h2>}>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Quantidade (${product.unit}) *`} htmlFor="mv-qty" error={err.qty}>
            <Input id="mv-qty" inputMode="decimal" autoFocus className="num" placeholder="0" value={f.qty} onChange={(e) => set("qty")(e.target.value.replace(/[^\d,.]/g, ""))} aria-invalid={!!err.qty || undefined} />
          </Field>
          <Field label="Data" htmlFor="mv-day" error={err.day}>
            <Input id="mv-day" type="date" value={f.day} onChange={(e) => set("day")(e.target.value)} />
          </Field>
          {isIn && (
            <>
              <Field label="Custo unitário" htmlFor="mv-cost" error={err.cost} hint={`Vazio mantém ${formatBRL(product.costCents)}`}>
                <Input id="mv-cost" inputMode="decimal" className="num" placeholder={formatBRL(product.costCents).replace(/^R\$\s*/, "")} value={f.cost} onChange={(e) => set("cost")(e.target.value.replace(/[^\d,.]/g, ""))} />
              </Field>
              <Field label="Validade do lote" htmlFor="mv-exp" hint="Opcional">
                <Input id="mv-exp" type="date" value={f.expires} onChange={(e) => set("expires")(e.target.value)} />
              </Field>
            </>
          )}
        </div>
        <Field label="Observação" htmlFor="mv-note">
          <Input id="mv-note" maxLength={300} placeholder={isIn ? "Ex: Compra do fornecedor" : "Ex: Venda no balcão, perda, uso interno"} value={f.note} onChange={(e) => set("note")(e.target.value)} />
        </Field>
        <p className="rounded-md bg-surface px-3 py-2 text-sm">
          Estoque atual: <strong className="num">{formatQty(product.stock)}</strong> {product.unit}
          {after != null && after >= 0 && <> · depois: <strong className={`num ${isIn ? "text-income" : "text-danger"}`}>{formatQty(after)}</strong> {product.unit}</>}
        </p>
        {isIn && <p className="-mt-2 text-xs text-text-muted">Com custo informado, o custo do produto vira a média entre o estoque atual e esta compra.</p>}
        {err.form && <p role="alert" className="text-sm text-danger">{err.form}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={busy} variant={isIn ? "primary" : "danger"}>{isIn ? <ArrowUp aria-hidden className="size-4" /> : <ArrowDown aria-hidden className="size-4" />}{isIn ? "Registrar entrada" : "Registrar saída"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
