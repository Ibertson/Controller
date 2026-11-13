"use client";

import { useEffect, useState } from "react";
import { repo, useSnapshot } from "@/lib/data";
import type { BusinessClient, Receivable } from "@/lib/types";

interface Data { clients: BusinessClient[]; receivables: Receivable[] }

/** Clientes e contas a receber do espaço aberto (recarrega ao trocar de espaço). */
export function useReceivables() {
  const wsId = useSnapshot()?.workspace.id;
  const [state, setState] = useState<{ ws?: string; data?: Data; error?: string }>({});
  useEffect(() => {
    if (!wsId) return;
    let alive = true;
    Promise.all([repo.listClients(), repo.listReceivables()])
      .then(([clients, receivables]) => { if (alive) setState({ ws: wsId, data: { clients, receivables } }); })
      .catch((e) => { if (alive) setState({ ws: wsId, data: { clients: [], receivables: [] }, error: e instanceof Error ? e.message : "Não foi possível carregar." }); });
    return () => { alive = false; };
  }, [wsId]);
  const ready = state.ws === wsId ? state : {};
  return { data: ready.data, error: ready.error, setData: (data: Data) => setState({ ws: wsId, data }) };
}
