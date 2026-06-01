import { getAppData } from "@/app/app/data"
import { ComingSoonShell } from "@/components/app/coming-soon-shell"

export default async function QuotesPage() {
  const { workshop } = await getAppData()
  return (
    <ComingSoonShell
      workshopName={workshop?.name}
      title="Teklifler"
      description="Müşterilerinize hızlı teklifler oluşturun, onaylarını alın ve iş emrine dönüştürün."
    />
  )
}
