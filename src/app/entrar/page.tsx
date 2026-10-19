"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { repo, useSession } from "@/lib/data";
import { Button, Field, Input } from "@/components/ui";

export default function Entrar() {
  const router = useRouter();
  const session = useSession();
  const email = repo.mode === "supabase";
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState("");

  // Volta do link do email já autenticado: segue para o painel.
  useEffect(() => { if (session) router.replace("/"); }, [session, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return setError(email ? "Informe seu email." : "Diga como quer ser chamado.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return setError("Esse email não parece certo.");
    setSending(true);
    try {
      const r = await repo.signIn(v);
      if (r === "check_email") setSentTo(v);
      else router.replace("/");
    } catch (err) {
      setError(err instanceof Error && /rate/i.test(err.message)
        ? "Muitos pedidos seguidos. Espere alguns minutos e tente de novo."
        : "Não deu para entrar agora. Tente de novo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-bg p-6 shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="size-12" />
        {sentTo ? (
          <div role="status" className="mt-4">
            <MailCheck aria-hidden className="size-8 text-accent" />
            <h1 className="mt-2 text-xl font-bold">Confira seu email</h1>
            <p className="mt-1 text-text-muted">Mandamos um link de acesso para <strong className="text-text">{sentTo}</strong>. Abra neste aparelho para entrar.</p>
            <button className="mt-4 text-sm font-semibold text-accent" onClick={() => setSentTo("")}>Usar outro email</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h1 className="mt-4 text-xl font-bold">Bem-vindo ao Sobra</h1>
            <p className="mt-1 text-text-muted">Anote o que entra e o que sai, e veja quanto sobra no fim do mês.</p>
            <div className="mt-6 flex flex-col gap-4">
              <Field label={email ? "Seu email" : "Seu nome"} htmlFor="login" error={error}
                hint={email ? "Você recebe um link para entrar, sem senha." : "Por enquanto seus dados ficam só neste aparelho."}>
                <Input id="login" autoFocus type={email ? "email" : "text"} autoComplete={email ? "email" : "given-name"} value={value}
                  onChange={(e) => setValue(e.target.value)} aria-invalid={!!error} aria-describedby={error ? "login-error" : "login-hint"} />
              </Field>
              <Button type="submit" size="lg" loading={sending}>{email ? "Receber link de acesso" : "Começar"}</Button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
