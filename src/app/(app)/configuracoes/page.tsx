"use client";

import { useRouter } from "next/navigation";
import { Button, Card, PageTitle } from "@/components/ui";
import { repo, useSession } from "@/lib/data";

export default function Configuracoes() {
  const session = useSession();
  const router = useRouter();
  return (
    <div>
      <PageTitle>Configurações</PageTitle>
      <Card className="flex flex-col gap-3">
        <p>Conectado como <strong>{session?.name}</strong>. {repo.mode === "supabase" ? "Seus dados ficam na sua conta e aparecem em qualquer aparelho." : "Seus dados estão guardados neste aparelho."}</p>
        <div><Button variant="secondary" onClick={async () => { await repo.signOut(); router.replace("/entrar"); }}>Sair</Button></div>
      </Card>
    </div>
  );
}
