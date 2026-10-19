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
        <p>Conectado como <strong>{session?.name}</strong>. Seus dados estão guardados neste aparelho.</p>
        <div><Button variant="secondary" onClick={async () => { await repo.signOut(); router.replace("/entrar"); }}>Sair</Button></div>
      </Card>
    </div>
  );
}
