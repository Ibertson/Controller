"use client";

import { useEffect, useState } from "react";
import { Link2Off } from "lucide-react";
import { BioView } from "@/components/bio/BioView";
import { cleanSlug, templateOf, type BioPage } from "@/lib/bio";
import { repo } from "@/lib/data";

export function PublicBio({ slug }: { slug: string }) {
  const [page, setPage] = useState<BioPage | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    repo.publicBio(cleanSlug(decodeURIComponent(slug)))
      .then((p) => { if (alive) setPage(p); })
      .catch(() => { if (alive) { setFailed(true); setPage(null); } });
    return () => { alive = false; };
  }, [slug]);
  useEffect(() => { if (page) document.title = page.data.name; }, [page]);

  if (page === undefined) return <div className="min-h-dvh bg-surface" aria-busy="true" />;
  if (!page) {
    return (
      <main className="grid min-h-dvh place-items-center bg-surface px-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-3">
          <Link2Off aria-hidden className="size-10 text-text-muted" />
          <h1 className="text-lg font-semibold">{failed ? "Não deu para abrir a página" : "Página não encontrada"}</h1>
          <p className="text-sm text-text-muted">{failed ? "Confira sua conexão e tente de novo." : "Este link não existe ou foi desativado pela empresa."}</p>
        </div>
      </main>
    );
  }
  return (
    <main className={`min-h-dvh ${templateOf(page.data.template).dark ? "bg-neutral-950" : "bg-neutral-100"}`}>
      <div className="mx-auto min-h-dvh w-full max-w-[480px] shadow-pop"><BioView data={page.data} /></div>
    </main>
  );
}
