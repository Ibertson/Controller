import { Suspense } from "react";
import type { Metadata } from "next";
import { PublicBio } from "./PublicBio";

export const metadata: Metadata = { title: "Link Bio", robots: { index: false } };

async function Slug({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicBio slug={slug} />;
}

/** Página pública do Link Bio: abre sem login, só quando a empresa ativou. */
export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <Suspense fallback={<div className="min-h-dvh bg-surface" />}><Slug params={params} /></Suspense>;
}
