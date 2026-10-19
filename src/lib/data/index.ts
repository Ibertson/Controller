"use client";

import { useSyncExternalStore } from "react";
import { LocalRepo } from "./local";
import type { Repo } from "./repo";
import { SupabaseRepo } from "./supabase";

// Com as variáveis do Supabase (.env.local / Vercel), usa o banco; sem elas, guarda no navegador.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const repo: Repo = url && key ? new SupabaseRepo(url, key) : new LocalRepo();


/** Dados atuais; undefined enquanto carrega no navegador (primeira renderização no servidor). */
const subscribe = (l: () => void) => repo.subscribe(l);

export function useSnapshot() {
  return useSyncExternalStore(subscribe, () => repo.snapshot(), () => undefined);
}

export function useSession() {
  return useSyncExternalStore(subscribe, () => repo.session(), () => undefined);
}

