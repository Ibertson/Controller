import { CalendarCheck } from "lucide-react";
import { Card, EmptyState, PageTitle } from "@/components/ui";

export default function Page() {
  return (
    <div>
      <PageTitle>Fechar o mês</PageTitle>
      <Card><EmptyState icon={CalendarCheck} title="O fechamento do mês chega na próxima etapa." /></Card>
    </div>
  );
}
