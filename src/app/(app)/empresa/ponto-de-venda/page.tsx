"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Ban, Building2, Check, Minus, Package, Plus, Printer, ReceiptText, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useShell } from "@/components/AppShell";
import { useSpace } from "@/components/business";
import { Dialog } from "@/components/Dialog";
import { Button, Card, Skeleton, inputClass } from "@/components/ui";
import { normName } from "@/lib/categories";
import { repo, useSnapshot } from "@/lib/data";
import { companyOf } from "@/lib/data/repo";
import { today } from "@/lib/dates";
import { formatBRL, parseBRL } from "@/lib/money";
import {
  POS_PAYMENTS, addToCart, cartTotals, changeDue, daySales, formatSaleNumber, nextSaleNumber, posPaymentLabel, productByCode,
  registerState, saleDescription, searchProducts, setQty, type CartLine,
} from "@/lib/pos";
import type { BusinessClient, CashRegister, PosPayment, PosSale, Product } from "@/lib/types";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SALE_CATEGORY = "Venda de produtos";
const qtyText = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const newId = () => crypto.randomUUID();
const time = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

type Data = { products: Product[]; clients: BusinessClient[]; sales: PosSale[]; registers: CashRegister[] };

/** Produtos, clientes, vendas e caixas do espaço aberto (recarrega ao trocar de espaço ou ao voltar à página). */
function usePos() {
  const wsId = useSnapshot()?.workspace.id;
  const [state, setState] = useState<{ ws?: string; data?: Data; error?: string }>({});
  useEffect(() => {
    if (!wsId) return;
    let alive = true;
    Promise.all([repo.listProducts(), repo.listClients().catch(() => []), repo.listSales(), repo.listCashRegisters().catch(() => [])])
      .then(([products, clients, sales, registers]) => { if (alive) setState({ ws: wsId, data: { products, clients, sales, registers } }); })
      .catch((e) => { if (alive) setState({ ws: wsId, data: { products: [], clients: [], sales: [], registers: [] }, error: e instanceof Error ? e.message : "Não foi possível carregar." }); });
    return () => { alive = false; };
  }, [wsId]);
  const ready = state.ws === wsId ? state : {};
  return { data: ready.data, error: ready.error, update: (f: (d: Data) => Data) => setState((s) => (s.data ? { ...s, data: f(s.data) } : s)) };
}

/** Ponto de Venda: escolher produtos, receber o pagamento, lançar a receita e dar baixa no estoque. */
export default function PontoDeVenda() {
  const { kind, company } = useSpace();
  const snap = useSnapshot();
  const { toast } = useShell();
  const { data, error, update } = usePos();
  const day = today();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("");
  const [payment, setPayment] = useState<PosPayment>("pix");
  const [received, setReceived] = useState("");
  const [clientId, setClientId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [done, setDone] = useState<PosSale | null>(null);
  const [receipt, setReceipt] = useState<PosSale | null>(null);
  const [cancelling, setCancelling] = useState<PosSale | null>(null);
  const cartRef = useRef<HTMLElement>(null);

  if (kind !== "business" || !company) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 aria-hidden className="size-9 text-text-muted" />
        <h1 className="font-semibold">Ponto de Venda faz parte do Painel Empresarial</h1>
        <p className="max-w-md text-sm text-text-muted">Abra a aba Empresarial no topo da tela para registrar vendas no balcão.</p>
      </Card>
    );
  }
  if (!data || !snap) return <div className="grid gap-4 lg:grid-cols-[1fr_360px]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>;

  const accounts = snap.accounts.filter((a) => !a.archived);
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const shown = searchProducts(data.products, query);
  const discountCents = parseBRL(discount) ?? 0;
  const t = cartTotals(cart, discountCents);
  const receivedCents = payment === "dinheiro" && received.trim() ? parseBRL(received) : null;
  const change = payment === "dinheiro" ? changeDue(t.total, receivedCents) : 0;
  const reg = registerState(data.registers, day);
  const todays = daySales(data.sales, day);
  const clients = data.clients.filter((c) => !c.deletedAt).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  function add(p: Product) {
    const r = addToCart(cart, p);
    if (r.error) { toast(r.error); return; }
    setCart(r.cart); setFail("");
  }
  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const byCode = productByCode(data!.products, query);
    const only = shown.length === 1 ? shown[0] : undefined;
    const p = byCode ?? only;
    if (p) { add(p); setQuery(""); } else if (query.trim()) toast("Nenhum produto com esse código.");
  }
  function reset() { setCart([]); setDiscount(""); setReceived(""); setClientId(""); setPayment("pix"); setFail(""); }

  async function saleCategory(): Promise<string> {
    const found = snap!.categories.find((c) => !c.archived && c.kind !== "expense" && normName(c.name) === normName(SALE_CATEGORY));
    if (found) return found.id;
    return (await repo.upsertCategory({ name: SALE_CATEGORY, icon: "shopping-bag", kind: "income", monthlyLimitCents: null, archived: false, color: null, parentId: null })).id;
  }

  async function finish() {
    setFail("");
    if (!cart.length) return;
    if (!account) { setFail("Cadastre uma conta para receber as vendas."); return; }
    if (discount.trim() && parseBRL(discount) == null) { setFail("Desconto inválido."); return; }
    if (t.total <= 0) { setFail("O total da venda precisa ser maior que zero."); return; }
    if (payment === "dinheiro" && received.trim() && receivedCents == null) { setFail("Valor recebido inválido."); return; }
    if (change == null) { setFail(`Faltam ${formatBRL(t.total - (receivedCents ?? 0))} para completar o pagamento.`); return; }
    setBusy(true);
    const number = nextSaleNumber(data!.sales);
    const items = cart.map(({ productId, name, qty, unitCents }) => ({ productId, name, qty, unitCents }));
    const client = clients.find((c) => c.id === clientId);
    let txId: string | null = null;
    const moved: { productId: string; qty: number }[] = [];
    let products = data!.products;
    try {
      const categoryId = await saleCategory();
      const [tx] = await repo.createTransaction({ kind: "income", amountCents: t.total, occurredOn: day, description: saleDescription(number, items), categoryId, accountId: account.id, isPaid: true });
      txId = tx.id;
      for (const i of items) {
        const p = await repo.moveStock({ productId: i.productId, kind: "out", qty: i.qty, unitCostCents: null, note: `Venda ${formatSaleNumber(number)}`, expiresOn: null, occurredOn: day });
        moved.push(i); products = products.map((x) => (x.id === p.id ? p : x));
      }
      const sale: PosSale = {
        id: newId(), number, soldOn: day, items, discountCents: t.discount, totalCents: t.total, paymentMethod: payment,
        receivedCents: payment === "dinheiro" ? receivedCents ?? t.total : null, clientId: client?.id ?? null, clientName: client?.name ?? "",
        accountId: account.id, transactionId: txId, status: "concluida", createdAt: new Date().toISOString(),
      };
      await repo.saveSale(sale);
      let registers = data!.registers;
      const open = registers.find((r) => r.day === day && r.status === "open");
      if (payment === "dinheiro" && open) {
        const next = { ...open, movements: [...open.movements, { id: newId(), kind: "venda" as const, amountCents: t.total, reason: `Venda ${formatSaleNumber(number)}`, at: new Date().toISOString() }] };
        try { await repo.saveCashRegister(next); registers = registers.map((r) => (r.id === next.id ? next : r)); }
        catch { toast("Venda registrada, mas não entrou no Caixa Diário."); }
      }
      update((d) => ({ ...d, products, registers, sales: [...d.sales, sale] }));
      setDone(sale); reset();
    } catch (x) {
      // desfaz o que já foi feito para não ficar receita sem venda ou estoque baixado à toa
      for (const m of moved) await repo.moveStock({ productId: m.productId, kind: "in", qty: m.qty, unitCostCents: null, note: "Estorno de venda não concluída", expiresOn: null, occurredOn: day }).catch(() => {});
      if (txId) await repo.purgeTransactions([txId]).catch(() => {});
      if (moved.length) repo.listProducts().then((list) => update((d) => ({ ...d, products: list }))).catch(() => {});
      setFail(x instanceof Error ? x.message : "Não foi possível concluir a venda.");
    } finally { setBusy(false); }
  }

  async function cancelSale(s: PosSale) {
    setBusy(true);
    try {
      if (s.transactionId) await repo.trashTransactions([s.transactionId]);
      let products = data!.products;
      for (const i of s.items) {
        const p = await repo.moveStock({ productId: i.productId, kind: "in", qty: i.qty, unitCostCents: null, note: `Cancelamento ${formatSaleNumber(s.number)}`, expiresOn: null, occurredOn: today() }).catch(() => null);
        if (p) products = products.map((x) => (x.id === p.id ? p : x));
      }
      const next: PosSale = { ...s, status: "cancelada" };
      await repo.saveSale(next);
      let registers = data!.registers;
      const reg = registers.find((r) => r.day === s.soldOn);
      const reason = `Venda ${formatSaleNumber(s.number)}`;
      if (s.paymentMethod === "dinheiro" && reg?.movements.some((m) => m.kind === "venda" && m.reason === reason)) {
        if (reg.status === "open") {
          const r2 = { ...reg, movements: reg.movements.filter((m) => !(m.kind === "venda" && m.reason === reason)) };
          await repo.saveCashRegister(r2).then(() => { registers = registers.map((r) => (r.id === r2.id ? r2 : r)); }).catch(() => toast("Tire a venda do Caixa Diário manualmente."));
        } else toast("O caixa do dia já foi fechado: a venda continua na conferência dele.");
      }
      update((d) => ({ ...d, products, registers, sales: d.sales.map((x) => (x.id === s.id ? next : x)) }));
      toast(`Venda ${formatSaleNumber(s.number)} cancelada`);
    } catch (x) { toast(x instanceof Error ? x.message : "Não foi possível cancelar."); }
    finally { setBusy(false); setCancelling(null); }
  }

  const regPill = reg === "aberto"
    ? <span className="inline-flex items-center gap-1.5 rounded-pill bg-income/10 px-3 py-1 text-xs font-semibold text-income"><span aria-hidden className="size-2 rounded-pill bg-income" />Caixa aberto</span>
    : <Link href="/empresa/caixa" className="inline-flex items-center gap-1.5 rounded-pill bg-surface px-3 py-1 text-xs font-semibold text-text-muted hover:underline"><span aria-hidden className="size-2 rounded-pill bg-text-muted" />{reg === "fechado" ? "Caixa fechado" : "Caixa não aberto"}</Link>;

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Mês" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {MONTHS.map((m, i) => {
          const cur = i + 1 === Number(day.slice(5, 7));
          return <Link key={m} href="/empresa/caixa" aria-current={cur ? "date" : undefined} title="Ver no Caixa Diário"
            className="grid h-9 shrink-0 place-items-center rounded-md border border-border px-4 text-sm hover:bg-surface aria-[current=date]:border-accent aria-[current=date]:bg-accent-soft aria-[current=date]:font-semibold aria-[current=date]:text-accent">{m}</Link>;
        })}
      </nav>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold"><ShoppingCart aria-hidden className="size-5 text-accent" />Ponto de Venda</h1>
              <p className="text-sm text-text-muted">Selecione os produtos para adicionar ao carrinho</p>
            </div>
            {regPill}
          </div>
          <label className="relative block">
            <span className="sr-only">Buscar produto</span>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onSearchKey} placeholder="Buscar produto ou código de barras..." className={`${inputClass} pl-9`} />
          </label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {data.products.filter((p) => p.active).length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
              <Package aria-hidden className="size-9 text-text-muted" />
              <p className="text-sm text-text-muted">Nenhum produto cadastrado.</p>
              <Link href="/empresa/produtos/produto" className="text-sm font-semibold text-accent hover:underline">Cadastrar produto</Link>
            </div>
          ) : shown.length === 0 ? <p className="py-10 text-center text-sm text-text-muted">Nenhum produto encontrado.</p> : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {shown.map((p) => {
                const inCart = cart.find((l) => l.productId === p.id)?.qty ?? 0;
                const out = p.stock <= 0;
                return (
                  <li key={p.id}>
                    <button type="button" onClick={() => add(p)} disabled={out} aria-label={`Adicionar ${p.name}, ${formatBRL(p.priceCents)}`}
                      className="relative flex h-full w-full flex-col gap-2 rounded-lg border border-border p-2.5 text-left hover:border-accent disabled:cursor-not-allowed disabled:opacity-50">
                      <span className="self-end text-[11px] text-text-muted">{p.category}</span>
                      <span className="grid aspect-[4/3] place-items-center overflow-hidden rounded-md bg-surface">
                        {p.photo ? <img src={p.photo} alt="" className="size-full object-cover" /> : <Package aria-hidden className="size-7 text-text-muted" />}
                      </span>
                      <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                      <span className="num font-bold text-accent">{formatBRL(p.priceCents)}</span>
                      <span className={`text-xs ${out ? "text-danger" : "text-text-muted"}`}>{out ? "Sem estoque" : `${qtyText(p.stock)} ${p.unit || "un."}`}</span>
                      {inCart > 0 && <span className="num absolute left-2 top-2 grid size-6 place-items-center rounded-pill bg-accent text-xs font-bold text-on-accent">{qtyText(inCart)}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col gap-3 lg:sticky lg:top-20">
          <section ref={cartRef} aria-labelledby="pdv-cart" className="scroll-mt-24">
            <div className="flex items-center justify-between">
              <h2 id="pdv-cart" className="flex items-center gap-2 font-semibold"><ShoppingCart aria-hidden className="size-4" />Carrinho</h2>
              <span className="num rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">{qtyText(t.units)} {t.units === 1 ? "item" : "itens"}</span>
            </div>
            {cart.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-10 text-center">
                <ShoppingCart aria-hidden className="size-9 text-text-muted" />
                <p className="text-sm text-text-muted">Carrinho vazio</p>
                <p className="text-xs text-text-muted">Adicione produtos para começar</p>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                <ul className="flex flex-col divide-y divide-border">
                  {cart.map((l) => (
                    <li key={l.productId} className="flex items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{l.name}</p>
                        <p className="num text-xs text-text-muted">{formatBRL(l.unitCents)} · {formatBRL(Math.round(l.qty * l.unitCents))}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label={`Diminuir ${l.name}`} onClick={() => setCart(setQty(cart, l.productId, l.qty - 1))} className="grid size-7 place-items-center rounded-md border border-border hover:bg-surface"><Minus className="size-3.5" /></button>
                        <span className="num w-8 text-center text-sm font-semibold" aria-label={`Quantidade de ${l.name}`}>{qtyText(l.qty)}</span>
                        <button type="button" aria-label={`Aumentar ${l.name}`} disabled={l.qty >= l.stock} onClick={() => setCart(setQty(cart, l.productId, l.qty + 1))} className="grid size-7 place-items-center rounded-md border border-border hover:bg-surface disabled:opacity-40"><Plus className="size-3.5" /></button>
                        <button type="button" aria-label={`Remover ${l.name}`} onClick={() => setCart(setQty(cart, l.productId, 0))} className="grid size-7 place-items-center rounded-md text-text-muted hover:bg-surface hover:text-danger"><Trash2 className="size-3.5" /></button>
                      </div>
                    </li>
                  ))}
                </ul>

                <label className="flex flex-col gap-1 text-sm"><span className="text-text-muted">Cliente (opcional)</span>
                  <select id="pdv-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}>
                    <option value="">Consumidor final</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm"><span className="text-text-muted">Desconto (R$)</span>
                  <input id="pdv-discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0,00" className={inputClass} />
                </label>

                <fieldset>
                  <legend className="mb-1 text-sm text-text-muted">Forma de pagamento</legend>
                  <div className="grid grid-cols-4 gap-1">
                    {POS_PAYMENTS.map((m) => (
                      <button key={m.id} type="button" aria-pressed={payment === m.id} onClick={() => setPayment(m.id)}
                        className="h-9 rounded-md border border-border text-xs font-medium hover:bg-surface aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent">{m.label}</button>
                    ))}
                  </div>
                </fieldset>
                {payment === "dinheiro" && (
                  <label className="flex flex-col gap-1 text-sm"><span className="text-text-muted">Valor recebido (R$)</span>
                    <input id="pdv-received" inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value)} placeholder={formatBRL(t.total).replace(/^R\$\s*/, "")} className={inputClass} />
                  </label>
                )}
                {accounts.length > 1 && (
                  <label className="flex flex-col gap-1 text-sm"><span className="text-text-muted">Conta de entrada</span>
                    <select id="pdv-account" value={account?.id ?? ""} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </label>
                )}

                <dl className="num flex flex-col gap-1 border-t border-border pt-3 text-sm">
                  <div className="flex justify-between"><dt className="text-text-muted">Subtotal</dt><dd>{formatBRL(t.subtotal)}</dd></div>
                  {t.discount > 0 && <div className="flex justify-between"><dt className="text-text-muted">Desconto</dt><dd className="text-danger">−{formatBRL(t.discount)}</dd></div>}
                  <div className="flex justify-between text-lg font-bold"><dt>Total</dt><dd>{formatBRL(t.total)}</dd></div>
                  {payment === "dinheiro" && receivedCents != null && change != null && <div className="flex justify-between text-income"><dt>Troco</dt><dd className="font-semibold">{formatBRL(change)}</dd></div>}
                </dl>
                {fail && <p role="alert" className="text-sm text-danger">{fail}</p>}
                <Button onClick={finish} loading={busy} disabled={busy}><Check aria-hidden className="size-4" />Finalizar venda</Button>
                <button type="button" onClick={reset} className="text-sm text-text-muted hover:text-danger">Limpar carrinho</button>
              </div>
            )}
          </section>
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Vendas de hoje</h2>
          <p className="num text-sm text-text-muted">{todays.count} {todays.count === 1 ? "venda" : "vendas"} · <strong className="text-text">{formatBRL(todays.totalCents)}</strong></p>
        </div>
        {todays.sales.length === 0 ? <p className="py-4 text-center text-sm text-text-muted">Nenhuma venda hoje.</p> : (
          <ul className="flex flex-col divide-y divide-border">
            {todays.sales.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="num text-sm font-semibold">{formatSaleNumber(s.number)}</span>
                <span className="num text-xs text-text-muted">{time(s.createdAt)}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-text-muted">{s.items.map((i) => `${i.name} x${qtyText(i.qty)}`).join(", ")}</span>
                <span className="text-xs text-text-muted">{posPaymentLabel(s.paymentMethod)}</span>
                <span className={`num text-sm font-semibold ${s.status === "cancelada" ? "text-text-muted line-through" : ""}`}>{formatBRL(s.totalCents)}</span>
                {s.status === "cancelada" ? <span className="text-xs font-semibold text-danger">Cancelada</span> : <>
                  <button type="button" onClick={() => setReceipt(s)} aria-label={`Recibo da ${formatSaleNumber(s.number)}`} className="rounded-md p-1.5 text-text-muted hover:bg-surface"><ReceiptText className="size-4" /></button>
                  <button type="button" onClick={() => setCancelling(s)} aria-label={`Cancelar ${formatSaleNumber(s.number)}`} className="rounded-md p-1.5 text-text-muted hover:bg-surface hover:text-danger"><Ban className="size-4" /></button>
                </>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {cart.length > 0 && (
        <button type="button" onClick={() => cartRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="num fixed inset-x-4 bottom-20 z-30 flex h-12 items-center justify-between rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent shadow-card lg:hidden">
          <span className="flex items-center gap-2"><ShoppingCart aria-hidden className="size-4" />Ver carrinho ({qtyText(t.units)})</span><span>{formatBRL(t.total)}</span>
        </button>
      )}

      {done && (
        <Dialog title="Venda concluída" onClose={() => setDone(null)}>
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="grid size-12 place-items-center rounded-pill bg-income/15 text-income"><Check className="size-6" /></span>
            <p className="num text-2xl font-bold">{formatBRL(done.totalCents)}</p>
            <p className="text-sm text-text-muted">{formatSaleNumber(done.number)} · {posPaymentLabel(done.paymentMethod)}{done.clientName ? ` · ${done.clientName}` : ""}</p>
            {done.paymentMethod === "dinheiro" && done.receivedCents != null && done.receivedCents > done.totalCents && <p className="num font-semibold text-income">Troco: {formatBRL(done.receivedCents - done.totalCents)}</p>}
            <p className="text-xs text-text-muted">Receita lançada e estoque atualizado{done.paymentMethod === "dinheiro" && reg === "aberto" ? ", com entrada no Caixa Diário" : ""}.</p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => { setReceipt(done); setDone(null); }}><Printer aria-hidden className="size-4" />Recibo</Button>
            <Button onClick={() => setDone(null)}>Nova venda</Button>
          </div>
        </Dialog>
      )}

      {cancelling && (
        <Dialog title={`Cancelar ${formatSaleNumber(cancelling.number)}?`} onClose={() => setCancelling(null)}>
          <p className="text-sm text-text-muted">A receita de {formatBRL(cancelling.totalCents)} vai para a lixeira e os produtos voltam ao estoque.</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCancelling(null)}>Voltar</Button>
            <Button variant="danger" loading={busy} onClick={() => cancelSale(cancelling)}>Cancelar venda</Button>
          </div>
        </Dialog>
      )}

      {receipt && <Receipt sale={receipt} company={companyOf(snap.workspace)?.name ?? snap.workspace.name} cnpj={company.cnpj} onClose={() => setReceipt(null)} />}
    </div>
  );
}

/** Recibo da venda para imprimir ou salvar em PDF. */
function Receipt({ sale, company, cnpj, onClose }: { sale: PosSale; company: string; cnpj: string | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const sub = sale.items.reduce((s, i) => s + Math.round(i.qty * i.unitCents), 0);
  return createPortal(
    <div data-print-root role="dialog" aria-modal="true" aria-label={`Recibo ${formatSaleNumber(sale.number)}`} className="fixed inset-0 z-50 overflow-y-auto bg-surface px-3 py-4">
      <div className="mx-auto mb-3 flex max-w-sm justify-end gap-2 print:hidden">
        <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover"><Printer aria-hidden className="size-4" />Imprimir / PDF</button>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-md bg-bg p-2 hover:bg-surface-raised"><X className="size-5" /></button>
      </div>
      <article className="num mx-auto flex max-w-sm flex-col gap-3 rounded-lg bg-white p-5 font-mono text-sm text-[#1a1a1a] shadow-card print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="border-b border-dashed border-[#999] pb-2 text-center">
          <p className="font-bold">{company}</p>
          {cnpj && <p className="text-xs">CNPJ {cnpj}</p>}
          <p className="mt-1 text-xs">Recibo {formatSaleNumber(sale.number)} · {sale.soldOn.split("-").reverse().join("/")} {time(sale.createdAt)}</p>
          {sale.status === "cancelada" && <p className="mt-1 font-bold">VENDA CANCELADA</p>}
        </header>
        <ul className="flex flex-col gap-1">
          {sale.items.map((i) => (
            <li key={i.productId}>
              <p>{i.name}</p>
              <p className="flex justify-between text-xs"><span>{qtyText(i.qty)} x {formatBRL(i.unitCents)}</span><span>{formatBRL(Math.round(i.qty * i.unitCents))}</span></p>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-0.5 border-t border-dashed border-[#999] pt-2">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatBRL(sub)}</dd></div>
          {sale.discountCents > 0 && <div className="flex justify-between"><dt>Desconto</dt><dd>−{formatBRL(sale.discountCents)}</dd></div>}
          <div className="flex justify-between font-bold"><dt>Total</dt><dd>{formatBRL(sale.totalCents)}</dd></div>
          <div className="flex justify-between"><dt>Pagamento</dt><dd>{posPaymentLabel(sale.paymentMethod)}</dd></div>
          {sale.paymentMethod === "dinheiro" && sale.receivedCents != null && <>
            <div className="flex justify-between"><dt>Recebido</dt><dd>{formatBRL(sale.receivedCents)}</dd></div>
            <div className="flex justify-between"><dt>Troco</dt><dd>{formatBRL(Math.max(0, sale.receivedCents - sale.totalCents))}</dd></div>
          </>}
        </dl>
        {sale.clientName && <p className="text-xs">Cliente: {sale.clientName}</p>}
        <p className="border-t border-dashed border-[#999] pt-2 text-center text-xs">Obrigado pela preferência! Este recibo não é documento fiscal.</p>
      </article>
    </div>,
    document.body,
  );
}
