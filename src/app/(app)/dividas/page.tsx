import { HandCoins } from "lucide-react";
import { Card, EmptyState, PageTitle } from "@/components/ui";

export default function Page() {
  return (
    <div>
      <PageTitle>Dívidas</PageTitle>
      <Card><EmptyState icon={HandCoins} title="O controle de dívidas parceladas chega na próxima etapa." /></Card>
    </div>
  );
}
