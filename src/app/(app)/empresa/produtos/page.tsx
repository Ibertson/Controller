"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Building2, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { useSpace } from "@/components/business";
import { Dialog } from "@/components/Dialog";
import { Button, Card, Skeleton } from "@/components/ui";
import { useProducts } from "@/components/products";
import { repo } from "@/lib/data";
import { formatBRL } from "@/lib/money";
import { catalogTotals, formatQty, lowStock, marginPct, searchProducts } from "@/lib/products";
import type { Product } from "@/lib/types";

const NEW = "/empresa/produtos/produto";

/** Produtos: catálogo com busca, totais do estoque e cadastro. */
export default function Produtos() {
  const { kind } = useSpace();
  const { toast } = useShell();
  const { list, error, setList } = useProducts();
  const [q, setQ] = useState("");
  const [removing, setRemoving] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);

  if (kind !== "business") {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 aria-hidden className="size-9 text-text-muted" />
        <h1 className="font-semibold">Produtos fazem parte do Painel Empresarial</h1>
        <p className="max-w-md text-sm text-text-muted">Abra a aba Empresarial no topo da tela para cadastrar os produtos da sua empresa.</p>
      </Card>
    );
  }
  if (!list) return <div className="flex flex-col gap-4"><Skeleton className="h-32" /><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;

  const shown = searchProducts(list, q);
  const t = catalogTotals(list);

  async function remove(p: Product) {
    setBusy(true);
    try { await repo.deleteProduct(p.id); setList(list!.filter((x) => x.id !== p.id)); toast("Produto excluído"); setRemoving(null); }
    catch (e) { toast(e instanceof Error ? e.message : "Não foi possível excluir."); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="text-xl font-bold">Produtos</h1><p className="text-sm text-text-muted">Gerencie seu catálogo de produtos</p></div>
          <Link href={NEW} className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">
            <Plus aria-hidden className="size-4" />Novo Produto
          </Link>
        </div>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produtos..." aria-label="Buscar produtos"
            className="h-11 w-full rounded-md border border-border bg-bg pl-9 pr-3 text-base placeholder:text-text-muted" />
        </div>
      </Card>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Total de produtos</p><p className="num mt-1 text-2xl font-bold">{t.count}</p></Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Estoque total</p>
          <p className="num mt-1 text-2xl font-bold text-accent">{formatQty(t.units)}</p>
          {t.low > 0 && <p className="mt-1 flex items-center gap-1 text-xs text-warning"><AlertTriangle aria-hidden className="size-3.5" />{t.low} com estoque baixo</p>}
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Valor total</p>
          <p className="num mt-1 text-2xl font-bold text-income">{formatBRL(t.valueCents)}</p>
          <p className="mt-1 text-xs text-text-muted">A preço de venda · custo {formatBRL(t.costCents)}</p>
        </Card>
      </div>

      {list.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <Package aria-hidden className="size-10 text-text-muted" />
          <h2 className="font-semibold">Nenhum produto cadastrado</h2>
          <p className="text-sm text-text-muted">Comece cadastrando seu primeiro produto</p>
          <Link href={NEW} className="mt-2 inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">
            <Plus aria-hidden className="size-4" />Cadastrar Produto
          </Link>
        </Card>
      ) : shown.length === 0 ? (
        <Card className="py-10 text-center text-sm text-text-muted">Nenhum produto encontrado para “{q}”.</Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((p) => {
            const m = marginPct(p);
            const low = lowStock(p);
            return (
              <li key={p.id}>
                <Card className="flex h-full gap-3">
                  <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md bg-surface text-text-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.photo ? <img src={p.photo} alt="" className="size-full object-cover" /> : <Package aria-hidden className="size-6" />}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold">{p.name}{!p.active && <span className="ml-2 rounded-pill bg-surface px-2 py-0.5 text-xs font-medium text-text-muted">Inativo</span>}</h2>
                        <p className="truncate text-xs text-text-muted">{[p.category, p.sku && `Cód. ${p.sku}`].filter(Boolean).join(" · ")}</p>
                      </div>
                      <div className="flex shrink-0">
                        <Link href={`${NEW}?id=${p.id}`} aria-label={`Editar ${p.name}`} className="rounded-sm p-2 text-text-muted hover:bg-surface hover:text-text"><Pencil className="size-4" /></Link>
                        <button type="button" aria-label={`Excluir ${p.name}`} onClick={() => setRemoving(p)} className="rounded-sm p-2 text-danger hover:bg-danger-soft"><Trash2 className="size-4" /></button>
                      </div>
                    </div>
                    <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                      <div>
                        <p className="num text-lg font-bold">{formatBRL(p.priceCents)}</p>
                        <p className="text-xs text-text-muted">Custo {formatBRL(p.costCents)}{m != null && ` · margem ${m.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}</p>
                      </div>
                      <span className={`num rounded-pill px-2 py-0.5 text-xs font-semibold ${low ? "bg-warning-soft text-warning" : "bg-surface text-text-muted"}`}>
                        {low && <AlertTriangle aria-hidden className="mr-1 inline size-3" />}{formatQty(p.stock)} {p.unit} em estoque
                      </span>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {removing && (
        <Dialog onClose={() => setRemoving(null)} title={<h2 className="text-lg font-bold">Excluir produto?</h2>}>
          <p className="text-sm text-text-muted">“{removing.name}” sai do catálogo. Isso não pode ser desfeito.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemoving(null)}>Cancelar</Button>
            <Button variant="danger" loading={busy} onClick={() => void remove(removing)}>Excluir</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
