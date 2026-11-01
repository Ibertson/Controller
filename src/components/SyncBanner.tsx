"use client";

import { CloudOff, RefreshCw, TriangleAlert, X } from "lucide-react";
import { repo, useSyncStatus } from "@/lib/data";

const plural = (n: number) => (n === 1 ? "1 alteração" : `${n} alterações`);

/** Faixa sob o topo: sem internet, enviando o que ficou guardado, ou uma alteração recusada. */
export function SyncBanner() {
  const s = useSyncStatus();
  if (s.error) {
    return (
      <div role="alert" className="flex items-start gap-2 border-b border-border bg-danger-soft px-4 py-2 text-sm text-danger lg:px-6">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p className="flex-1">Uma alteração feita sem internet não pôde ser salva ({s.error}). Os dados foram recarregados do servidor.</p>
        <button type="button" aria-label="Fechar aviso" onClick={() => repo.dismissSyncError()} className="rounded-sm p-1 hover:bg-bg"><X aria-hidden className="size-4" /></button>
      </div>
    );
  }
  if (!s.online) {
    return (
      <div role="status" className="flex items-start gap-2 border-b border-border bg-warning-soft px-4 py-2 text-sm text-warning lg:px-6">
        <CloudOff aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>
          Sem internet. Pode continuar usando: o que você fizer fica guardado neste aparelho e sincroniza quando a conexão voltar.
          {s.pending > 0 && <strong> {plural(s.pending)} esperando.</strong>}
        </p>
      </div>
    );
  }
  if (s.pending > 0) {
    return (
      <div role="status" className="flex items-center gap-2 border-b border-border bg-accent-soft px-4 py-2 text-sm text-accent lg:px-6">
        <RefreshCw aria-hidden className="size-4 shrink-0 animate-spin" />
        <p>Sincronizando {plural(s.pending)} feitas sem internet…</p>
      </div>
    );
  }
  return null;
}
