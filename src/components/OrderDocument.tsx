"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { useSnapshot } from "@/lib/data";
import { companyOf } from "@/lib/data/repo";
import { formatBRL } from "@/lib/money";
import { formatOrderNumber, itemTotal, orderStatus, orderTotals } from "@/lib/orders";
import type { BusinessClient, Order } from "@/lib/types";

export type OrderDoc = "pedido" | "os" | "recibo";
const DOCS: { id: OrderDoc; label: string; title: string }[] = [
  { id: "pedido", label: "Pedido / Orçamento", title: "Pedido" },
  { id: "os", label: "Ordem de Serviço", title: "Ordem de Serviço" },
  { id: "recibo", label: "Recibo", title: "Recibo" },
];
const dateBR = (d: string) => d.split("-").reverse().join("/");
const qtyText = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

/** Documento para imprimir ou salvar em PDF: pedido, ordem de serviço ou recibo. */
export function OrderDocument({ order, client, onClose }: { order: Order; client?: BusinessClient; onClose: () => void }) {
  const snap = useSnapshot();
  const company = snap ? companyOf(snap.workspace) : null;
  const [doc, setDoc] = useState<OrderDoc>("pedido");
  const t = orderTotals(order.items, order.discountCents);
  const info = DOCS.find((d) => d.id === doc)!;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div data-print-root role="dialog" aria-modal="true" aria-label={`${info.title} ${formatOrderNumber(order.number)}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-surface px-3 py-4 sm:px-6">
      <div className="mx-auto mb-3 flex max-w-3xl flex-wrap items-center gap-2 print:hidden">
        <div role="tablist" aria-label="Documento" className="flex flex-1 flex-wrap gap-1 rounded-md bg-bg p-1">
          {DOCS.map((d) => (
            <button key={d.id} role="tab" type="button" aria-selected={doc === d.id} onClick={() => setDoc(d.id)}
              className="rounded-sm px-3 py-1.5 text-sm font-medium aria-selected:bg-accent aria-selected:text-on-accent">{d.label}</button>
          ))}
        </div>
        <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">
          <Printer aria-hidden className="size-4" />Imprimir / PDF</button>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-md bg-bg p-2 hover:bg-surface-raised"><X className="size-5" /></button>
      </div>

      <article className="mx-auto flex max-w-3xl flex-col gap-5 rounded-lg bg-white p-5 text-[#1a1a1a] shadow-card sm:p-8 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#ddd] pb-4">
          <div>
            <p className="text-lg font-bold">{company?.name ?? snap?.workspace.name}</p>
            {company?.cnpj && <p className="text-sm text-[#555]">CNPJ {company.cnpj}</p>}
            {company?.activity && <p className="text-sm text-[#555]">{company.activity}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{info.title}</p>
            <p className="text-sm text-[#555]">{formatOrderNumber(order.number)}</p>
            <p className="text-sm text-[#555]">Data: {dateBR(order.orderedOn)}</p>
          </div>
        </header>

        {doc === "recibo" ? (
          <section className="flex flex-col gap-4 text-[15px] leading-relaxed">
            <p className="text-2xl font-bold">{formatBRL(t.total)}</p>
            <p>
              Recebi(emos) de <strong>{order.clientName || "________________________"}</strong> a importância de <strong>{formatBRL(t.total)}</strong>,
              referente ao pedido {formatOrderNumber(order.number)}: {order.items.map((i) => `${qtyText(i.qty)} × ${i.name}`).join(", ") || "itens do pedido"}.
            </p>
            <p>Para clareza, firmo(amos) o presente recibo.</p>
          </section>
        ) : (
          <>
            <section className="grid gap-1 text-sm sm:grid-cols-2">
              <p><span className="text-[#555]">Cliente: </span><strong>{order.clientName || "Não informado"}</strong></p>
              {client?.phone && <p><span className="text-[#555]">Telefone: </span>{client.phone}</p>}
              {order.deliveryOn && <p><span className="text-[#555]">{doc === "os" ? "Previsão de entrega: " : "Entrega: "}</span>{dateBR(order.deliveryOn)}</p>}
              <p><span className="text-[#555]">Situação: </span>{orderStatus(order.status).label}</p>
            </section>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#ccc] text-left text-xs uppercase text-[#555]">
                  <th scope="col" className="py-2 pr-2">Item</th>
                  <th scope="col" className="py-2 pr-2 text-right">Qtd.</th>
                  {doc === "pedido" && <th scope="col" className="py-2 pr-2 text-right">Unitário</th>}
                  {doc === "pedido" && <th scope="col" className="py-2 text-right">Total</th>}
                  {doc === "os" && <th scope="col" className="py-2 text-center">Feito</th>}
                </tr>
              </thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id} className="border-b border-[#eee] align-top">
                    <td className="py-2 pr-2"><span className="font-medium">{i.name}</span>{i.description && <span className="block text-xs text-[#555]">{i.description}</span>}</td>
                    <td className="py-2 pr-2 text-right">{qtyText(i.qty)}</td>
                    {doc === "pedido" && <td className="py-2 pr-2 text-right">{formatBRL(i.unitCents)}</td>}
                    {doc === "pedido" && <td className="py-2 text-right font-medium">{formatBRL(itemTotal(i))}</td>}
                    {doc === "os" && <td className="py-2 text-center"><span aria-hidden className="inline-block size-4 border border-[#888]" /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            <section className="ml-auto flex w-full max-w-xs flex-col gap-1 text-sm">
              <p className="flex justify-between"><span className="text-[#555]">Subtotal</span><span>{formatBRL(t.subtotal)}</span></p>
              {t.discount > 0 && <p className="flex justify-between"><span className="text-[#555]">Desconto</span><span>− {formatBRL(t.discount)}</span></p>}
              <p className="flex justify-between border-t border-[#ccc] pt-1 text-base font-bold"><span>Total</span><span>{formatBRL(t.total)}</span></p>
            </section>
            {order.notes && <section className="text-sm"><p className="font-semibold">Observações</p><p className="whitespace-pre-wrap text-[#333]">{order.notes}</p></section>}
          </>
        )}

        <footer className="mt-8 grid gap-8 text-center text-sm sm:grid-cols-2">
          {doc === "recibo" ? (
            <p className="sm:col-span-2 sm:mx-auto sm:w-1/2"><span className="block border-t border-[#888] pt-1">{company?.name ?? "Assinatura"}</span></p>
          ) : (
            <>
              <p><span className="block border-t border-[#888] pt-1">{company?.name ?? "Empresa"}</span></p>
              <p><span className="block border-t border-[#888] pt-1">{order.clientName || "Cliente"}</span></p>
            </>
          )}
        </footer>
      </article>
    </div>,
    document.body,
  );
}
