import { Heart } from "lucide-react";
import { Card, EmptyState, PageTitle } from "@/components/ui";

export default function Page() {
  return (
    <div>
      <PageTitle>Lista de desejos</PageTitle>
      <Card><EmptyState icon={Heart} title="Guarde o que você quer comprar e planeje quando. Esta tela chega numa próxima etapa." /></Card>
    </div>
  );
}
