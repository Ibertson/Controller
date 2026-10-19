import { Flag } from "lucide-react";
import { Card, EmptyState, PageTitle } from "@/components/ui";

export default function Page() {
  return (
    <div>
      <PageTitle>Metas</PageTitle>
      <Card><EmptyState icon={Flag} title="Para que você está guardando dinheiro? As metas chegam na próxima etapa." /></Card>
    </div>
  );
}
