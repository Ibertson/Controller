"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Building2, Check, Copy, ExternalLink, Eye, GripVertical, ImagePlus, Link2, Plus, Save, Trash2 } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { BioThumb, BioView } from "@/components/bio/BioView";
import { useSpace } from "@/components/business";
import { Dialog } from "@/components/Dialog";
import { Button, Card, Field, Input, Skeleton } from "@/components/ui";
import {
  BIO_COLORS, MAX, TEMPLATES, bioProblem, cleanSlug, defaultBio, randomSlug, switchTemplate,
  type BioData, type BioPage, type TemplateId,
} from "@/lib/bio";
import { repo, useSnapshot } from "@/lib/data";
import { resizeImage } from "@/lib/image";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível salvar.");
const uid = () => crypto.randomUUID().slice(0, 8);

/** Link Bio: página pública da empresa com contato, serviços e links. */
export default function LinkBio() {
  const snap = useSnapshot();
  const { kind, company } = useSpace();
  const [saved, setSaved] = useState<BioPage | null | undefined>(undefined);
  const [error, setError] = useState("");
  const wsId = snap?.workspace.id;

  useEffect(() => {
    if (!wsId) return;
    let alive = true;
    repo.loadBio().then((p) => { if (alive) setSaved(p); }).catch((e) => { if (alive) { setError(errMsg(e)); setSaved(null); } });
    return () => { alive = false; };
  }, [wsId]);

  if (!snap || saved === undefined) return <div className="flex flex-col gap-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (kind !== "business" || !company) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 aria-hidden className="size-9 text-text-muted" />
        <h1 className="font-semibold">O Link Bio é do Painel Empresarial</h1>
        <p className="max-w-md text-sm text-text-muted">Abra a aba Empresarial no topo da tela para criar a página da sua empresa.</p>
      </Card>
    );
  }
  return <Editor key={wsId} initial={saved ?? { slug: "", published: false, data: defaultBio(company) }} isNew={!saved} loadError={error} />;
}

function Editor({ initial, isNew, loadError }: { initial: BioPage; isNew: boolean; loadError: string }) {
  const { toast } = useShell();
  const [data, setData] = useState<BioData>(initial.data);
  const [published, setPublished] = useState(initial.published);
  const [slug, setSlug] = useState(initial.slug);
  const [stored, setStored] = useState<BioPage | null>(isNew ? null : initial);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(loadError);
  const [preview, setPreview] = useState<TemplateId | "mine" | null>(null);
  const [copied, setCopied] = useState(false);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const dirty = useMemo(() => !stored || JSON.stringify({ data, published, slug }) !== JSON.stringify({ data: stored.data, published: stored.published, slug: stored.slug }), [data, published, slug, stored]);
  const url = stored ? `${origin}/bio/${stored.slug}` : "";
  const set = (patch: Partial<BioData>) => setData((d) => ({ ...d, ...patch }));

  async function save(next: { published?: boolean } = {}) {
    const page: BioPage = { slug: slug.replace(/-+$/, "") || stored?.slug || randomSlug(), published: next.published ?? published, data };
    const p = bioProblem(page);
    if (p) { setProblem(p); return false; }
    setBusy(true); setProblem("");
    try {
      await repo.saveBio(page);
      setStored(page); setSlug(page.slug); setPublished(page.published);
      toast(next.published === undefined ? "Link Bio salvo" : page.published ? "Página pública ativada" : "Página pública desativada");
      return true;
    } catch (e) { setProblem(errMsg(e)); return false; }
    finally { setBusy(false); }
  }

  function focusField(field: string) {
    const el = document.getElementById(field);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
    setPreview(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold"><Link2 aria-hidden className="size-5 text-accent" />Link Bio</h1>
        <p className="text-sm text-text-muted">Uma página pública com seus principais links. Compartilhe em qualquer rede social. Clique direto no texto ou nas imagens da prévia para editar, e arraste para reordenar.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Ativar e endereço */}
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="bio-published" className="min-w-0">
                <span className="block font-semibold">Ativar página pública</span>
                <span className="block text-sm text-text-muted">Enquanto desativado, o link não funciona para ninguém, nem com o endereço em mãos.</span>
              </label>
              <button id="bio-published" type="button" role="switch" aria-checked={published} disabled={busy}
                onClick={() => void save({ published: !published })}
                className="relative h-7 w-12 shrink-0 rounded-pill bg-border transition-colors aria-checked:bg-accent disabled:opacity-60">
                <span aria-hidden className={`absolute top-1 size-5 rounded-pill bg-white shadow-card transition-all ${published ? "left-6" : "left-1"}`} />
              </button>
            </div>
            <Field label="Endereço do link" htmlFor="bio-slug">
              <div className="flex min-w-0 items-stretch overflow-hidden rounded-md border border-border focus-within:ring-2 focus-within:ring-accent">
                <span className="hidden shrink-0 items-center bg-surface px-3 text-sm text-text-muted sm:flex">{origin.replace(/^https?:\/\//, "")}/bio/</span>
                <span className="flex shrink-0 items-center bg-surface pl-3 text-sm text-text-muted sm:hidden">/bio/</span>
                <input id="bio-slug" value={slug} onChange={(e) => setSlug(cleanSlug(e.target.value))} placeholder="seunome"
                  className="h-11 min-w-0 flex-1 bg-bg px-3 text-base outline-none" autoComplete="off" spellCheck={false} />
              </div>
              <p className="text-xs text-text-muted">Deixe em branco para usar um código gerado automaticamente.</p>
            </Field>
            {stored && (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface p-2 text-sm">
                <span className={`size-2 shrink-0 rounded-pill ${stored.published ? "bg-income" : "bg-text-muted"}`} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{url}</span>
                <Button size="sm" variant="secondary" onClick={async () => {
                  try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { toast("Não deu para copiar. Selecione o endereço."); }
                }}>{copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}{copied ? "Copiado" : "Copiar"}</Button>
                {stored.published && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-semibold text-accent hover:bg-bg">Abrir<ExternalLink aria-hidden className="size-3.5" /></a>}
              </div>
            )}
          </Card>

          {/* Modelo e cor */}
          <Card className="flex flex-col gap-4">
            <div><h2 className="font-semibold">Modelo</h2><p className="text-sm text-text-muted">Escolha o layout e a cor de destaque.</p></div>
            <div role="radiogroup" aria-label="Modelo" className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {TEMPLATES.map((t) => {
                const on = data.template === t.id;
                return (
                  <div key={t.id} className={`flex flex-col gap-2 rounded-lg border-2 p-2 ${on ? "border-accent" : "border-border"}`}>
                    <button type="button" role="radio" aria-checked={on} onClick={() => setData((d) => switchTemplate(d, t.id))} className="flex flex-col gap-2 text-left">
                      <BioThumb data={switchTemplate(data, t.id)} />
                      <span className={`px-1 font-semibold ${on ? "text-accent" : ""}`}>{t.name}</span>
                      <span className="px-1 text-sm text-text-muted">{t.description}</span>
                    </button>
                    <Button size="sm" variant="secondary" className="mt-auto" onClick={() => setPreview(t.id)}><Eye aria-hidden className="size-4" />Ver</Button>
                  </div>
                );
              })}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Cor de destaque</p>
              <div role="radiogroup" aria-label="Cor de destaque" className="flex flex-wrap items-center gap-2">
                {BIO_COLORS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={data.color === c} aria-label={`Cor ${c}`} onClick={() => set({ color: c })}
                    className="size-9 rounded-pill border-2 border-bg ring-2 ring-transparent aria-checked:ring-text" style={{ background: c }} />
                ))}
                <label className={`relative grid size-9 cursor-pointer place-items-center rounded-md border-2 border-bg ring-2 ${BIO_COLORS.includes(data.color) ? "ring-transparent" : "ring-text"}`}
                  style={{ background: BIO_COLORS.includes(data.color) ? "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" : data.color }}>
                  <span className="sr-only">Outra cor</span>
                  <input type="color" value={data.color} onChange={(e) => set({ color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
                </label>
              </div>
            </div>
          </Card>

          <Content data={data} set={set} setData={setData} onError={setProblem} />
        </div>

        {/* Prévia */}
        <div className="hidden xl:block">
          <div className="sticky top-20 flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Prévia: clique para editar</p>
            <div className="h-[720px] overflow-y-auto rounded-[2rem] border-8 border-text/80 bg-bg shadow-pop">
              <BioView data={data} edit onEdit={focusField} />
            </div>
          </div>
        </div>
      </div>

      {/* Barra de salvar */}
      <div className="sticky bottom-[calc(var(--layout-bottom-nav)+0.5rem)] z-20 rounded-lg border border-border bg-bg/95 px-4 py-3 shadow-pop backdrop-blur lg:bottom-4">
        <div className="flex items-center justify-end gap-2">
          {problem && <p role="alert" className="mr-auto min-w-0 text-xs text-danger sm:text-sm">{problem}</p>}
          {!problem && dirty && <p className="mr-auto min-w-0 text-xs text-text-muted sm:text-sm">Alterações não salvas</p>}
          <Button variant="secondary" className="xl:hidden" onClick={() => setPreview("mine")}><Eye aria-hidden className="size-4" />Prévia</Button>
          <Button loading={busy} disabled={!dirty} onClick={() => void save()}><Save aria-hidden className="size-4" />Salvar</Button>
        </div>
      </div>

      {preview && (
        <Dialog onClose={() => setPreview(null)} title={<h2 className="text-lg font-bold">{preview === "mine" ? "Prévia" : `Modelo ${TEMPLATES.find((t) => t.id === preview)?.name}`}</h2>}>
          <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-lg border border-border">
            {preview === "mine" ? <BioView data={data} edit onEdit={focusField} /> : <BioView data={switchTemplate(data, preview)} />}
          </div>
          {preview !== "mine" && preview !== data.template && (
            <Button className="mt-4 w-full" onClick={() => { setData((d) => switchTemplate(d, preview)); setPreview(null); }}>Usar este modelo</Button>
          )}
        </Dialog>
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div><h3 className="text-sm font-semibold">{title}</h3>{hint && <p className="text-xs text-text-muted">{hint}</p>}</div>
      {children}
    </div>
  );
}

function ImageField({ id, label, value, onChange, w, h, round, onError }: {
  id: string; label: string; value: string | null; onChange: (v: string | null) => void; w: number; h: number; round?: boolean; onError: (m: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className={`relative grid shrink-0 cursor-pointer place-items-center overflow-hidden border border-dashed border-border bg-surface text-text-muted hover:border-accent focus-within:ring-2 focus-within:ring-accent ${round ? "size-16 rounded-pill" : "h-16 w-28 rounded-md"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {value ? <img src={value} alt="" className="size-full object-cover" /> : <ImagePlus aria-hidden className="size-5" />}
        <input id={id} type="file" accept="image/*" className="sr-only" onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          try { onChange(await resizeImage(f, w, h)); } catch (x) { onError(errMsg(x)); }
        }} />
      </label>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {value ? <button type="button" onClick={() => onChange(null)} className="text-xs font-semibold text-danger hover:underline">Remover</button>
          : <p className="text-xs text-text-muted">Toque para escolher uma imagem</p>}
      </div>
    </div>
  );
}

/** Lista que reordena arrastando (computador) ou pelas setas (celular e teclado). */
function SortableList<T extends { id: string }>({ items, onChange, render, label }: {
  items: T[]; onChange: (items: T[]) => void; render: (item: T, i: number) => ReactNode; label: (item: T) => string;
}) {
  const drag = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items]; const [x] = next.splice(from, 1); next.splice(to, 0, x); onChange(next);
  };
  const drop = (i: number) => (e: DragEvent) => { e.preventDefault(); if (drag.current != null) move(drag.current, i); drag.current = null; setOver(null); };
  return (
    <ul className="flex flex-col gap-2">
      {items.map((it, i) => (
        <li key={it.id} draggable onDragStart={() => { drag.current = i; }} onDragEnd={() => { drag.current = null; setOver(null); }}
          onDragOver={(e) => { e.preventDefault(); setOver(i); }} onDrop={drop(i)}
          className={`flex items-start gap-2 rounded-md border bg-bg p-2 ${over === i ? "border-accent" : "border-border"}`}>
          <GripVertical aria-hidden className="mt-3 size-4 shrink-0 cursor-grab text-text-muted" />
          <div className="min-w-0 flex-1">{render(it, i)}</div>
          <div className="flex shrink-0 flex-col">
            <button type="button" aria-label={`Subir ${label(it)}`} disabled={i === 0} onClick={() => move(i, i - 1)} className="rounded-sm p-1 hover:bg-surface disabled:opacity-30"><ArrowUp className="size-4" /></button>
            <button type="button" aria-label={`Descer ${label(it)}`} disabled={i === items.length - 1} onClick={() => move(i, i + 1)} className="rounded-sm p-1 hover:bg-surface disabled:opacity-30"><ArrowDown className="size-4" /></button>
          </div>
          <button type="button" aria-label={`Remover ${label(it)}`} onClick={() => onChange(items.filter((x) => x.id !== it.id))} className="mt-1.5 rounded-sm p-1.5 text-danger hover:bg-danger-soft"><Trash2 className="size-4" /></button>
        </li>
      ))}
    </ul>
  );
}

function Content({ data, set, setData, onError }: { data: BioData; set: (p: Partial<BioData>) => void; setData: (f: (d: BioData) => BioData) => void; onError: (m: string) => void }) {
  // Campo novo recebe o foco depois de aparecer na tela.
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  }, [data]);
  const setFocusId = (id: string) => { focusNext.current = id; };
  return (
    <Card className="flex flex-col gap-4">
      <div><h2 className="font-semibold">Conteúdo</h2><p className="text-sm text-text-muted">O que aparece na sua página.</p></div>

      <Section title="Identidade">
        <div className="flex flex-wrap gap-4">
          <ImageField id="bio-logo" label="Logo" value={data.logo} onChange={(v) => set({ logo: v })} w={256} h={256} round onError={onError} />
          <ImageField id="bio-cover" label="Capa (modelos com foto no topo)" value={data.cover} onChange={(v) => set({ cover: v })} w={1080} h={432} onError={onError} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nome" htmlFor="bio-name"><Input id="bio-name" value={data.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Categoria ou especialidade" htmlFor="bio-tagline"><Input id="bio-tagline" value={data.tagline} maxLength={60} onChange={(e) => set({ tagline: e.target.value })} /></Field>
          <Field label="Cidade" htmlFor="bio-city"><Input id="bio-city" value={data.city} maxLength={60} placeholder="São Paulo - SP" onChange={(e) => set({ city: e.target.value })} /></Field>
        </div>
      </Section>

      <Section title="Contato" hint="O botão principal abre uma conversa no WhatsApp.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="WhatsApp" htmlFor="bio-whatsapp"><Input id="bio-whatsapp" type="tel" inputMode="tel" placeholder="(11) 99999-9999" value={data.whatsapp} maxLength={20} onChange={(e) => set({ whatsapp: e.target.value })} /></Field>
          <Field label="Texto do botão" htmlFor="bio-cta"><Input id="bio-cta" value={data.cta} maxLength={40} onChange={(e) => set({ cta: e.target.value })} /></Field>
          <Field label="Instagram" htmlFor="bio-instagram"><Input id="bio-instagram" placeholder="@suaempresa" value={data.instagram} maxLength={60} onChange={(e) => set({ instagram: e.target.value })} /></Field>
          <Field label="Endereço" htmlFor="bio-address"><Input id="bio-address" placeholder="Rua, número, bairro" value={data.address} maxLength={120} onChange={(e) => set({ address: e.target.value })} /></Field>
        </div>
      </Section>

      <Section title="Diferenciais" hint={`Até ${MAX.highlights}. Deixe em branco para esconder.`}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Array.from({ length: MAX.highlights }, (_, i) => (
            <Input key={i} id={`bio-hl-${i}`} aria-label={`Diferencial ${i + 1}`} value={data.highlights[i] ?? ""} maxLength={30}
              onChange={(e) => setData((d) => { const h = [...d.highlights]; h[i] = e.target.value; return { ...d, highlights: h }; })} />
          ))}
        </div>
      </Section>

      <Section title="Serviços e produtos" hint="Arraste para mudar a ordem.">
        <Field label="Título da lista" htmlFor="bio-services-title"><Input id="bio-services-title" value={data.servicesTitle} maxLength={30} onChange={(e) => set({ servicesTitle: e.target.value })} /></Field>
        <SortableList items={data.services} onChange={(services) => set({ services })} label={(s) => s.name || "serviço"}
          render={(s) => (
            <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
              <Input id={`bio-svc-${s.id}`} aria-label="Nome do serviço" placeholder="Nome" value={s.name} maxLength={40}
                onChange={(e) => setData((d) => ({ ...d, services: d.services.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)) }))} />
              <Input aria-label="Preço" placeholder="R$ 0,00" value={s.price ?? ""} maxLength={20}
                onChange={(e) => setData((d) => ({ ...d, services: d.services.map((x) => (x.id === s.id ? { ...x, price: e.target.value } : x)) }))} />
            </div>
          )} />
        {data.services.length < MAX.services && (
          <Button variant="secondary" className="self-start" onClick={() => {
            const id = uid(); set({ services: [...data.services, { id, name: "" }] }); setFocusId(`bio-svc-${id}`);
          }}><Plus aria-hidden className="size-4" />Adicionar serviço</Button>
        )}
      </Section>

      <Section title="Links" hint="Catálogo, site, cardápio, agenda... Arraste para mudar a ordem.">
        <SortableList items={data.links} onChange={(links) => set({ links })} label={(l) => l.label || "link"}
          render={(l) => (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input id={`bio-link-${l.id}`} aria-label="Nome do link" placeholder="Ex.: Catálogo" value={l.label} maxLength={40}
                onChange={(e) => setData((d) => ({ ...d, links: d.links.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)) }))} />
              <Input aria-label="Endereço do link" type="url" inputMode="url" placeholder="https://" value={l.url} maxLength={300}
                onChange={(e) => setData((d) => ({ ...d, links: d.links.map((x) => (x.id === l.id ? { ...x, url: e.target.value } : x)) }))} />
            </div>
          )} />
        {data.links.length < MAX.links && (
          <Button variant="secondary" className="self-start" onClick={() => {
            const id = uid(); set({ links: [...data.links, { id, label: "", url: "" }] }); setFocusId(`bio-link-${id}`);
          }}><Plus aria-hidden className="size-4" />Adicionar link</Button>
        )}
      </Section>
    </Card>
  );
}
