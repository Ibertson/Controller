"use client";

import Link from "next/link";
import { ArrowRight, ExternalLink, Hammer } from "lucide-react";
import { useSnapshot } from "@/lib/data";
import { Card, PageTitle } from "@/components/ui";
import type { Module } from "@/lib/modules";

/** Módulo do Empresarial ainda sem tela própria: diz o que ele vai fazer e onde resolver hoje. */
export function ModuleView({ module: m }: { module: Module }) {
  const nfseUrl = useSnapshot()?.workspace.details?.nfseUrl;
  return (
    <div className="flex flex-col gap-4">
      <PageTitle actions={m.slug === "notas-fiscais" && nfseUrl ? (
        <a href={nfseUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">
          Emitir nota fiscal<ExternalLink aria-hidden className="size-4" />
        </a>
      ) : m.slug === "notas-fiscais" ? (
        <Link href="/empresa/configuracoes" className="text-sm font-semibold text-accent underline">Cadastrar link da prefeitura</Link>
      ) : undefined}>{m.label}</PageTitle>
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="grid size-12 place-items-center rounded-pill bg-accent-soft text-accent"><Hammer aria-hidden className="size-6" /></span>
        <h2 className="text-base font-semibold">Em construção</h2>
        <p className="max-w-md text-sm text-text-muted">{m.description}</p>
        {m.today && (
          <Link href={m.today.href} className="inline-flex items-center gap-1 text-sm font-semibold text-accent underline">
            {m.today.label}<ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
      </Card>
    </div>
  );
}
