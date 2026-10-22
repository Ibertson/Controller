"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { repo, useSession } from "@/lib/data";
import { Button, Field, Input } from "@/components/ui";

const noSubscribe = () => () => {};

export default function Entrar() {
  const router = useRouter();
  const session = useSession();
  const email = repo.mode === "supabase";
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState("");
  // Quem criou senha no Perfil pode entrar com email e senha em vez do link.
  const [withPassword, setWithPassword] = useState(false);
  const [password, setPassword] = useState("");
  // Publicado sem as variáveis do Supabase: avisa em vez de cair calado no modo local.
  const missingConfig = useSyncExternalStore(noSubscribe,
    () => !email && !/^(localhost|127\.|192\.168\.)/.test(window.location.hostname), () => false);

  // Volta do link do email já autenticado: segue para o painel.
  useEffect(() => { if (session) router.replace("/"); }, [session, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return setError(email ? "Informe seu email." : "Diga como quer ser chamado.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return setError("Esse email não parece certo.");
    if (withPassword && !password) return setError("Digite sua senha.");
    setSending(true);
    try {
      if (withPassword) { await repo.signInWithPassword(v, password); return; }
      const r = await repo.signIn(v);
      if (r === "check_email") setSentTo(v);
      else router.replace("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(withPassword ? msg : /rate|seconds/i.test(msg)
        ? "Muitos pedidos seguidos. Espere alguns minutos e tente de novo."
        : `Não deu para entrar agora (${msg}). Tente de novo.`);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-bg p-6 shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="size-12" />
        {missingConfig && (
          <p role="alert" className="mt-4 rounded-md bg-warning-soft p-3 text-sm text-warning">
            Este endereço está sem as variáveis do Supabase, então os dados ficam só neste aparelho.
            Na Vercel, adicione NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e faça Redeploy.
          </p>
        )}
        {sentTo ? (
          <div role="status" className="mt-4">
            <MailCheck aria-hidden className="size-8 text-accent" />
            <h1 className="mt-2 text-xl font-bold">Confira seu email</h1>
            <p className="mt-1 text-text-muted">Mandamos um link de acesso para <strong className="text-text">{sentTo}</strong>. Clique no link para entrar.</p>
            <button className="mt-4 text-sm font-semibold text-accent" onClick={() => setSentTo("")}>Usar outro email</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h1 className="mt-4 text-xl font-bold">Bem-vindo ao Sobra</h1>
            <p className="mt-1 text-text-muted">Anote o que entra e o que sai, e veja quanto sobra no fim do mês.</p>
            <div className="mt-6 flex flex-col gap-4">
              <Field label={email ? "Seu email" : "Seu nome"} htmlFor="login" error={error}
                hint={email ? (withPassword ? undefined : "Você recebe um link para entrar, sem senha.") : "Por enquanto seus dados ficam só neste aparelho."}>
                <Input id="login" autoFocus type={email ? "email" : "text"} autoComplete={email ? "email" : "given-name"} value={value}
                  onChange={(e) => setValue(e.target.value)} aria-invalid={!!error} aria-describedby={error ? "login-error" : "login-hint"} />
              </Field>
              {withPassword && (
                <Field label="Senha" htmlFor="login-password">
                  <Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
              )}
              <Button type="submit" size="lg" loading={sending}>{!email ? "Começar" : withPassword ? "Entrar" : "Receber link de acesso"}</Button>
              {email && (
                <button type="button" className="text-sm font-semibold text-accent" onClick={() => { setWithPassword((w) => !w); setError(""); }}>
                  {withPassword ? "Entrar com link no email" : "Entrar com senha"}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
