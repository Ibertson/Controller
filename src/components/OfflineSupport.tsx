"use client";

import { useEffect } from "react";

const BUILD = process.env.NEXT_PUBLIC_APP_BUILD ?? "local";

/** Instala o service worker que deixa o app abrir sem internet (só no app publicado). */
export function OfflineSupport() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`/sw.js?v=${BUILD}`).catch((e) => console.error("Service worker não instalou", e));
  }, []);
  return null;
}
