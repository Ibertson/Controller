"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { repo } from "@/lib/data";
import { Button, Field, Input } from "@/components/ui";

// Modo local: sem servidor, os dados ficam neste aparelho. Com o Supabase, vira login por email.
export default function Entrar() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Diga como quer ser chamado.");
    await repo.signIn(name);
    router.replace("/");
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4">
      <form onSubmit={submit} noValidate className="w-full max-w-sm rounded-lg border border-border bg-bg p-6 shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="size-12" />
        <h1 className="mt-4 text-xl font-bold">Bem-vindo ao Sobra</h1>
        <p className="mt-1 text-text-muted">Anote o que entra e o que sai, e veja quanto sobra no fim do mês.</p>
        <div className="mt-6 flex flex-col gap-4">
          <Field label="Seu nome" htmlFor="name" error={error} hint="Por enquanto seus dados ficam só neste aparelho.">
            <Input id="name" autoFocus autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)}
              aria-invalid={!!error} aria-describedby={error ? "name-error" : "name-hint"} />
          </Field>
          <Button type="submit" size="lg">Começar</Button>
        </div>
      </form>
    </main>
  );
}
