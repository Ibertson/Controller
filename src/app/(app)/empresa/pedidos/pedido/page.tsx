"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Building2, FileText, Plus, Printer, Trash2 } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { useSpace } from "@/components/business";
import { OrderDocument } from "@/components/OrderDocument";
import { useOrders } from "@/components/orders";
import { Button, Card, Field, Input, Skeleton, inputClass } from "@/components/ui";
import { repo } from "@/lib/data";
import { today } from "@/lib/dates";
import { formatBRL, parseBRL } from "@/lib/money";
import { ORDER_STATUSES, formatOrderNumber, nextOrderNumber, orderTotals } from "@/lib/orders";
import type { BusinessClient, Order, OrderItem, OrderStatus, Product, Service } from "@/lib/types";

const LIST = "/empresa/pedidos";
const NEW_CLIENT = "__novo__";
const CUSTOM = "custom";
const centsText = (c: number) => (c ? formatBRL(c).replace(/^R\$\s*/, "") : "");
const qtyNum = (s: string) => { const n = Number(s.replace(",", ".")); return Number.isFinite(n) ? n : NaN; };

interface Row { id: string; pick: string; name: string; qty: string; price: string; description: string }
const emptyRow = (): Row => ({ id: crypto.randomUUID(), pick: "", name: "", qty: "1", price: "", description: "" });
const toRow = (i: OrderItem): Row => ({
  id: i.id, pick: i.productId ? `p:${i.productId}` : i.serviceId ? `s:${i.serviceId}` : CUSTOM, name: i.name,
  qty: String(i.qty).replace(".", ","), price: centsText(i.unitCents), description: i.description,
});

export default function PedidoPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><Pedido /></Suspense>;
}

function Pedido() {
  const id = useSearchParams().get("id");
  const { kind } = useSpace();
  const { data } = useOrders();
  // A tela fica guardada ao navegar (cacheComponents): cada visita começa um formulário novo.
  const [visit, setVisit] = useState(0);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- roda de novo quando a tela volta a aparecer
  useEffect(() => { setVisit((v) => v + 1); }, []);
  if (kind !== "business") {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 aria-hidden className="size-9 text-text-muted" />
        <h1 className="font-semibold">Pedidos faz parte do Painel Empresarial</h1>
      </Card>
    );
  }
  if (!data) return <div className="flex flex-col gap-4"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>;
  const saved = id ? data.orders.find((o) => o.id === id) : undefined;
  if (id && !saved) {
    return <Card className="flex flex-col items-center gap-3 py-10 text-center"><p className="font-semibold">Pedido não encontrado</p><Link href={LIST} className="text-sm font-semibold text-accent underline">Voltar para Pedidos</Link></Card>;
  }
  return <OrderForm key={`${saved?.id ?? "new"}-${visit}`} saved={saved} number={saved?.number ?? nextOrderNumber(data.orders)}
    clients={data.clients.filter((c) => !c.deletedAt || c.id === saved?.clientId)} products={data.products} services={data.services} />;
}

function OrderForm({ saved, number, clients, products, services }: { saved?: Order; number: number; clients: BusinessClient[]; products: Product[]; services: Service[] }) {
  const { toast } = useShell();
  const router = useRouter();
  const [f, setF] = useState({
    client: saved ? (saved.clientId && clients.some((c) => c.id === saved.clientId) ? saved.clientId : saved.clientName ? NEW_CLIENT : "") : "",
    newClient: saved && !saved.clientId ? saved.clientName : "",
    orderedOn: saved?.orderedOn ?? today(), deliveryOn: saved?.deliveryOn ?? "", notes: saved?.notes ?? "",
    discount: centsText(saved?.discountCents ?? 0), status: (saved?.status ?? "novo") as OrderStatus,
  });
  const [rows, setRows] = useState<Row[]>(saved?.items.length ? saved.items.map(toRow) : [emptyRow()]);
  const [err, setErr] = useState<Record<string, string>>({});
  const [fail, setFail] = useState("");
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((x) => ({ ...x, [k]: v })); setErr({}); };
  const setRow = (rid: string, patch: Partial<Row>) => { setRows((x) => x.map((r) => (r.id === rid ? { ...r, ...patch } : r))); setErr({}); };
  const activeProducts = products.filter((p) => p.active);
  const activeServices = services.filter((s) => s.active);

  const items = rows.map((r) => ({ qty: qtyNum(r.qty) || 0, unitCents: parseBRL(r.price) ?? 0 }));
  const discountCents = f.discount.trim() ? parseBRL(f.discount) ?? 0 : 0;
  const totals = orderTotals(items, discountCents);

  function pick(r: Row, value: string) {
    if (value.startsWith("p:")) {
      const p = products.find((x) => `p:${x.id}` === value)!;
      setRow(r.id, { pick: value, name: p.name, price: r.price && r.pick === value ? r.price : centsText(p.priceCents), description: r.description || p.description });
    } else if (value.startsWith("s:")) {
      const s = services.find((x) => `s:${x.id}` === value)!;
      setRow(r.id, { pick: value, name: s.name, price: r.price && r.pick === value ? r.price : centsText(s.priceCents), description: r.description || s.description });
    } else setRow(r.id, { pick: value, name: value === CUSTOM ? (r.pick === CUSTOM ? r.name : "") : "" });
  }

  function validate(): OrderItem[] | null {
    const e: Record<string, string> = {};
    if (!f.orderedOn) e.orderedOn = "Informe a data do pedido.";
    if (f.deliveryOn && f.orderedOn && f.deliveryOn < f.orderedOn) e.deliveryOn = "A entrega não pode ser antes do pedido.";
    if (f.client === NEW_CLIENT && !f.newClient.trim()) e.newClient = "Digite o nome do cliente.";
    const out: OrderItem[] = [];
    rows.forEach((r) => {
      const qty = qtyNum(r.qty);
      const unit = parseBRL(r.price);
      if (!r.pick) e[`pick-${r.id}`] = "Escolha do catálogo ou item avulso.";
      else if (r.pick === CUSTOM && !r.name.trim()) e[`pick-${r.id}`] = "Digite o nome do item.";
      if (!(qty > 0)) e[`qty-${r.id}`] = "Quantidade maior que zero.";
      if (!r.price.trim() || unit == null || unit < 0) e[`price-${r.id}`] = "Informe o preço.";
      out.push({
        id: r.id, productId: r.pick.startsWith("p:") ? r.pick.slice(2) : null, serviceId: r.pick.startsWith("s:") ? r.pick.slice(2) : null,
        name: r.name.trim(), description: r.description.trim(), qty: qty > 0 ? qty : 0, unitCents: unit ?? 0,
      });
    });
    if (f.discount.trim() && parseBRL(f.discount) == null) e.discount = "Desconto inválido.";
    else if (discountCents > totals.subtotal) e.discount = "Maior que o subtotal.";
    setErr(e);
    return Object.keys(e).length ? null : out;
  }

  async function save() {
    setFail("");
    const list = validate();
    if (!list) return;
    setBusy(true);
    try {
      let clientId: string | null = null;
      let clientName = "";
      if (f.client === NEW_CLIENT) {
        const c: BusinessClient = { id: crypto.randomUUID(), name: f.newClient.trim(), phone: "", kind: "eventual", notes: "", deletedAt: null, createdAt: new Date().toISOString() };
        await repo.saveClient(c);
        clientId = c.id; clientName = c.name;
      } else if (f.client) {
        clientId = f.client; clientName = clients.find((c) => c.id === f.client)?.name ?? "";
      }
      const order: Order = {
        id: saved?.id ?? crypto.randomUUID(), number, clientId, clientName, orderedOn: f.orderedOn, deliveryOn: f.deliveryOn || null,
        notes: f.notes.trim(), items: list, discountCents, status: f.status, createdAt: saved?.createdAt ?? new Date().toISOString(),
      };
      await repo.saveOrder(order);
      toast(saved ? "Pedido atualizado" : `${formatOrderNumber(number)} criado`);
      router.push(LIST);
    } catch (x) { setFail(x instanceof Error ? x.message : "Não foi possível salvar."); setBusy(false); }
  }

  const preview: Order | null = saved ? { ...saved } : null;

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <Link href={LIST} className="inline-flex items-center gap-1.5 self-start text-sm text-text-muted hover:text-text"><ArrowLeft aria-hidden className="size-4" />Voltar para Pedidos</Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{saved ? `Pedido ${formatOrderNumber(number)}` : "Novo Pedido"}</h1>
          <p className="text-sm text-text-muted">{saved ? "Altere os dados do pedido do seu cliente" : `Cadastre um novo pedido ou orçamento para seu cliente · ${formatOrderNumber(number)}`}</p>
        </div>
        {preview && <Button type="button" variant="secondary" onClick={() => setPrinting(true)}><Printer aria-hidden className="size-4" />Documentos</Button>}
      </header>

      <Section title={<><FileText aria-hidden className="size-5 text-accent" />Informações do Pedido</>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Field label="Cliente" htmlFor="pd-client">
              <select id="pd-client" value={f.client} onChange={(e) => set("client", e.target.value)} className={inputClass}>
                <option value="">Selecione um cliente</option>
                <option value={NEW_CLIENT}>＋ Novo cliente (digitar)</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            {f.client === NEW_CLIENT && (
              <Field label="Nome do novo cliente" htmlFor="pd-newclient" error={err.newClient} hint={saved ? undefined : "Ele também entra em Clientes & Recebíveis."}>
                <Input id="pd-newclient" maxLength={120} autoComplete="off" placeholder="Nome do cliente" value={f.newClient} onChange={(e) => set("newClient", e.target.value)} aria-invalid={!!err.newClient || undefined} />
              </Field>
            )}
          </div>
          <Field label="Data do Pedido *" htmlFor="pd-date" error={err.orderedOn}>
            <Input id="pd-date" type="date" value={f.orderedOn} onChange={(e) => set("orderedOn", e.target.value)} aria-invalid={!!err.orderedOn || undefined} />
          </Field>
          <Field label="Data de Entrega" htmlFor="pd-delivery" error={err.deliveryOn}>
            <Input id="pd-delivery" type="date" value={f.deliveryOn} onChange={(e) => set("deliveryOn", e.target.value)} aria-invalid={!!err.deliveryOn || undefined} />
          </Field>
          {saved && (
            <Field label="Situação" htmlFor="pd-status">
              <select id="pd-status" value={f.status} onChange={(e) => set("status", e.target.value as OrderStatus)} className={inputClass}>
                {ORDER_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Field>
          )}
          <div className="sm:col-span-2">
            <Field label="Observações" htmlFor="pd-notes">
              <textarea id="pd-notes" rows={3} maxLength={2000} placeholder="Detalhes adicionais do pedido..." value={f.notes} onChange={(e) => set("notes", e.target.value)}
                className={`${inputClass} !h-auto resize-y py-2`} />
            </Field>
          </div>
        </div>
      </Section>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Itens do Pedido</h2>
          <Button type="button" onClick={() => setRows((x) => [...x, emptyRow()])}><Plus aria-hidden className="size-4" />Adicionar Item</Button>
        </div>
        <ul className="flex flex-col gap-3">
          {rows.map((r, i) => {
            const n = i + 1;
            return (
              <li key={r.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_10rem_auto]">
                  <div className="col-span-2 flex flex-col gap-2 sm:col-span-1">
                    <Field label="Produto/Serviço *" htmlFor={`pd-pick-${r.id}`} error={err[`pick-${r.id}`]}>
                      <select id={`pd-pick-${r.id}`} value={r.pick} onChange={(e) => pick(r, e.target.value)} className={inputClass} aria-invalid={!!err[`pick-${r.id}`] || undefined}>
                        <option value="" disabled>Selecione do catálogo</option>
                        {activeProducts.length > 0 && <optgroup label="Produtos">{activeProducts.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.name} · {formatBRL(p.priceCents)}</option>)}</optgroup>}
                        {activeServices.length > 0 && <optgroup label="Serviços">{activeServices.map((s) => <option key={s.id} value={`s:${s.id}`}>{s.name} · {formatBRL(s.priceCents)}</option>)}</optgroup>}
                        {r.pick.startsWith("p:") && !activeProducts.some((p) => `p:${p.id}` === r.pick) && <option value={r.pick}>{r.name}</option>}
                        {r.pick.startsWith("s:") && !activeServices.some((s) => `s:${s.id}` === r.pick) && <option value={r.pick}>{r.name}</option>}
                        <option value={CUSTOM}>＋ Item avulso (digitar)</option>
                      </select>
                    </Field>
                    {r.pick === CUSTOM && (
                      <Input aria-label={`Nome do item ${n}`} maxLength={200} placeholder="Nome do produto ou serviço" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} />
                    )}
                  </div>
                  <Field label="Quantidade *" htmlFor={`pd-qty-${r.id}`} error={err[`qty-${r.id}`]}>
                    <Input id={`pd-qty-${r.id}`} type="number" inputMode="decimal" min={0} step="any" className="num" value={r.qty}
                      onChange={(e) => setRow(r.id, { qty: e.target.value })} aria-invalid={!!err[`qty-${r.id}`] || undefined} />
                  </Field>
                  <Field label="Preço Unit. *" htmlFor={`pd-price-${r.id}`} error={err[`price-${r.id}`]}>
                    <div className="relative">
                      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">R$</span>
                      <Input id={`pd-price-${r.id}`} inputMode="decimal" placeholder="0,00" className="num pl-10" value={r.price}
                        onChange={(e) => setRow(r.id, { price: e.target.value.replace(/[^\d,.]/g, "") })} aria-invalid={!!err[`price-${r.id}`] || undefined} />
                    </div>
                  </Field>
                  {rows.length > 1 && (
                    <button type="button" onClick={() => setRows((x) => x.filter((y) => y.id !== r.id))} aria-label={`Remover item ${n}`}
                      className="col-span-2 justify-self-end rounded-sm p-2 text-danger hover:bg-danger-soft sm:col-span-1 sm:mt-5 sm:self-start"><Trash2 className="size-4" /></button>
                  )}
                </div>
                <Field label="Descrição" htmlFor={`pd-desc-${r.id}`}>
                  <textarea id={`pd-desc-${r.id}`} rows={2} maxLength={500} placeholder="Detalhes do item..." value={r.description}
                    onChange={(e) => setRow(r.id, { description: e.target.value })} className={`${inputClass} !h-auto resize-y py-2`} />
                </Field>
                <p className="text-right text-sm text-text-muted">Total: <span className="num text-base font-bold text-text">{formatBRL(Math.round(items[i].qty * items[i].unitCents))}</span></p>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-3 border-t border-border pt-4 text-sm">
          <p className="flex justify-between"><span className="text-text-muted">Subtotal:</span><span className="num font-semibold">{formatBRL(totals.subtotal)}</span></p>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="pd-discount" className="text-text-muted">Desconto:</label>
            <div className="flex flex-col items-end gap-1">
              <div className="relative w-36">
                <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">R$</span>
                <input id="pd-discount" inputMode="decimal" placeholder="0,00" value={f.discount} onChange={(e) => set("discount", e.target.value.replace(/[^\d,.]/g, ""))}
                  aria-invalid={!!err.discount || undefined} className={`${inputClass} num !h-10 pl-10 text-right`} />
              </div>
              {err.discount && <p className="text-xs text-danger">{err.discount}</p>}
            </div>
          </div>
          <p className="flex items-baseline justify-between border-t border-border pt-3 text-base font-bold"><span>Total:</span><span className="num text-xl text-income">{formatBRL(totals.total)}</span></p>
        </div>
      </Card>

      {fail && <p role="alert" className="text-sm text-danger">{fail}</p>}
      {Object.keys(err).length > 0 && <p role="alert" className="text-sm text-danger">Confira os campos marcados.</p>}
      <div className="grid grid-cols-2 gap-3 pb-4">
        <Link href={LIST} className="inline-flex h-12 items-center justify-center rounded-md border border-border font-semibold hover:bg-surface">Cancelar</Link>
        <Button type="submit" size="lg" loading={busy}>Salvar Pedido</Button>
      </div>

      {printing && preview && <OrderDocument order={preview} client={preview.clientId ? clients.find((c) => c.id === preview.clientId) : undefined} onClose={() => setPrinting(false)} />}
    </form>
  );
}

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return <Card className="flex flex-col gap-4"><h2 className="flex items-center gap-2 text-lg font-semibold">{title}</h2>{children}</Card>;
}
