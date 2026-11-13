"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bot, Camera, Car, Droplets, Grid3x3, Hammer, House, Laptop, Package, Pencil, Plus, PlusCircle, RotateCcw, Scissors, Search, Sparkles, Tag, Trash2, Wind, Wrench, X,
  type LucideIcon,
} from "lucide-react";
import { useShell } from "@/components/AppShell";
import { useSpace } from "@/components/business";
import { Dialog } from "@/components/Dialog";
import { Button, inputClass } from "@/components/ui";
import { repo } from "@/lib/data";
import { DEFAULT_QUOTE_CATALOG, QUOTE_ICONS, cleanCatalog, searchCatalog, type QuoteIcon } from "@/lib/quotes";
import type { QuoteCategory } from "@/lib/types";

const ICONS: Record<QuoteIcon, LucideIcon> = {
  home: House, sparkles: Sparkles, wrench: Wrench, wind: Wind, droplets: Droplets, hammer: Hammer, grid: Grid3x3, car: Car, laptop: Laptop,
  scissors: Scissors, camera: Camera, tag: Tag,
};
const ICON_LABELS: Record<QuoteIcon, string> = {
  home: "Casa", sparkles: "Brilho", wrench: "Chave", wind: "Ar", droplets: "Gota", hammer: "Martelo", grid: "Grade", car: "Carro", laptop: "Computador",
  scissors: "Tesoura", camera: "Câmera", tag: "Etiqueta",
};
export const quoteIcon = (name: string): LucideIcon => ICONS[name as QuoteIcon] ?? Tag;

const NEW = "/empresa/orcamentos/orcamento";

/** "Novo orçamento": escolhe o tipo (produtos, personalizado ou um serviço do catálogo). O catálogo é editável. */
export function NewQuoteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { company } = useSpace();
  const catalog = company?.details?.quoteCatalog ?? DEFAULT_QUOTE_CATALOG;
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(false);
  const go = (params: Record<string, string>) => { onClose(); router.push(`${NEW}?${new URLSearchParams(params)}`); };
  const shown = searchCatalog(catalog, q);

  return (
    <Dialog wide="xl" onClose={onClose} title={<h2 className="text-lg font-bold">{editing ? "Editar categorias e subcategorias" : "Selecione o tipo de serviço para o orçamento"}</h2>}>
      {editing ? <CatalogEditor initial={catalog} onDone={() => setEditing(false)} /> : (
        <div className="flex flex-col gap-5">
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por serviço ou categoria..." aria-label="Buscar por serviço ou categoria"
              className="h-11 w-full rounded-md border border-border bg-bg pl-9 pr-3 text-base placeholder:text-text-muted" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button type="button" onClick={() => go({ tipo: "produtos" })} className="flex h-12 items-center gap-2 rounded-md bg-success px-4 text-sm font-semibold text-white hover:opacity-90">
              <Package aria-hidden className="size-4" />Venda de Produtos
            </button>
            <button type="button" onClick={() => go({ tipo: "personalizado" })} className="flex h-12 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">
              <PlusCircle aria-hidden className="size-4" />Personalizado
            </button>
            <button type="button" disabled className="relative flex h-12 cursor-not-allowed items-center gap-2 rounded-md bg-surface px-4 text-sm font-semibold text-text-muted">
              <Bot aria-hidden className="size-4" />Orçamento com IA
              <span className="absolute right-2 top-1 rounded-pill bg-bg px-1.5 text-[10px] font-medium">Em breve</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-text-muted">Ou escolha um serviço abaixo.</p>
            <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-sm font-semibold text-accent hover:bg-accent-soft">
              <Pencil aria-hidden className="size-4" />Editar categorias
            </button>
          </div>

          {shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">Nada encontrado para “{q}”. Use <strong>Personalizado</strong> ou edite as categorias.</p>
          ) : shown.map((c) => {
            const Icon = quoteIcon(c.icon);
            return (
              <section key={c.id}>
                <h3 className="mb-2 font-semibold">{c.name}</h3>
                {c.items.length === 0 ? <p className="text-sm text-text-muted">Sem subcategorias.</p> : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {c.items.map((it) => (
                      <button key={it} type="button" onClick={() => go({ tipo: "servico", cat: c.name, sub: it })}
                        className="flex min-h-14 items-center gap-3 rounded-md bg-surface px-3 py-2 text-left text-sm hover:bg-accent-soft hover:text-accent">
                        <Icon aria-hidden className="size-4 shrink-0" />{it}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </Dialog>
  );
}

function CatalogEditor({ initial, onDone }: { initial: QuoteCategory[]; onDone: () => void }) {
  const { company } = useSpace();
  const { toast } = useShell();
  const [list, setList] = useState<QuoteCategory[]>(() => initial.map((c) => ({ ...c, items: [...c.items] })));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const patch = (id: string, p: Partial<QuoteCategory>) => setList((l) => l.map((c) => (c.id === id ? { ...c, ...p } : c)));

  function addItem(c: QuoteCategory) {
    const v = (drafts[c.id] ?? "").trim();
    if (!v) return;
    patch(c.id, { items: [...c.items, v] });
    setDrafts((d) => ({ ...d, [c.id]: "" }));
  }

  async function save() {
    if (!company) return;
    setBusy(true); setFail("");
    try {
      await repo.updateCompany({ ...company, details: { ...company.details, quoteCatalog: cleanCatalog(list) } });
      toast("Categorias salvas");
      onDone();
    } catch (e) { setFail(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">Renomeie, apague ou crie categorias e subcategorias. Elas aparecem ao criar um novo orçamento.</p>
      {list.map((c, ci) => (
        <section key={c.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label={`Ícone de ${c.name || "categoria"}`} value={c.icon} onChange={(e) => patch(c.id, { icon: e.target.value })} className={`${inputClass} !w-28 shrink-0`}>
              {QUOTE_ICONS.map((i) => <option key={i} value={i}>{ICON_LABELS[i]}</option>)}
            </select>
            <input aria-label={`Nome da categoria ${ci + 1}`} value={c.name} maxLength={60} placeholder="Nome da categoria" onChange={(e) => patch(c.id, { name: e.target.value })}
              className={`${inputClass} min-w-0 flex-1 basis-40 font-semibold`} />
            <button type="button" aria-label={`Apagar categoria ${c.name}`} onClick={() => setList((l) => l.filter((x) => x.id !== c.id))}
              className="rounded-sm p-2 text-danger hover:bg-danger-soft"><Trash2 className="size-4" /></button>
          </div>
          <ul className="flex flex-col gap-1.5">
            {c.items.map((it, i) => (
              <li key={i} className="flex items-center gap-2">
                <input aria-label={`Subcategoria ${i + 1} de ${c.name}`} value={it} maxLength={120}
                  onChange={(e) => patch(c.id, { items: c.items.map((x, j) => (j === i ? e.target.value : x)) })} className={`${inputClass} !h-9 min-w-0 flex-1 text-sm`} />
                <button type="button" aria-label={`Apagar ${it}`} onClick={() => patch(c.id, { items: c.items.filter((_, j) => j !== i) })}
                  className="rounded-sm p-1.5 text-text-muted hover:bg-surface hover:text-danger"><X className="size-4" /></button>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <input aria-label={`Nova subcategoria em ${c.name}`} value={drafts[c.id] ?? ""} maxLength={120} placeholder="Nova subcategoria"
              onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(c); } }} className={`${inputClass} !h-9 min-w-0 flex-1 text-sm`} />
            <Button type="button" size="sm" variant="secondary" onClick={() => addItem(c)}><Plus aria-hidden className="size-4" />Adicionar</Button>
          </div>
        </section>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => setList((l) => [...l, { id: crypto.randomUUID(), name: "", icon: "tag", items: [] }])}>
          <Plus aria-hidden className="size-4" />Nova categoria
        </Button>
        <Button type="button" variant="ghost" onClick={() => setList(DEFAULT_QUOTE_CATALOG.map((c) => ({ ...c, items: [...c.items] })))}>
          <RotateCcw aria-hidden className="size-4" />Restaurar sugestões
        </Button>
      </div>
      {fail && <p role="alert" className="text-sm text-danger">{fail}</p>}
      <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-border bg-bg px-5 py-3">
        <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
        <Button type="button" loading={busy} onClick={() => void save()}>Salvar categorias</Button>
      </div>
    </div>
  );
}
