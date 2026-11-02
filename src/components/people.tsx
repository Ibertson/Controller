"use client";

import { useSyncExternalStore } from "react";
import { useSession, useSnapshot } from "@/lib/data";

/**
 * Uma lista de pessoas para o app inteiro: a mesma de "Receitas/Despesas por pessoa" em Transações,
 * ou seja, o titular (lançamentos sem pessoa) e as pessoas cadastradas ali.
 */
export const SELF_HIDDEN_KEY = "sobra:titular-oculto";
const SELF_EVENT = "sobra:titular-oculto";

function readHidden() {
  try { return localStorage.getItem(SELF_HIDDEN_KEY) === "1"; } catch { return false; }
}
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(SELF_EVENT, cb);
  return () => { window.removeEventListener("storage", cb); window.removeEventListener(SELF_EVENT, cb); };
}

/** O titular foi tirado da lista de pessoas em Transações. */
export function useSelfHidden() {
  return useSyncExternalStore(subscribe, readHidden, () => false);
}

export function setSelfHidden(v: boolean) {
  try { if (v) localStorage.setItem(SELF_HIDDEN_KEY, "1"); else localStorage.removeItem(SELF_HIDDEN_KEY); } catch { /* sem armazenamento: vale só nesta visita */ }
  window.dispatchEvent(new Event(SELF_EVENT));
}

export function usePeople() {
  const snap = useSnapshot();
  const session = useSession();
  const selfHidden = useSelfHidden();
  const selfName = session?.name ?? "Você";
  const people = snap?.people.filter((p) => !p.archived) ?? [];
  /** Nome para "sem pessoa" (personId vazio): o titular, ou "Sem pessoa" quando ele foi tirado da lista. */
  const selfLabel = selfHidden ? "Sem pessoa" : selfName;
  return { selfName, selfHidden, selfLabel, people };
}

/** Opções de um select de pessoa: valor "" é o titular. */
export function PersonOptions() {
  const { selfLabel, people } = usePeople();
  return (
    <>
      <option value="">{selfLabel}</option>
      {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </>
  );
}

/** Nome de quem está ligado ao lançamento ou cadastro (null = titular). */
export function usePersonName() {
  const snap = useSnapshot();
  const { selfLabel } = usePeople();
  return (id: string | null | undefined) => (id ? snap?.people.find((p) => p.id === id)?.name : null) ?? selfLabel;
}
