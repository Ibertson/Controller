import { Bell } from "lucide-react";
import { Card, EmptyState, PageTitle } from "@/components/ui";

export default function Page() {
  return (
    <div>
      <PageTitle>Lembretes</PageTitle>
      <Card><EmptyState icon={Bell} title="Avisos de contas e datas importantes. Esta tela chega numa próxima etapa." /></Card>
    </div>
  );
}
