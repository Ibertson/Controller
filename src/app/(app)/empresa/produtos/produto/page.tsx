"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Calculator, ImagePlus, Package, Save, X } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { useSpace } from "@/components/business";
import { useProducts } from "@/components/products";
import { Button, Card, Field, Input, Skeleton, inputClass } from "@/components/ui";
import { repo } from "@/lib/data";
import { resizeImage } from "@/lib/image";
import { formatBRL, parseBRL } from "@/lib/money";
import { UNITS, categoryOptions, formatQty, marginPct, parseQty } from "@/lib/products";
import type { Product } from "@/lib/types";

const NEW_CAT = "__nova__";
const centsText = (c: number) => (c ? formatBRL(c).replace(/^R\$\s*/, "") : "");

export default function ProdutoPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><Produto /></Suspense>;
}

function Produto() {
  const id = useSearchParams().get("id");
  const { kind } = useSpace();
  const { list } = useProducts();
  if (kind !== "business") return <Card className="py-10 text-center text-sm text-text-muted">Abra a aba Empresarial para cadastrar produtos.</Card>;
  if (!list) return <Skeleton className="h-96" />;
  const current = id ? list.find((p) => p.id === id) : undefined;
  if (id && !current) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="font-semibold">Produto não encontrado</p>
        <Link href="/empresa/produtos" className="text-sm font-semibold text-accent underline">Voltar para Produtos</Link>
      </Card>
    );
  }
  return <ProductForm key={current?.id ?? "novo"} initial={current} />;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <Card className="flex flex-col gap-4"><h2 className="font-semibold">{title}</h2>{children}</Card>;
}

function ProductForm({ initial }: { initial?: Product }) {
  const router = useRouter();
  const { toast } = useShell();
  const { company } = useSpace();
  const cats = company?.details?.productCategories ?? [];
  const blank = () => ({
    name: initial?.name ?? "", category: initial?.category ?? "", description: initial?.description ?? "",
    sku: initial?.sku ?? "", unit: initial?.unit ?? "un", cost: centsText(initial?.costCents ?? 0), price: centsText(initial?.priceCents ?? 0),
    stock: initial ? formatQty(initial.stock) : "", minStock: initial?.minStock ? formatQty(initial.minStock) : "", active: initial?.active ?? true,
  });
  const [f, setF] = useState(blank);
  const [photo, setPhoto] = useState<string | null>(initial?.photo ?? null);
  const [newCat, setNewCat] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const set = (k: keyof typeof f) => (v: string | boolean) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => (e[k] ? { ...e, [k]: "" } : e)); };

  const cost = f.cost ? parseBRL(f.cost) : 0;
  const price = f.price ? parseBRL(f.price) : null;
  const margin = cost != null && price ? marginPct({ costCents: cost, priceCents: price }) : null;

  async function saveCategories(next: string[]) {
    if (!company) return;
    try { await repo.updateCompany({ ...company, details: { ...company.details, productCategories: next } }); }
    catch (e) { setFail(e instanceof Error ? e.message : "Não foi possível salvar a categoria."); }
  }
  async function addCategory() {
    const name = (newCat ?? "").trim().replace(/\s+/g, " ");
    if (!name) { setNewCat(null); return; }
    const existing = categoryOptions(cats).find((c) => c.name.toLowerCase() === name.toLowerCase())?.name;
    if (!existing) await saveCategories([...cats, name]);
    setF((x) => ({ ...x, category: existing ?? name }));
    setErrors((e) => ({ ...e, category: "" }));
    setNewCat(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    const stock = parseQty(f.stock), minStock = parseQty(f.minStock);
    if (!f.name.trim()) err.name = "Informe o nome do produto.";
    if (!f.category) err.category = "Escolha uma categoria.";
    if (cost == null) err.cost = "Valor inválido.";
    if (price == null || price <= 0) err.price = "Informe o preço de venda.";
    if (stock == null) err.stock = "Quantidade inválida.";
    if (minStock == null) err.minStock = "Quantidade inválida.";
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true); setFail("");
    try {
      await repo.saveProduct({
        id: initial?.id ?? crypto.randomUUID(), createdAt: initial?.createdAt ?? new Date().toISOString(),
        name: f.name.trim(), category: f.category, description: f.description.trim(), sku: f.sku.trim(), unit: f.unit,
        costCents: cost ?? 0, priceCents: price ?? 0, stock: stock ?? 0, minStock: minStock ?? 0, photo, active: f.active,
      });
      toast(initial ? "Produto salvo" : "Produto cadastrado");
      // A tela fica guardada pelo Next ao sair: o próximo "Novo Produto" começa limpo.
      if (!initial) { setF(blank()); setPhoto(null); }
      router.push("/empresa/produtos");
    } catch (x) { setFail(x instanceof Error ? x.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link href="/empresa/produtos" className="inline-flex items-center gap-1.5 self-start text-sm text-text-muted hover:text-text"><ArrowLeft aria-hidden className="size-4" />Voltar para Produtos</Link>
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold"><Package aria-hidden className="size-5 text-accent" />{initial ? "Editar Produto" : "Novo Produto"}</h1>
        <p className="text-sm text-text-muted">{initial ? "Altere os dados do produto" : "Cadastre um novo produto no seu catálogo"}</p>
      </header>

      <Section title="Informações do Produto">
        <Field label="Nome do Produto *" htmlFor="pr-name" error={errors.name}>
          <Input id="pr-name" placeholder="Digite o nome do produto" value={f.name} maxLength={100} autoFocus={!initial}
            onChange={(e) => set("name")(e.target.value)} aria-invalid={!!errors.name || undefined} />
        </Field>

        <div className="flex flex-col gap-1.5">
          <label id="pr-cat-label" htmlFor="pr-cat" className="text-xs font-semibold text-text-muted">Categoria *</label>
          {newCat == null ? (
            <select id="pr-cat" aria-labelledby="pr-cat-label" value={f.category} aria-invalid={!!errors.category || undefined}
              onChange={(e) => { if (e.target.value === NEW_CAT) setNewCat(""); else set("category")(e.target.value); }}
              className={`${inputClass} ${f.category ? "" : "text-text-muted"}`}>
              <option value="" disabled>Selecione a categoria</option>
              {categoryOptions(cats, f.category).map((c) => <option key={c.name} value={c.name} className="text-text">{c.emoji}  {c.name}</option>)}
              <option value={NEW_CAT} className="text-text">＋  Nova categoria…</option>
            </select>
          ) : (
            <span className="flex flex-wrap items-center gap-1">
              <input aria-label="Nome da nova categoria" autoFocus value={newCat} maxLength={60} onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addCategory(); } if (e.key === "Escape") setNewCat(null); }}
                placeholder="Nome da categoria" className={`${inputClass} min-w-0 flex-1`} />
              <Button type="button" onClick={() => void addCategory()}>Adicionar</Button>
              <button type="button" aria-label="Cancelar" onClick={() => setNewCat(null)} className="rounded-sm p-2 text-text-muted hover:bg-surface"><X className="size-4" /></button>
            </span>
          )}
          {errors.category && <p className="text-xs text-danger">{errors.category}</p>}
        </div>

        <Field label="Descrição" htmlFor="pr-desc">
          <textarea id="pr-desc" rows={3} placeholder="Descreva o produto..." value={f.description} maxLength={1000}
            onChange={(e) => set("description")(e.target.value)} className={`${inputClass} !h-auto py-2`} />
        </Field>

        <div className="flex items-center gap-3">
          <label htmlFor="pr-photo" className="relative grid size-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-md border border-dashed border-border bg-surface text-text-muted hover:border-accent focus-within:ring-2 focus-within:ring-accent">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo ? <img src={photo} alt="" className="size-full object-cover" /> : <ImagePlus aria-hidden className="size-6" />}
            <input id="pr-photo" type="file" accept="image/*" className="sr-only" onChange={async (e) => {
              const file = e.target.files?.[0]; e.target.value = "";
              if (!file) return;
              try { setPhoto(await resizeImage(file, 512, 512)); } catch (x) { setFail(x instanceof Error ? x.message : "Não deu para abrir a imagem."); }
            }} />
          </label>
          <div><p className="text-sm font-medium">Foto do produto</p>
            {photo ? <button type="button" onClick={() => setPhoto(null)} className="text-xs font-semibold text-danger hover:underline">Remover foto</button>
              : <p className="text-xs text-text-muted">Opcional. Toque para escolher.</p>}
          </div>
        </div>
      </Section>

      <Section title="Precificação e Estoque">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Preço de custo" htmlFor="pr-cost" error={errors.cost}>
            <Money id="pr-cost" value={f.cost} onChange={set("cost")} invalid={!!errors.cost} />
          </Field>
          <Field label="Preço de venda *" htmlFor="pr-price" error={errors.price}>
            <Money id="pr-price" value={f.price} onChange={set("price")} invalid={!!errors.price} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface px-3 py-2 text-sm">
          <span>
            Margem: <strong className={`num ${margin != null && margin < 0 ? "text-danger" : "text-income"}`}>{margin == null ? "–" : `${margin.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}</strong>
            {margin != null && cost != null && price != null && <span className="text-text-muted"> · lucro de {formatBRL(price - cost)} por {f.unit}</span>}
          </span>
          <Link href="/empresa/precificacao" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"><Calculator aria-hidden className="size-3.5" />Calcular preço ideal</Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Código (SKU ou código de barras)" htmlFor="pr-sku">
            <Input id="pr-sku" value={f.sku} maxLength={40} placeholder="Opcional" onChange={(e) => set("sku")(e.target.value)} />
          </Field>
          <Field label="Unidade" htmlFor="pr-unit">
            <select id="pr-unit" className={inputClass} value={f.unit} onChange={(e) => set("unit")(e.target.value)}>
              {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </Field>
          <Field label="Estoque atual" htmlFor="pr-stock" error={errors.stock}>
            <Input id="pr-stock" inputMode="decimal" className="num" placeholder="0" value={f.stock} onChange={(e) => set("stock")(e.target.value)} aria-invalid={!!errors.stock || undefined} />
          </Field>
          <Field label="Estoque mínimo" htmlFor="pr-min" error={errors.minStock}>
            <Input id="pr-min" inputMode="decimal" className="num" placeholder="0" value={f.minStock} onChange={(e) => set("minStock")(e.target.value)} aria-invalid={!!errors.minStock || undefined} />
            <p className="text-xs text-text-muted">Avisa quando o estoque chegar nesse número.</p>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.active} onChange={(e) => set("active")(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
          Produto ativo (aparece nas vendas e no catálogo)
        </label>
      </Section>

      {fail && <p role="alert" className="text-sm text-danger">{fail}</p>}
      <div className="flex flex-wrap justify-end gap-2 pb-4">
        <Link href="/empresa/produtos" className="inline-flex h-12 items-center rounded-md border border-border px-5 font-semibold hover:bg-surface">Cancelar</Link>
        <Button type="submit" size="lg" loading={busy}><Save aria-hidden className="size-4" />{initial ? "Salvar alterações" : "Cadastrar Produto"}</Button>
      </div>
    </form>
  );
}

function Money({ id, value, onChange, invalid }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">R$</span>
      <Input id={id} inputMode="decimal" placeholder="0,00" className="num pl-10" value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d,.]/g, ""))} aria-invalid={invalid || undefined} />
    </div>
  );
}
