"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Janela simples: Esc fecha, Tab fica dentro. */
export function Dialog({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Com uma janela aberta sobre outra, só a de cima responde ao teclado.
      const open = document.querySelectorAll("[role=dialog][aria-modal=true]");
      if (open[open.length - 1] !== ref.current) return;
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>("button, input, select, [tabindex]:not([tabindex='-1'])");
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <button aria-label="Fechar" tabIndex={-1} className="absolute inset-0 bg-text/40" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="dlg-title"
        className={`relative flex max-h-dvh w-full flex-col overflow-y-auto rounded-t-lg bg-bg p-5 shadow-pop ${wide ? "lg:w-[720px]" : "lg:w-[560px]"} lg:rounded-lg`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div id="dlg-title" className="min-w-0 flex-1">{title}</div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-sm p-2 hover:bg-surface"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
