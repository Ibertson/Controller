"use client";

import { useEffect, useState } from "react";
import { Check, FileX2, Printer, X } from "lucide-react";
import { Button } from "@/components/ui";
import { repo } from "@/lib/data";
import { today } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { formatQty } from "@/lib/products";
import { effectiveStatus, formatNumber, itemTotal, quoteTotals, statusLabel } from "@/lib/quotes";
import type { Quote } from "@/lib/types";

const dateBR = (d: string) => d.split("-").reverse().join("/");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function PublicQuote({ token }: { token: string }) {
  const [q, setQ] = useState<Quote | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let alive = true;
    if (!UUID.test(token)) { queueMicrotask(() => { if (alive) setQ(null); }); return () => { alive = false; }; }
    repo.publicQuote(token)
      .then((r) => { if (alive) setQ(r); })
      .catch(() => { if (alive) { setFailed(true); setQ(null); } });
    return () => { alive = false; };
  }, [token]);
  useEffect(() => { if (q) document.title = `Orçamento ${formatNumber(q.number)} · ${q.company.name}`; }, [q]);

  async function respond(accept: boolean) {
    setBusy(accept ? "yes" : "no"); setMsg("");
    try {
      const r = await repo.respondQuote(token, accept);
      if (r) setQ(r);
      setMsg(r && (r.status === "aprovado" || r.status === "recusado") ? (accept ? "Obrigado! A empresa foi avisada que você aprovou." : "Resposta enviada. A empresa foi avisada.") : "Este orçamento não aceita mais resposta.");
    } catch { setMsg("Não deu para enviar a resposta. Confira sua conexão e tente de novo."); }
    finally { setBusy(null); }
  }

  if (q === undefined) return <div className="min-h-dvh bg-surface" aria-busy="true" />;
  if (!q) {
    return (
      <main className="grid min-h-dvh place-items-center bg-surface px-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-3">
          <FileX2 aria-hidden className="size-10 text-text-muted" />
          <h1 className="text-lg font-semibold">{failed ? "Não deu para abrir o orçamento" : "Orçamento não encontrado"}</h1>
          <p className="text-sm text-text-muted">{failed ? "Confira sua conexão e tente de novo." : "Este link não existe ou o orçamento foi excluído pela empresa."}</p>
        </div>
      </main>
    );
  }

  const st = effectiveStatus(q, today());
  const t = quoteTotals(q);
  const open = st === "enviado" || st === "visualizado";
  const place = [q.company.city, q.company.uf].filter(Boolean).join(" - ");

  return (
    <main className="min-h-dvh bg-surface px-4 py-6 print:bg-white print:p-0">
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-lg bg-bg p-5 shadow-card sm:p-8 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-lg font-bold">{q.company.name}</p>
            <p className="text-xs text-text-muted">{[q.company.cnpj && `CNPJ ${q.company.cnpj}`, place, q.company.email].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Orçamento</p>
            <p className="num text-xl font-bold">{formatNumber(q.number)}</p>
            <p className="text-xs text-text-muted">Emitido em {dateBR(q.issuedOn)} · válido até {dateBR(q.validUntil)}</p>
          </div>
        </header>

        <section className="grid gap-1 text-sm">
          <p><span className="text-text-muted">Cliente: </span><strong>{q.clientName}</strong></p>
          {q.title && <p><span className="text-text-muted">Serviço: </span>{q.title}</p>}
          <p><span className="text-text-muted">Situação: </span><strong>{statusLabel(st)}</strong></p>
        </section>

        <section>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-muted">
                <th className="py-2 font-semibold">Descrição</th><th className="py-2 text-right font-semibold">Qtd.</th>
                <th className="hidden py-2 text-right font-semibold sm:table-cell">Unitário</th><th className="py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {q.items.map((i) => (
                <tr key={i.id} className="border-b border-border align-top">
                  <td className="py-2 pr-2">{i.description}<span className="block text-xs text-text-muted sm:hidden">{formatBRL(i.unitCents)} cada</span></td>
                  <td className="num py-2 text-right">{formatQty(i.qty)}</td>
                  <td className="num hidden py-2 text-right sm:table-cell">{formatBRL(i.unitCents)}</td>
                  <td className="num py-2 text-right font-semibold">{formatBRL(itemTotal(i))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ml-auto mt-3 flex w-full max-w-xs flex-col gap-1 text-sm">
            <p className="flex justify-between"><span className="text-text-muted">Subtotal</span><span className="num">{formatBRL(t.subtotal)}</span></p>
            {t.discount > 0 && <p className="flex justify-between"><span className="text-text-muted">Desconto</span><span className="num">− {formatBRL(t.discount)}</span></p>}
            <p className="flex justify-between border-t border-border pt-1 text-base font-bold"><span>Total</span><span className="num">{formatBRL(t.total)}</span></p>
          </div>
        </section>

        {q.notes && (
          <section>
            <h2 className="mb-1 text-sm font-semibold">Observações</h2>
            <p className="whitespace-pre-line text-sm text-text-muted">{q.notes}</p>
          </section>
        )}

        <footer className="flex flex-col gap-3 border-t border-border pt-4 print:hidden">
          {msg && <p role="status" className="text-sm font-medium">{msg}</p>}
          <div className="flex flex-wrap gap-2">
            {open && (
              <>
                <Button onClick={() => void respond(true)} loading={busy === "yes"} disabled={busy != null}><Check aria-hidden className="size-4" />Aprovar orçamento</Button>
                <Button variant="secondary" onClick={() => void respond(false)} loading={busy === "no"} disabled={busy != null}><X aria-hidden className="size-4" />Recusar</Button>
              </>
            )}
            <Button variant="ghost" onClick={() => window.print()}><Printer aria-hidden className="size-4" />Imprimir / salvar PDF</Button>
          </div>
          {st === "vencido" && <p className="text-sm text-text-muted">A validade deste orçamento terminou. Fale com {q.company.name} para atualizar.</p>}
        </footer>
        <p className="text-center text-[11px] text-text-muted">Feito com Sobra</p>
      </article>
    </main>
  );
}
