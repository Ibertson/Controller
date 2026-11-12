"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, Building2, Check, CircleCheck, Lightbulb, User } from "lucide-react";
import { COMPANY_TYPES, cnpjDigits, companyTypeInfo, formatCnpj, isValidCnpj, overdue, parseCents } from "@/lib/business";
import { repo, useSnapshot } from "@/lib/data";
import { companyOf } from "@/lib/data/repo";
import { today } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { Company, CompanyType, WorkspaceKind } from "@/lib/types";
import { Dialog } from "./Dialog";
import { Button, Field, Input, inputClass } from "./ui";

/** Espaço aberto agora: pessoal ou empresa. */
export function useSpace(): { kind: WorkspaceKind; hasBusiness: boolean; company: Company | null } {
  const snap = useSnapshot();
  const kind = snap?.workspace.kind ?? "personal";
  return { kind, hasBusiness: (snap?.workspaces ?? []).some((w) => w.kind === "business"), company: snap ? companyOf(snap.workspace) : null };
}

/** Dica com lâmpada embaixo de um campo. */
export function Hint({ children, id }: { children: ReactNode; id?: string }) {
  return <p id={id} className="flex items-start gap-1.5 text-xs text-text-muted"><Lightbulb aria-hidden className="mt-px size-3.5 shrink-0 text-warning" />{children}</p>;
}

/** Cadastro da empresa no primeiro acesso ao Empresarial. */
export function CompanyForm({ submitLabel, onSubmit }: { submitLabel: string; onSubmit: (c: Company) => Promise<void> }) {
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [activity, setActivity] = useState("");
  const [type, setType] = useState<CompanyType | "">("");
  const [das, setDas] = useState("");
  const [cnpjMsg, setCnpjMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const info = companyTypeInfo(type || null);

  function validate() {
    if (!cnpjDigits(cnpj)) { setCnpjMsg({ ok: false, text: "Digite o CNPJ para validar." }); return; }
    setCnpjMsg(isValidCnpj(cnpj) ? { ok: true, text: "CNPJ válido." } : { ok: false, text: "CNPJ inválido. Confira os números." });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    const dasCents = parseCents(das);
    if (!name.trim()) err.name = "Informe o nome da empresa.";
    if (cnpjDigits(cnpj) && !isValidCnpj(cnpj)) err.cnpj = "CNPJ inválido. Corrija ou deixe em branco.";
    if (!activity.trim()) err.activity = "Informe a atividade principal.";
    if (!type) err.type = "Selecione o tipo da empresa.";
    if (type === "mei" && !dasCents) err.das = "Informe o valor do DAS mensal.";
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true); setFail("");
    try {
      await onSubmit({
        name: name.trim(), cnpj: cnpjDigits(cnpj) || null, activity: activity.trim(), companyType: type as CompanyType,
        details: type === "mei" && dasCents ? { dasCents } : {},
      });
    } catch (x) {
      setFail(x instanceof Error ? x.message : "Não foi possível salvar.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Nome da Empresa *" htmlFor="co-name" error={errors.name}>
        <Input id="co-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: João Silva Serviços de TI" maxLength={80} aria-invalid={!!errors.name || undefined} autoFocus />
      </Field>
      <Field label="CNPJ (Opcional)" htmlFor="co-cnpj" error={errors.cnpj}>
        <div className="flex gap-2">
          <Input id="co-cnpj" inputMode="numeric" value={cnpj} onChange={(e) => { setCnpj(formatCnpj(e.target.value)); setCnpjMsg(null); }}
            placeholder="00.000.000/0000-00" className="num" aria-invalid={!!errors.cnpj || undefined} />
          <Button type="button" variant="secondary" className="!h-11 shrink-0" onClick={validate}>Validar</Button>
        </div>
        {cnpjMsg
          ? <p role="status" className={`flex items-center gap-1 text-xs ${cnpjMsg.ok ? "text-income" : "text-danger"}`}>{cnpjMsg.ok ? <Check aria-hidden className="size-3.5" /> : <AlertTriangle aria-hidden className="size-3.5" />}{cnpjMsg.text}</p>
          : <Hint>Você pode adicionar o CNPJ depois nas configurações</Hint>}
      </Field>
      <Field label="Atividade Principal *" htmlFor="co-activity" error={errors.activity}>
        <Input id="co-activity" value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Ex.: Desenvolvimento de software" maxLength={120} aria-invalid={!!errors.activity || undefined} />
      </Field>
      <Field label="Tipo de Empresa *" htmlFor="co-type" error={errors.type}>
        <select id="co-type" className={inputClass} value={type} onChange={(e) => { setType(e.target.value as CompanyType); setErrors((x) => ({ ...x, type: "" })); }}
          aria-invalid={!!errors.type || undefined} aria-describedby={info ? "co-type-hint" : undefined}>
          <option value="">Selecione o tipo da sua empresa</option>
          {COMPANY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {info?.hint && <Hint id="co-type-hint">{info.hint}</Hint>}
      </Field>
      {type === "mei" && (
        <div className="rounded-lg border border-accent/30 bg-accent-soft/50 p-3">
          <Field label="Valor do DAS Mensal *" htmlFor="co-das" error={errors.das}>
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">R$</span>
              <Input id="co-das" inputMode="decimal" value={das} onChange={(e) => setDas(e.target.value.replace(/[^\d,.]/g, ""))}
                placeholder="75,60" className="num pl-10" aria-invalid={!!errors.das || undefined} />
            </div>
            <Hint>Valor médio do DAS em 2024: R$ 71,60 (Comércio) a R$ 76,60 (Misto)</Hint>
          </Field>
        </div>
      )}
      {fail && <p role="alert" className="text-sm text-danger">{fail}</p>}
      <Button type="submit" size="lg" loading={busy} disabled={!type}>{submitLabel}</Button>
      {!type && <p className="-mt-2 text-center text-xs text-text-muted">Selecione o tipo da sua empresa para continuar</p>}
    </form>
  );
}

/** Primeiro acesso ao Empresarial: cadastra a empresa e já entra no espaço dela. */
export function CompanyModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  return (
    <Dialog onClose={onClose} title={
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-pill bg-accent text-on-accent"><Building2 aria-hidden className="size-6" /></span>
        <div><h2 className="text-lg font-bold">Bem-vindo ao Painel Empresarial!</h2><p className="text-sm text-text-muted">Vamos configurar sua empresa para começar</p></div>
      </div>
    }>
      <CompanyForm submitLabel="Começar a usar" onSubmit={async (c) => { await repo.createBusiness(c); onDone(); }} />
          </Dialog>
  );
}

/** Abas Pessoal / Empresarial e o indicador Tudo em dia, no topo. */
export function SpaceBar({ onError }: { onError: (msg: string) => void }) {
  const { kind, hasBusiness } = useSpace();
  const router = useRouter();
  const [onboarding, setOnboarding] = useState(false);
  const [busy, setBusy] = useState<WorkspaceKind | null>(null);

  async function go(k: WorkspaceKind) {
    if (k === kind || busy) return;
    if (k === "business" && !hasBusiness) { setOnboarding(true); return; }
    setBusy(k);
    try { await repo.switchWorkspace(k); router.push("/"); }
    catch (e) { onError(e instanceof Error ? e.message : "Não foi possível trocar."); }
    finally { setBusy(null); }
  }

  const tab = (k: WorkspaceKind, label: string, Icon: typeof User) => (
    <button type="button" role="tab" aria-selected={kind === k} onClick={() => go(k)} disabled={!!busy}
      className="inline-flex h-8 items-center gap-1.5 rounded-pill px-2.5 text-sm sm:px-3 font-semibold text-text-muted hover:text-text aria-selected:bg-accent aria-selected:text-on-accent disabled:opacity-60">
      <Icon aria-hidden className="hidden size-4 sm:block" />{label}
    </button>
  );

  return (
    <div className="flex items-center gap-2">
      <div role="tablist" aria-label="Espaço" className="flex items-center gap-1 rounded-pill border border-border bg-surface p-0.5">
        {tab("personal", "Pessoal", User)}
        {tab("business", "Empresarial", Building2)}
      </div>
      <StatusPill />
      {onboarding && <CompanyModal onClose={() => setOnboarding(false)} onDone={() => { setOnboarding(false); router.push("/"); }} />}
    </div>
  );
}

/** Notificação do navegador com as pendências, no máximo uma vez por dia. */
function notifyOverdue(count: number) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const key = "sobra:notified", day = today();
    if (localStorage.getItem(key) === day) return;
    localStorage.setItem(key, day);
    const body = count === 1 ? "1 conta, recebimento ou lembrete em atraso." : `${count} contas, recebimentos ou lembretes em atraso.`;
    const plain = () => { new Notification("Sobra", { body }); };
    if (!navigator.serviceWorker) { plain(); return; }
    void navigator.serviceWorker.getRegistration().then((r) => { if (r) void r.showNotification("Sobra", { body, tag: "atrasos" }); else plain(); });
  } catch { /* sem notificação */ }
}

/** "Tudo em dia" quando nada está atrasado; senão mostra quantas pendências e a lista. */
export function StatusPill() {
  const snap = useSnapshot();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  const pushOn = !!snap?.workspace.details?.pushAlerts;
  const count = snap ? overdue(snap, today()).length : 0;
  useEffect(() => { if (pushOn && count) notifyOverdue(count); }, [pushOn, count]);
  if (!snap) return null;
  const list = overdue(snap, today());
  const ok = list.length === 0;
  const label = ok ? "Tudo em dia" : `${list.length} em atraso`;
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}
        className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-pill border px-2.5 text-xs font-semibold sm:px-3 ${ok ? "border-border text-text" : "border-danger/40 bg-danger/10 text-danger"}`}>
        <span aria-hidden className={`size-2 rounded-pill ${ok ? "bg-income" : "bg-danger"}`} />{label}
      </button>
      {open && (
        <div role="dialog" aria-label="Pendências" className="absolute right-0 top-10 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-bg p-3 shadow-pop">
          {ok ? (
            <p className="flex items-center gap-2 text-sm"><CircleCheck aria-hidden className="size-5 text-income" />Nenhuma conta, recebimento ou lembrete atrasado.</p>
          ) : (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Em atraso</p>
              <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto">
                {list.map((p) => (
                  <li key={p.id}>
                    <Link href={p.href} onClick={() => setOpen(false)} className="flex items-center justify-between gap-2 py-2 text-sm hover:underline">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.title}</span>
                        <span className="text-xs text-text-muted">{p.kind === "pay" ? "A pagar" : p.kind === "receive" ? "A receber" : "Lembrete"} · venceu {p.dueOn.split("-").reverse().join("/")}</span>
                      </span>
                      {p.amountCents != null && <span className={`num shrink-0 ${p.kind === "pay" ? "text-danger" : "text-income"}`}>{p.kind === "pay" ? "-" : ""}{formatBRL(p.amountCents)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
