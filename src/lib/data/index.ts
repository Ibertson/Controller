"use client";

import { useSyncExternalStore } from "react";
import { LocalRepo } from "./local";
import type { Repo } from "./repo";

// Quando o Supabase estiver configurado, trocar aqui por SupabaseRepo (mesma interface).
export const repo: Repo = new LocalRepo();


/** Dados atuais; undefined enquanto carrega no navegador (primeira renderização no servidor). */
const subscribe = (l: () => void) => repo.subscribe(l);

export function useSnapshot() {
  return useSyncExternalStore(subscribe, () => repo.snapshot(), () => undefined);
}

export function useSession() {
  return useSyncExternalStore(subscribe, () => repo.session(), () => undefined);
}

