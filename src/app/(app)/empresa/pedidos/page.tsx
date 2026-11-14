"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, CalendarClock, Package, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { useSpace } from "@/components/business";
import { Dialog } from "@/components/Dialog";
import { OrderDocument } from "@/components/OrderDocument";
import { useOrders } from "@/components/orders";
import { Button, Card, Skeleton } from "@/components/ui";
import { repo } from "@/lib/data";
import { today } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { ORDER_STATUSES, filterOrders, formatOrderNumber, isLate, orderStatus, orderSummary, orderTotal } from "@/lib/orders";
import type { Order, OrderStatus } from "@/lib/types";

const NEW = "/empresa/pedidos/pedido";
const dateBR = (d: string) => d.split("-").reverse().join("/");
const newButton = "inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover";

/** Pedidos: o que os clientes pediram, em que pé está e quanto vale. */
export default function Pedidos() {
  const { kind } = useSpace();
  const { toast } = useShell();
  const { data, error, setData } = useOrders();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all" | "open">("all");
  const [printing, setPrinting] = useState<Order | null>(null);
  const [removing, setRemoving] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const now = today();

  if (kind !== "business") {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 aria-hidden className="size-9 text-text-muted" />
        <h1 className="font-semibold">Pedidos faz parte do Painel Empresarial</h1>
        <p className="max-w-md text-sm text-text-muted">Abra a aba Empresarial no topo da tela para cadastrar os pedidos dos seus clientes.</p>
      </Card>
    );
  }
  if (!data) return <div className="flex flex-col gap-4"><Skeleton className="h-32" /><Skeleton className="h-20" /><Skeleton className="h-64" /></div>;

  const s = orderSummary(data.orders);
  const shown = filterOrders(data.orders, query, status);
  const clientById = new Map(data.clients.map((c) => [c.id, c]));
  const put = (o: Order) => setData({ ...data, orders: data.orders.map((x) => (x.id === o.id ? o : x)) });

  async function changeStatus(o: Order, st: OrderStatus) {
    setFail("");
    const next = { ...o, status: st };
    try { await repo.saveOrder(next); put(next); toast(`${formatOrderNumber(o.number)}: ${orderStatus(st).label}`); }
    catch (x) { setFail(x instanceof Error ? x.message : "Não foi possível salvar."); }
  }
  async function remove(o: Order) {
    setBusy(true); setFail("");
    try { await repo.deleteOrder(o.id); setData({ ...data!, orders: data!.orders.filter((x) => x.id !== o.id) }); toast("Pedido excluído"); setRemoving(null); }
    catch (x) { setFail(x instanceof Error ? x.message : "Não foi possível excluir."); setRemoving(null); }
    finally { setBusy(false); }
  }

  const chips: { id: OrderStatus | "all" | "open"; label: string }[] = [{ id: "all", label: "Todos" }, { id: "open", label: "Em aberto" }, ...ORDER_STATUSES.map((x) => ({ id: x.id, label: x.label }))];

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Pedidos</h1>
            <p className="text-sm text-text-muted">Acompanhe os pedidos feitos pelos seus clientes</p>
          </div>
          <Link href={NEW} className={newButton}><Plus aria-hidden className="size-4" />Novo pedido</Link>
        </div>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <input type="search" aria-label="Buscar pedido" placeholder="Buscar por número ou cliente..." value={query} onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full rounded-md border border-border-input bg-bg pl-9 pr-3 text-base placeholder:text-text-muted" />
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Total de pedidos</p><p className="num mt-1 text-2xl font-bold">{s.count}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Em aberto</p><p className="num mt-1 text-2xl font-bold text-warning">{s.open}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Valor total</p><p className="num mt-1 text-2xl font-bold text-income">{formatBRL(s.totalCents)}</p></Card>
      </div>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {fail && <p role="alert" className="text-sm text-danger">{fail}</p>}

      {data.orders.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <Package aria-hidden className="size-10 text-text-muted" />
          <h2 className="font-semibold">Nenhum pedido cadastrado</h2>
          <p className="text-sm text-text-muted">Crie pedidos para gerar orçamento, ordem de serviço e recibos</p>
          <Link href={NEW} className={`${newButton} mt-2`}><Plus aria-hidden className="size-4" />Novo pedido</Link>
        </Card>
      ) : (
        <>
          <nav aria-label="Situação" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {chips.map((c) => (
              <button key={c.id} type="button" aria-pressed={status === c.id} onClick={() => setStatus(c.id)}
                className="h-9 shrink-0 rounded-md border border-border px-4 text-sm hover:bg-surface aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent">{c.label}</button>
            ))}
          </nav>
          {shown.length === 0 ? (
            <Card className="py-8 text-center text-sm text-text-muted">Nenhum pedido encontrado.</Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {shown.map((o) => {
                const late = isLate(o, now);
                return (
                  <li key={o.id}>
                    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Link href={`${NEW}?id=${o.id}`} className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="num font-bold">{formatOrderNumber(o.number)}</span>
                          <span className="truncate font-medium">{o.clientName || "Sem cliente"}</span>
                        </span>
                        <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted">
                          <span>Pedido em {dateBR(o.orderedOn)}</span>
                          {o.deliveryOn && <span className={`flex items-center gap-1 ${late ? "font-semibold text-danger" : ""}`}><CalendarClock aria-hidden className="size-3.5" />Entrega {dateBR(o.deliveryOn)}{late && " · atrasado"}</span>}
                          <span>{o.items.length} {o.items.length === 1 ? "item" : "itens"}</span>
                        </span>
                      </Link>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="num mr-auto font-bold sm:mr-2">{formatBRL(orderTotal(o))}</span>
                        <select aria-label={`Situação de ${formatOrderNumber(o.number)}`} value={o.status} onChange={(e) => void changeStatus(o, e.target.value as OrderStatus)}
                          className={`h-9 rounded-pill border-0 px-3 text-sm font-semibold ${orderStatus(o.status).tone}`}>
                          {ORDER_STATUSES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                        </select>
                        <button type="button" onClick={() => setPrinting(o)} aria-label={`Documentos de ${formatOrderNumber(o.number)}`} title="Orçamento, ordem de serviço e recibo"
                          className="rounded-sm p-2 text-text-muted hover:bg-surface hover:text-text"><Printer className="size-4" /></button>
                        <Link href={`${NEW}?id=${o.id}`} aria-label={`Editar ${formatOrderNumber(o.number)}`} className="rounded-sm p-2 text-text-muted hover:bg-surface hover:text-text"><Pencil className="size-4" /></Link>
                        <button type="button" onClick={() => setRemoving(o)} aria-label={`Excluir ${formatOrderNumber(o.number)}`} className="rounded-sm p-2 text-text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {printing && <OrderDocument order={printing} client={printing.clientId ? clientById.get(printing.clientId) : undefined} onClose={() => setPrinting(null)} />}
      {removing && (
        <Dialog onClose={() => setRemoving(null)} title={<h2 className="text-lg font-bold">Excluir pedido?</h2>}>
          <p className="text-sm text-text-muted">{formatOrderNumber(removing.number)}{removing.clientName ? ` de ${removing.clientName}` : ""} será excluído. Isso não pode ser desfeito.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemoving(null)}>Cancelar</Button>
            <Button variant="danger" loading={busy} onClick={() => void remove(removing)}>Excluir</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
