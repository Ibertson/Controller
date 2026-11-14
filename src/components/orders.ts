"use client";

import { useEffect, useState } from "react";
import { repo, useSnapshot } from "@/lib/data";
import type { BusinessClient, Order, Product, Service } from "@/lib/types";

type Data = { orders: Order[]; clients: BusinessClient[]; products: Product[]; services: Service[] };

/** Pedidos, clientes e catálogo do espaço aberto (recarrega ao trocar de espaço). */
export function useOrders() {
  const wsId = useSnapshot()?.workspace.id;
  const [state, setState] = useState<{ ws?: string; data?: Data; error?: string }>({});
  useEffect(() => {
    if (!wsId) return;
    let alive = true;
    Promise.all([repo.listOrders(), repo.listClients(), repo.listProducts(), repo.listServices()])
      .then(([orders, clients, products, services]) => { if (alive) setState({ ws: wsId, data: { orders, clients, products, services } }); })
      .catch((e) => { if (alive) setState({ ws: wsId, data: { orders: [], clients: [], products: [], services: [] }, error: e instanceof Error ? e.message : "Não foi possível carregar." }); });
    return () => { alive = false; };
  }, [wsId]);
  const ready = state.ws === wsId ? state : {};
  return { data: ready.data, error: ready.error, setData: (data: Data) => setState({ ws: wsId, data }) };
}
