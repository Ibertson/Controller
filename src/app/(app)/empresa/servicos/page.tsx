"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, Clock, Pencil, Plus, Search, Trash2, Wrench } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { useSpace } from "@/components/business";
import { Dialog } from "@/components/Dialog";
import { useServices } from "@/components/services";
import { Button, Card, Skeleton } from "@/components/ui";
import { repo } from "@/lib/data";
import { formatBRL } from "@/lib/money";
import { formatHours, hourlyCents, searchServices, serviceTotals } from "@/lib/services";
import type { Service } from "@/lib/types";

const NEW = "/empresa/servicos/servico";

/** Serviços: portfólio com busca, totais e cadastro. */
export default function Servicos() {
  const { kind } = useSpace();
  const { toast } = useShell();
  const { list, error, setList } = useServices();
  const [q, setQ] = useState("");
  const [removing, setRemoving] = useState<Service | null>(null);
  const [busy, setBusy] = useState(false);

  if (kind !== "business") {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 aria-hidden className="size-9 text-text-muted" />
        <h1 className="font-semibold">Serviços fazem parte do Painel Empresarial</h1>
        <p className="max-w-md text-sm text-text-muted">Abra a aba Empresarial no topo da tela para cadastrar os serviços da sua empresa.</p>
      </Card>
    );
  }
  if (!list) return <div className="flex flex-col gap-4"><Skeleton className="h-32" /><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;

  const shown = searchServices(list, q);
  const t = serviceTotals(list);

  async function remove(s: Service) {
    setBusy(true);
    try { await repo.deleteService(s.id); setList(list!.filter((x) => x.id !== s.id)); toast("Serviço excluído"); setRemoving(null); }
    catch (e) { toast(e instanceof Error ? e.message : "Não foi possível excluir."); }
    finally { setBusy(false); }
  }

  const newLink = (label: string, extra = "") => (
    <Link href={NEW} className={`inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover ${extra}`}>
      <Plus aria-hidden className="size-4" />{label}
    </Link>
  );

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="text-xl font-bold">Serviços</h1><p className="text-sm text-text-muted">Gerencie o portfólio de serviços da empresa</p></div>
          {newLink("Novo Serviço")}
        </div>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar serviços..." aria-label="Buscar serviços"
            className="h-11 w-full rounded-md border border-border bg-bg pl-9 pr-3 text-base placeholder:text-text-muted" />
        </div>
      </Card>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Total de serviços</p>
          <p className="num mt-1 text-2xl font-bold">{t.count}</p>
          {t.count > t.active && <p className="mt-1 text-xs text-text-muted">{t.active} ativos</p>}
        </Card>
        <Card><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Valor médio</p><p className="num mt-1 text-2xl font-bold text-accent">{formatBRL(t.avgPriceCents)}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Valor médio por hora</p><p className="num mt-1 text-2xl font-bold text-income">{formatBRL(t.avgHourlyCents)}</p></Card>
      </div>

      {list.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <Wrench aria-hidden className="size-10 text-text-muted" />
          <h2 className="font-semibold">Nenhum serviço cadastrado</h2>
          <p className="text-sm text-text-muted">Comece cadastrando seu primeiro serviço</p>
          {newLink("Cadastrar Serviço", "mt-2")}
        </Card>
      ) : shown.length === 0 ? (
        <Card className="py-10 text-center text-sm text-text-muted">Nenhum serviço encontrado para “{q}”.</Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((s) => {
            const rate = hourlyCents(s);
            return (
              <li key={s.id}>
                <Card className="flex h-full flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold">{s.name}{!s.active && <span className="ml-2 rounded-pill bg-surface px-2 py-0.5 text-xs font-medium text-text-muted">Inativo</span>}</h2>
                      <p className="truncate text-xs text-text-muted">{s.category}</p>
                    </div>
                    <div className="flex shrink-0">
                      <Link href={`${NEW}?id=${s.id}`} aria-label={`Editar ${s.name}`} className="rounded-sm p-2 text-text-muted hover:bg-surface hover:text-text"><Pencil className="size-4" /></Link>
                      <button type="button" aria-label={`Excluir ${s.name}`} onClick={() => setRemoving(s)} className="rounded-sm p-2 text-danger hover:bg-danger-soft"><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                  {s.description && <p className="line-clamp-2 text-sm text-text-muted">{s.description}</p>}
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                    <div>
                      <p className="num text-lg font-bold">{formatBRL(s.priceCents)}</p>
                      {rate != null && <p className="text-xs text-text-muted">{formatBRL(rate)} por hora</p>}
                    </div>
                    <span className="num inline-flex items-center gap-1 rounded-pill bg-surface px-2 py-0.5 text-xs font-semibold text-text-muted"><Clock aria-hidden className="size-3" />{formatHours(s.hours)}</span>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {removing && (
        <Dialog onClose={() => setRemoving(null)} title={<h2 className="text-lg font-bold">Excluir serviço?</h2>}>
          <p className="text-sm text-text-muted">“{removing.name}” sai do portfólio. Isso não pode ser desfeito.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemoving(null)}>Cancelar</Button>
            <Button variant="danger" loading={busy} onClick={() => void remove(removing)}>Excluir</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
