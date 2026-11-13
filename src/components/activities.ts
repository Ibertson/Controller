"use client";

import { useEffect, useState } from "react";
import { repo, useSnapshot } from "@/lib/data";
import type { Activity } from "@/lib/types";

/** Carrega as atividades do espaço aberto (recarrega ao trocar de espaço). */
export function useActivities() {
  const wsId = useSnapshot()?.workspace.id;
  const [state, setState] = useState<{ ws?: string; list?: Activity[]; error?: string }>({});
  useEffect(() => {
    if (!wsId) return;
    let alive = true;
    repo.listActivities()
      .then((list) => { if (alive) setState({ ws: wsId, list }); })
      .catch((e) => { if (alive) setState({ ws: wsId, list: [], error: e instanceof Error ? e.message : "Não foi possível carregar." }); });
    return () => { alive = false; };
  }, [wsId]);
  const ready = state.ws === wsId ? state : {};
  return { list: ready.list, error: ready.error, setList: (list: Activity[]) => setState({ ws: wsId, list }) };
}
