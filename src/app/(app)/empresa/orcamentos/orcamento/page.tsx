"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Copy, ExternalLink, FileText, MessageCircle, Plus, Save, Trash2, X } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { useSpace } from "@/components/business";
import { Dialog } from "@/components/Dialog";
import { useProducts } from "@/components/products";
import { useQuotes } from "@/components/quotes";
import { useServices } from "@/components/services";
import { Button, Card, Field, Input, Skeleton, inputClass } from "@/components/ui";
import { repo } from "@/lib/data";
import { today } from "@/lib/dates";
import { formatBRL, parseBRL } from "@/lib/money";
import { formatQty, parseQty } from "@/lib/products";
import { QUOTE_STATUSES, addDays, effectiveStatus, formatNumber, itemTotal, itemsFromCalc, nextNumber, quoteTotals, statusLabel, whatsappShare } from "@/lib/quotes";
import type { Company, Quote, QuoteItem, QuoteKind, QuoteStatus } from "@/lib/types";

const LIST = "/empresa/orcamentos";
const centsText = (c: number) => (c ? formatBRL(c).replace(/^R\$\s*/, "") : "");
const KINDS: Record<QuoteKind, string> = { produtos: "Venda de Produtos", personalizado: "Personalizado", servico: "Serviço" };

export default function OrcamentoPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><Orcamento /></Suspense>;
}

function Orcamento() {
  const sp = useSearchParams();
  const id = sp.get("id");
  const { kind, company } = useSpace();
  const { list, setList } = useQuotes();
  if (kind !== "business") return <Card className="py-10 text-center text-sm text-text-muted">Abra a aba Empresarial para criar orçamentos.</Card>;
  if (!list || !company) return <Skeleton className="h-96" />;
  const current = id ? list.find((q) => q.id === id) : undefined;
  if (id && !current) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="font-semibold">Orçamento não encontrado</p>
        <Link href={LIST} className="text-sm font-semibold text-accent underline">Voltar para Orçamentos</Link>
      </Card>
    );
  }
  const start = current ?? newQuote(sp, list, company);
  const onSaved = (q: Quote) => setList(list.some((x) => x.id === q.id) ? list.map((x) => (x.id === q.id ? q : x)) : [q, ...list]);
  return <QuoteForm key={current?.id ?? sp.toString()} initial={start} isNew={!current} onSaved={onSaved} />;
}

/** Orçamento novo a partir do tipo escolhido (e, se veio da calculadora, já com os itens). */
function newQuote(sp: URLSearchParams, list: Quote[], company: Company): Quote {
  const kind = (["produtos", "servico", "personalizado"].includes(sp.get("tipo") ?? "") ? sp.get("tipo") : "personalizado") as QuoteKind;
  const sub = (sp.get("sub") ?? "").slice(0, 160);
  const day = today();
  const n = (k: string) => Math.max(0, Number(sp.get(k)) || 0);
  const fromCalc = sp.has("mat") || sp.has("mo");
  const items: QuoteItem[] = fromCalc
    ? itemsFromCalc({ materials: n("mat"), labor: n("mo"), marginPct: n("mg"), taxPct: n("im"), discount: 0 }, () => crypto.randomUUID())
    : kind === "servico" ? [{ id: crypto.randomUUID(), description: sub, qty: 1, unitCents: 0 }] : [];
  const d = company.details ?? {};
  return {
    id: crypto.randomUUID(), number: nextNumber(list), kind, category: kind === "servico" ? (sp.get("cat") ?? "").slice(0, 60) : "",
    title: kind === "servico" ? sub : "", clientName: "", clientPhone: "", clientEmail: "",
    issuedOn: day, validUntil: addDays(day, 15), status: "enviado", items, discountCents: fromCalc ? n("de") : 0, notes: "",
    token: crypto.randomUUID(), viewedAt: null,
    company: { name: company.name, cnpj: company.cnpj, email: d.email ?? "", city: d.city ?? "", uf: d.uf ?? "" },
    createdAt: new Date().toISOString(),
  };
}

type Row = { id: string; description: string; qty: string; price: string; productId?: string | null; serviceId?: string | null };
const toRow = (i: QuoteItem): Row => ({ id: i.id, description: i.description, qty: formatQty(i.qty), price: centsText(i.unitCents), productId: i.productId, serviceId: i.serviceId });

function QuoteForm({ initial, isNew, onSaved }: { initial: Quote; isNew: boolean; onSaved: (q: Quote) => void }) {
  const router = useRouter();
  const { toast } = useShell();
  const { list: products } = useProducts();
  const { list: services } = useServices();
  const [f, setF] = useState(() => ({
    clientName: initial.clientName, clientPhone: initial.clientPhone, clientEmail: initial.clientEmail, title: initial.title,
    issuedOn: initial.issuedOn, validUntil: initial.validUntil, status: initial.status as QuoteStatus, discount: centsText(initial.discountCents), notes: initial.notes,
  }));
  const [rows, setRows] = useState<Row[]>(() => initial.items.map(toRow));
  const [saved, setSaved] = useState<Quote | null>(isNew ? null : initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [removing, setRemoving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => (e[k] ? { ...e, [k]: "" } : e)); };
  const setRow = (id: string, p: Partial<Row>) => { setRows((r) => r.map((x) => (x.id === id ? { ...x, ...p } : x))); setErrors((e) => (e.items ? { ...e, items: "" } : e)); };

  const items: QuoteItem[] = rows.map((r) => ({
    id: r.id, description: r.description.trim(), qty: parseQty(r.qty) ?? 0, unitCents: (r.price ? parseBRL(r.price) : 0) ?? 0,
    productId: r.productId ?? null, serviceId: r.serviceId ?? null,
  }));
  const discount = f.discount ? parseBRL(f.discount) : 0;
  const totals = quoteTotals({ items, discountCents: discount ?? 0 });
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/orcamento/${initial.token}`;
  const kindLabel = initial.kind === "servico" ? [initial.category, initial.title].filter(Boolean).join(" · ") : KINDS[initial.kind];

  function addRow(r: Partial<Row> = {}) { setRows((x) => [...x, { id: crypto.randomUUID(), description: "", qty: "1", price: "", ...r }]); }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!f.clientName.trim()) err.clientName = "Informe o nome do cliente.";
    if (!f.validUntil || f.validUntil < f.issuedOn) err.validUntil = "A validade não pode ser antes da data do orçamento.";
    if (discount == null) err.discount = "Valor inválido.";
    const bad = rows.some((r) => !r.description.trim() || parseQty(r.qty) == null || !(parseQty(r.qty)! > 0) || (r.price ? parseBRL(r.price) : 0) == null);
    if (!rows.length) err.items = "Adicione pelo menos um item.";
    else if (bad) err.items = "Confira os itens: cada um precisa de descrição, quantidade e valor válidos.";
    else if (totals.subtotal <= 0) err.items = "O orçamento está sem valor.";
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true); setFail("");
    try {
      const q: Quote = {
        ...initial, clientName: f.clientName.trim(), clientPhone: f.clientPhone.trim(), clientEmail: f.clientEmail.trim(), title: f.title.trim(),
        issuedOn: f.issuedOn, validUntil: f.validUntil, status: f.status, items, discountCents: discount ?? 0, notes: f.notes.trim(),
      };
      await repo.saveQuote(q);
      toast(isNew ? "Orçamento criado" : "Orçamento salvo");
      onSaved(q);
      setSaved(q);
      if (isNew) router.replace(`${LIST}/orcamento?id=${q.id}`);
    } catch (x) { setFail(x instanceof Error ? x.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    try { await repo.deleteQuote(initial.id); toast("Orçamento excluído"); router.push(LIST); }
    catch (x) { toast(x instanceof Error ? x.message : "Não foi possível excluir."); setBusy(false); }
  }

  const shareText = `Olá${f.clientName ? `, ${f.clientName.split(" ")[0]}` : ""}! Segue o orçamento ${formatNumber(initial.number)} de ${initial.company.name}: ${formatBRL(totals.total)}, válido até ${f.validUntil.split("-").reverse().join("/")}. Veja e responda pelo link: ${link}`;
  const st = saved ? effectiveStatus(saved, today()) : null;

  return (
    <form onSubmit={submit} noValidate className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <Link href={LIST} className="inline-flex items-center gap-1.5 self-start text-sm text-text-muted hover:text-text"><ArrowLeft aria-hidden className="size-4" />Voltar para Orçamentos</Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold"><FileText aria-hidden className="size-5 text-accent" />{isNew ? "Novo orçamento" : `Orçamento ${formatNumber(initial.number)}`}</h1>
          <p className="text-sm text-text-muted">{kindLabel}{isNew && ` · ${formatNumber(initial.number)}`}</p>
        </div>
        {st && <span className="rounded-pill bg-surface px-3 py-1 text-sm font-semibold">{statusLabel(st)}{saved?.viewedAt && st !== "enviado" ? ` · visto em ${new Date(saved.viewedAt).toLocaleDateString("pt-BR")}` : ""}</span>}
      </header>

      {saved && (
        <Card className="flex flex-col gap-3">
          <h2 className="font-semibold">Enviar ao cliente</h2>
          <p className="text-sm text-text-muted">O cliente abre o link sem precisar de conta, vê o orçamento e pode aprovar ou recusar. Quando ele abre, o orçamento passa para Visualizado.</p>
          <div className="flex flex-wrap gap-2">
            <a href={whatsappShare(saved.clientPhone, shareText)} target="_blank" rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-success px-4 text-sm font-semibold text-white hover:opacity-90"><MessageCircle aria-hidden className="size-4" />Enviar no WhatsApp</a>
            <Button type="button" variant="secondary" onClick={() => { void navigator.clipboard?.writeText(link).then(() => toast("Link copiado"), () => toast(link)); }}>
              <Copy aria-hidden className="size-4" />Copiar link
            </Button>
            <a href={`/orcamento/${saved.token}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold hover:bg-surface">
              <ExternalLink aria-hidden className="size-4" />Ver / imprimir PDF
            </a>
          </div>
        </Card>
      )}

      <Section title="Cliente">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Nome do cliente *" htmlFor="qt-client" error={errors.clientName}>
            <Input id="qt-client" value={f.clientName} maxLength={120} autoFocus={isNew} placeholder="Nome ou empresa" onChange={(e) => set("clientName")(e.target.value)} aria-invalid={!!errors.clientName || undefined} />
          </Field>
          <Field label="WhatsApp / telefone" htmlFor="qt-phone">
            <Input id="qt-phone" type="tel" inputMode="tel" value={f.clientPhone} maxLength={30} placeholder="(11) 98765-4321" onChange={(e) => set("clientPhone")(e.target.value)} />
          </Field>
          <Field label="E-mail" htmlFor="qt-email">
            <Input id="qt-email" type="email" value={f.clientEmail} maxLength={160} placeholder="Opcional" onChange={(e) => set("clientEmail")(e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Dados do orçamento">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Serviço / título" htmlFor="qt-title">
            <Input id="qt-title" value={f.title} maxLength={160} placeholder={initial.kind === "produtos" ? "Ex: Pedido de uniformes" : "Ex: Pintura do apartamento"} onChange={(e) => set("title")(e.target.value)} />
          </Field>
          <Field label="Data" htmlFor="qt-date">
            <Input id="qt-date" type="date" value={f.issuedOn} onChange={(e) => set("issuedOn")(e.target.value)} />
          </Field>
          <Field label="Válido até *" htmlFor="qt-valid" error={errors.validUntil}>
            <Input id="qt-valid" type="date" value={f.validUntil} onChange={(e) => set("validUntil")(e.target.value)} aria-invalid={!!errors.validUntil || undefined} />
          </Field>
          <Field label="Status" htmlFor="qt-status">
            <select id="qt-status" className={inputClass} value={f.status} onChange={(e) => set("status")(e.target.value)}>
              {QUOTE_STATUSES.filter((s) => s.value !== "vencido").map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section title={initial.kind === "produtos" ? "Produtos" : "Itens"}>
        {rows.length > 0 && (
          <div className="hidden grid-cols-[1fr_6rem_9rem_8rem_2.5rem] gap-2 text-xs font-semibold text-text-muted sm:grid">
            <span>Descrição</span><span>Qtd.</span><span>Valor unitário</span><span className="text-right">Total</span><span />
          </div>
        )}
        <ul className="flex flex-col gap-3 sm:gap-2">
          {rows.map((r, i) => {
            const it = items[i];
            const prod = r.productId ? products?.find((p) => p.id === r.productId) : undefined;
            return (
              <li key={r.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_6rem_9rem_8rem_2.5rem] sm:items-center sm:border-0 sm:p-0">
                <div className="col-span-2 sm:col-span-1">
                  <input aria-label={`Descrição do item ${i + 1}`} value={r.description} maxLength={200} placeholder="Descrição do item"
                    onChange={(e) => setRow(r.id, { description: e.target.value })} className={inputClass} />
                  {prod && it.qty > prod.stock && <p className="mt-1 text-xs text-warning">Estoque atual: {formatQty(prod.stock)} {prod.unit}</p>}
                </div>
                <input aria-label={`Quantidade do item ${i + 1}`} inputMode="decimal" value={r.qty} onChange={(e) => setRow(r.id, { qty: e.target.value.replace(/[^\d,.]/g, "") })} className={`${inputClass} num`} />
                <div className="relative">
                  <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">R$</span>
                  <input aria-label={`Valor unitário do item ${i + 1}`} inputMode="decimal" placeholder="0,00" value={r.price}
                    onChange={(e) => setRow(r.id, { price: e.target.value.replace(/[^\d,.]/g, "") })} className={`${inputClass} num pl-10`} />
                </div>
                <span className="num self-center text-right font-semibold">{formatBRL(itemTotal(it))}</span>
                <button type="button" aria-label={`Remover item ${i + 1}`} onClick={() => setRows((x) => x.filter((y) => y.id !== r.id))}
                  className="justify-self-end rounded-sm p-2 text-text-muted hover:bg-surface hover:text-danger"><X className="size-4" /></button>
              </li>
            );
          })}
        </ul>
        {errors.items && <p className="text-xs text-danger">{errors.items}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => addRow()}><Plus aria-hidden className="size-4" />Adicionar item</Button>
          <Picker label="Adicionar produto" empty="Nenhum produto cadastrado" options={(products ?? []).filter((p) => p.active).map((p) => ({ id: p.id, label: `${p.name} · ${formatBRL(p.priceCents)}` }))}
            onPick={(id) => { const p = products!.find((x) => x.id === id)!; addRow({ description: p.name, price: centsText(p.priceCents), productId: p.id }); }} />
          <Picker label="Adicionar serviço cadastrado" empty="Nenhum serviço cadastrado" options={(services ?? []).filter((s) => s.active).map((s) => ({ id: s.id, label: `${s.name} · ${formatBRL(s.priceCents)}` }))}
            onPick={(id) => { const s = services!.find((x) => x.id === id)!; addRow({ description: s.name, price: centsText(s.priceCents), serviceId: s.id }); }} />
        </div>

        <div className="ml-auto flex w-full max-w-xs flex-col gap-2 border-t border-border pt-3 text-sm">
          <p className="flex justify-between"><span className="text-text-muted">Subtotal</span><span className="num">{formatBRL(totals.subtotal)}</span></p>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="qt-discount" className="text-text-muted">Desconto</label>
            <div className="relative w-36">
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">R$</span>
              <input id="qt-discount" inputMode="decimal" placeholder="0,00" value={f.discount} onChange={(e) => set("discount")(e.target.value.replace(/[^\d,.]/g, ""))}
                aria-invalid={!!errors.discount || undefined} className={`${inputClass} num !h-9 pl-10 text-right`} />
            </div>
          </div>
          <p className="flex items-baseline justify-between text-base font-bold"><span>Total</span><span className="num text-xl text-income">{formatBRL(totals.total)}</span></p>
        </div>
      </Section>

      <Section title="Observações">
        <textarea aria-label="Observações" rows={4} value={f.notes} maxLength={4000} onChange={(e) => set("notes")(e.target.value)}
          placeholder="Forma de pagamento, prazo de execução, garantia, o que não está incluído..." className={`${inputClass} !h-auto py-2`} />
      </Section>

      {fail && <p role="alert" className="text-sm text-danger">{fail}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        {saved ? <Button type="button" variant="ghost" className="text-danger" onClick={() => setRemoving(true)}><Trash2 aria-hidden className="size-4" />Excluir</Button> : <span />}
        <div className="flex gap-2">
          <Link href={LIST} className="inline-flex h-12 items-center rounded-md border border-border px-5 font-semibold hover:bg-surface">{saved ? "Voltar" : "Cancelar"}</Link>
          <Button type="submit" size="lg" loading={busy}><Save aria-hidden className="size-4" />{saved ? "Salvar alterações" : "Criar orçamento"}</Button>
        </div>
      </div>

      {removing && (
        <Dialog onClose={() => setRemoving(false)} title={<h2 className="text-lg font-bold">Excluir orçamento?</h2>}>
          <p className="text-sm text-text-muted">{formatNumber(initial.number)} de {initial.clientName} será excluído e o link do cliente deixa de abrir. Isso não pode ser desfeito.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemoving(false)}>Cancelar</Button>
            <Button variant="danger" loading={busy} onClick={() => void remove()}>Excluir</Button>
          </div>
        </Dialog>
      )}
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <Card className="flex flex-col gap-4"><h2 className="font-semibold">{title}</h2>{children}</Card>;
}

/** Lista para puxar um produto ou serviço já cadastrado como item. */
function Picker({ label, empty, options, onPick }: { label: string; empty: string; options: { id: string; label: string }[]; onPick: (id: string) => void }) {
  return (
    <select aria-label={label} value="" onChange={(e) => { if (e.target.value) onPick(e.target.value); }} disabled={!options.length}
      className={`${inputClass} !h-8 !w-auto text-xs font-semibold disabled:opacity-60`}>
      <option value="">{options.length ? `＋ ${label}` : empty}</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}
