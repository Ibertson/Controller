"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { ArrowLeft, Clock, DollarSign, Save, TrendingUp, Wrench, X } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { useSpace } from "@/components/business";
import { useServices } from "@/components/services";
import { Button, Card, Field, Input, Skeleton, inputClass } from "@/components/ui";
import { repo } from "@/lib/data";
import { formatBRL, parseBRL } from "@/lib/money";
import { parseHours, serviceCategoryOptions, suggestPrices, type PriceBasis } from "@/lib/services";
import type { Service } from "@/lib/types";

const NEW_CAT = "__nova__";
const LIST = "/empresa/servicos";
const centsText = (c: number) => (c ? formatBRL(c).replace(/^R\$\s*/, "") : "");
const hoursText = (h: number) => (h ? String(h).replace(".", ",") : "");

const BASIS: Record<PriceBasis, string> = {
  similar: "Sugestões baseadas na duração e no valor por hora dos seus serviços desta categoria",
  mine: "Sugestões baseadas na duração e no valor por hora dos seus outros serviços",
  typed: "Sugestões a partir do valor base informado. Com mais serviços cadastrados, elas passam a usar o seu valor por hora",
};

export default function ServicoPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><Servico /></Suspense>;
}

function Servico() {
  const id = useSearchParams().get("id");
  const { kind } = useSpace();
  const { list } = useServices();
  if (kind !== "business") return <Card className="py-10 text-center text-sm text-text-muted">Abra a aba Empresarial para cadastrar serviços.</Card>;
  if (!list) return <Skeleton className="h-96" />;
  const current = id ? list.find((s) => s.id === id) : undefined;
  if (id && !current) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="font-semibold">Serviço não encontrado</p>
        <Link href={LIST} className="text-sm font-semibold text-accent underline">Voltar para Serviços</Link>
      </Card>
    );
  }
  return <ServiceForm key={current?.id ?? "novo"} initial={current} list={list} />;
}

function ServiceForm({ initial, list }: { initial?: Service; list: Service[] }) {
  const router = useRouter();
  const { toast } = useShell();
  const { company } = useSpace();
  const cats = company?.details?.serviceCategories ?? [];
  const blank = () => ({
    name: initial?.name ?? "", price: centsText(initial?.priceCents ?? 0), hours: hoursText(initial?.hours ?? 0),
    category: initial?.category ?? "", description: initial?.description ?? "", active: initial?.active ?? true,
  });
  const [f, setF] = useState(blank);
  const [newCat, setNewCat] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const set = (k: keyof typeof f) => (v: string | boolean) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => (e[k] ? { ...e, [k]: "" } : e)); };

  const price = f.price ? parseBRL(f.price) : null;
  const hours = parseHours(f.hours);
  const tips = suggestPrices(list, { id: initial?.id, category: f.category, hours, priceCents: price });

  async function addCategory() {
    const name = (newCat ?? "").trim().replace(/\s+/g, " ");
    if (!name) { setNewCat(null); return; }
    const existing = serviceCategoryOptions(cats).find((c) => c.name.toLowerCase() === name.toLowerCase())?.name;
    if (!existing && company) {
      try { await repo.updateCompany({ ...company, details: { ...company.details, serviceCategories: [...cats, name] } }); }
      catch (e) { setFail(e instanceof Error ? e.message : "Não foi possível salvar a categoria."); }
    }
    set("category")(existing ?? name);
    setNewCat(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!f.name.trim()) err.name = "Informe o nome do serviço.";
    if (price == null || price <= 0) err.price = "Informe o valor base.";
    if (hours == null) err.hours = "Informe a duração em horas (ex.: 2,5).";
    if (!f.category) err.category = "Escolha uma categoria.";
    if (!f.description.trim()) err.description = "Descreva o serviço.";
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true); setFail("");
    try {
      await repo.saveService({
        id: initial?.id ?? crypto.randomUUID(), createdAt: initial?.createdAt ?? new Date().toISOString(),
        name: f.name.trim(), category: f.category, description: f.description.trim(), priceCents: price ?? 0, hours: hours ?? 1, active: f.active,
      });
      toast(initial ? "Serviço salvo" : "Serviço cadastrado");
      // A tela fica guardada pelo Next ao sair: o próximo "Novo Serviço" começa limpo.
      if (!initial) setF(blank());
      router.push(LIST);
    } catch (x) { setFail(x instanceof Error ? x.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link href={LIST} className="inline-flex items-center gap-1.5 self-start text-sm text-text-muted hover:text-text"><ArrowLeft aria-hidden className="size-4" />Voltar para Serviços</Link>
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold"><Wrench aria-hidden className="size-5 text-accent" />{initial ? "Editar Serviço" : "Novo Serviço"}</h1>
        <p className="text-sm text-text-muted">{initial ? "Altere os dados do serviço" : "Cadastre um novo serviço no seu portfólio"}</p>
      </header>

      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold">Informações do Serviço</h2>
        <Field label="Nome do Serviço *" htmlFor="sv-name" error={errors.name}>
          <Input id="sv-name" placeholder="Ex: Consultoria em Marketing Digital" value={f.name} maxLength={100} autoFocus={!initial}
            onChange={(e) => set("name")(e.target.value)} aria-invalid={!!errors.name || undefined} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sv-price" className="flex items-center gap-1 text-xs font-semibold text-text-muted"><DollarSign aria-hidden className="size-3.5" />Valor Base *</label>
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">R$</span>
              <Input id="sv-price" inputMode="decimal" placeholder="0,00" className="num pl-10" value={f.price} aria-describedby="sv-price-hint"
                onChange={(e) => set("price")(e.target.value.replace(/[^\d,.]/g, ""))} aria-invalid={!!errors.price || undefined} />
            </div>
            {errors.price ? <p className="text-xs text-danger">{errors.price}</p> : <p id="sv-price-hint" className="text-xs text-text-muted">Valor padrão cobrado por este serviço</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sv-hours" className="flex items-center gap-1 text-xs font-semibold text-text-muted"><Clock aria-hidden className="size-3.5" />Duração (horas) *</label>
            <Input id="sv-hours" inputMode="decimal" placeholder="Ex: 2,5" className="num" value={f.hours}
              onChange={(e) => set("hours")(e.target.value.replace(/[^\d,.]/g, ""))} aria-invalid={!!errors.hours || undefined} />
            {errors.hours && <p className="text-xs text-danger">{errors.hours}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 sm:max-w-[calc(50%-0.5rem)]">
          <label id="sv-cat-label" htmlFor="sv-cat" className="text-xs font-semibold text-text-muted">Categoria *</label>
          {newCat == null ? (
            <select id="sv-cat" aria-labelledby="sv-cat-label" value={f.category} aria-invalid={!!errors.category || undefined}
              onChange={(e) => { if (e.target.value === NEW_CAT) setNewCat(""); else set("category")(e.target.value); }}
              className={`${inputClass} ${f.category ? "" : "text-text-muted"}`}>
              <option value="" disabled>Selecione a categoria</option>
              {serviceCategoryOptions(cats, f.category).map((c) => <option key={c.name} value={c.name} className="text-text">{c.emoji}  {c.name}</option>)}
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

        <Field label="Descrição Detalhada *" htmlFor="sv-desc" error={errors.description}>
          <textarea id="sv-desc" rows={4} placeholder="Descreva o serviço, o que está incluído, etapas, etc..." value={f.description} maxLength={2000}
            onChange={(e) => set("description")(e.target.value)} aria-invalid={!!errors.description || undefined} className={`${inputClass} !h-auto py-2`} />
        </Field>

        {initial && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.active} onChange={(e) => set("active")(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
            Serviço ativo (aparece nos orçamentos e nas vendas)
          </label>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-semibold"><TrendingUp aria-hidden className="size-4 text-accent" />Sugestões de Preço</h2>
        {tips ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Tip tone="bg-accent-soft text-accent" label="Econômico" cents={tips.economic} note="Preço competitivo no mercado" picked={price === tips.economic} onPick={(c) => set("price")(centsText(c))} />
              <Tip tone="bg-accent text-on-accent" label="Recomendado" cents={tips.recommended} note={tips.basis === "typed" ? "O valor base informado" : "Baseado em serviços similares"} picked={price === tips.recommended} onPick={(c) => set("price")(centsText(c))} featured />
              <Tip tone="bg-warning-soft text-warning" label="Premium" cents={tips.premium} note="Valor para alto padrão" picked={price === tips.premium} onPick={(c) => set("price")(centsText(c))} />
            </div>
            <p className="text-center text-xs text-text-muted">{BASIS[tips.basis]}. Toque em uma sugestão para usar como valor base.</p>
          </>
        ) : (
          <p className="text-sm text-text-muted">Informe o valor base ou a duração para ver sugestões de preço.</p>
        )}
      </Card>

      {fail && <p role="alert" className="text-sm text-danger">{fail}</p>}
      <div className="grid grid-cols-2 gap-3 pb-4">
        <Link href={LIST} className="inline-flex h-12 items-center justify-center rounded-md border border-border font-semibold hover:bg-surface">Cancelar</Link>
        <Button type="submit" size="lg" loading={busy}><Save aria-hidden className="size-4" />{initial ? "Salvar" : "Cadastrar Serviço"}</Button>
      </div>
    </form>
  );
}

function Tip({ tone, label, cents, note, picked, featured, onPick }: { tone: string; label: string; cents: number; note: string; picked: boolean; featured?: boolean; onPick: (c: number) => void }) {
  return (
    <button type="button" onClick={() => onPick(cents)} aria-pressed={picked}
      className={`flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left hover:border-accent aria-pressed:ring-2 aria-pressed:ring-accent ${featured ? "border-accent" : "border-border"}`}>
      <span className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
      <span className="num text-xl font-bold">{formatBRL(cents)}</span>
      <span className="text-xs text-text-muted">{note}</span>
    </button>
  );
}
