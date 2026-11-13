import { Suspense } from "react";
import type { Metadata } from "next";
import { PublicQuote } from "./PublicQuote";

export const metadata: Metadata = { title: "Orçamento", robots: { index: false } };

async function Token({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicQuote token={token} />;
}

/** Orçamento aberto pelo cliente: sem login, pelo código do link. */
export default function Page({ params }: { params: Promise<{ token: string }> }) {
  return <Suspense fallback={<div className="min-h-dvh bg-surface" />}><Token params={params} /></Suspense>;
}
