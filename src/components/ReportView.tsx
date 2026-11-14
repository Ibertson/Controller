"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { showValue, type Report } from "@/lib/reports";

const TONE = { in: "text-income", out: "text-danger", ok: "text-income" } as const;

/** Conteúdo do relatório: indicadores, limite e tabelas. `maxRows` corta as tabelas na prévia. */
export function ReportBody({ report, maxRows, print }: { report: Report; maxRows?: number; print?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {report.kpis.map((k) => (
          <div key={k.label} className={`rounded-md p-3 ${print ? "border border-[#ddd]" : "bg-surface"}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{k.label}</p>
            <p className={`num mt-1 truncate text-lg font-bold ${k.tone && !print ? TONE[k.tone] : ""}`}>{k.value}</p>
          </div>
        ))}
      </div>
      {report.extra && (
        <div className={`rounded-md p-3 ${print ? "border border-[#ddd]" : "bg-accent-soft/50"}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{report.extra.label}</p>
              <p className="num mt-1 text-lg font-bold">{report.extra.value}</p>
            </div>
            <p className="num text-xs text-text-muted">{report.extra.hint}</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-pill bg-border">
            <span className={`block h-full rounded-pill ${report.extra.pct >= 100 ? "bg-danger" : report.extra.pct >= 80 ? "bg-chart-3" : "bg-accent"}`} style={{ width: `${Math.min(100, report.extra.pct)}%` }} />
          </div>
        </div>
      )}
      {report.sections.map((s) => {
        const rows = maxRows ? s.rows.slice(0, maxRows) : s.rows;
        return (
          <section key={s.title} className="break-inside-avoid-page">
            <h3 className="mb-2 text-sm font-semibold">{s.title}</h3>
            {s.rows.length === 0 ? <p className="rounded-md border border-dashed border-border py-4 text-center text-sm text-text-muted">{s.empty}</p> : (
              <div className={print ? "" : "-mx-4 overflow-x-auto px-4"}>
                <table className={`w-full text-sm ${print ? "text-xs" : s.columns.length > 4 ? "min-w-[640px]" : ""}`}>
                  <thead><tr className="border-b border-border text-left text-xs text-text-muted">
                    {s.columns.map((c, i) => <th key={c.label} className={`py-2 font-semibold ${i < s.columns.length - 1 ? "pr-3" : ""} ${c.kind !== "text" ? "text-right" : ""}`}>{c.label}</th>)}
                  </tr></thead>
                  <tbody>
                    {rows.map((r, ri) => (
                      <tr key={ri} className="border-b border-border last:border-0">
                        {r.map((v, i) => <td key={i} className={`py-1.5 ${i < r.length - 1 ? "pr-3" : ""} ${s.columns[i].kind !== "text" ? "num text-right" : ""}`}>{showValue(v, s.columns[i].kind)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                  {s.total && (!maxRows || s.rows.length <= maxRows) && (
                    <tfoot><tr className="border-t-2 border-border font-semibold">
                      {s.total.map((v, i) => <td key={i} className={`py-1.5 ${i < s.total!.length - 1 ? "pr-3" : ""} ${s.columns[i].kind !== "text" ? "num text-right" : ""}`}>{v === "" ? "" : showValue(v, s.columns[i].kind)}</td>)}
                    </tr></tfoot>
                  )}
                </table>
              </div>
            )}
            {maxRows && s.rows.length > maxRows && <p className="mt-1 text-xs text-text-muted">Mais {s.rows.length - maxRows} linhas no PDF e no Excel.</p>}
          </section>
        );
      })}
      {report.note && <p className="text-xs text-text-muted">{report.note}</p>}
    </div>
  );
}

/** Relatório inteiro numa folha para imprimir ou salvar em PDF. */
export function ReportPrint({ report, company, cnpj, onClose }: { report: Report; company: string; cnpj?: string | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div data-print-root role="dialog" aria-modal="true" aria-label={`${report.title} ${report.period}`} className="fixed inset-0 z-50 overflow-y-auto bg-surface px-3 py-4 sm:px-6">
      <div className="mx-auto mb-3 flex max-w-4xl items-center justify-end gap-2 print:hidden">
        <p className="mr-auto text-sm text-text-muted">Na janela de impressão, escolha “Salvar como PDF”.</p>
        <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">
          <Printer aria-hidden className="size-4" />Salvar PDF</button>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-md bg-bg p-2 hover:bg-surface-raised"><X className="size-5" /></button>
      </div>
      <article className="mx-auto flex max-w-4xl flex-col gap-5 rounded-lg bg-white p-5 text-[#1a1a1a] shadow-card sm:p-8 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#ddd] pb-4">
          <div>
            <p className="text-lg font-bold">{company}</p>
            {cnpj && <p className="text-sm text-[#555]">CNPJ {cnpj}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{report.title}</p>
            <p className="text-sm text-[#555]">{report.period}</p>
            <p className="text-xs text-[#777]">Gerado em {new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
          </div>
        </header>
        <ReportBody report={report} print />
      </article>
    </div>,
    document.body,
  );
}
