import Link from "next/link"
import { Footer } from "@/components/sections/Footer"
import { Header } from "@/components/sections/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { resolveResumeToken } from "@/lib/live-chat/server"
import { ResumeChatOpener } from "./resume-chat"

/**
 * Canlı destek "sohbete dön" bağlantısının indiği sayfa (BAK-99).
 *
 * Ziyaretçinin oturumu yok ve bağlantı çoğu zaman BAŞKA bir cihazda açılır;
 * `localStorage`daki görüşme anahtarı orada bulunmaz. Bu sayfa süreli devam
 * token'ını sunucuda çözer ve görüşme anahtarını tarayıcıya yerleştirir.
 * `publicToken` e-postada hiçbir biçimde geçmez — yalnız bu adımda, doğrulanmış
 * bir bağlantının arkasında görünür.
 */
export const dynamic = "force-dynamic"

export const metadata = {
  title: "Destek görüşmeniz",
  // Arama motorlarına açılacak bir yüzey değil; token'lı URL'ler indekslenmemeli.
  robots: { index: false, follow: false },
}

export default async function LiveChatResumePage({
  params,
}: {
  // Next 16: dinamik segmentler Promise — doğrudan okumak sessizce undefined verir.
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const result = await resolveResumeToken(token)

  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-xl flex-col px-4 py-12 sm:px-6">
        <Card>
          {result.status === "ok" ? (
            <>
              <CardHeader>
                <CardTitle>Görüşmenize döndünüz</CardTitle>
                <CardDescription>
                  Merhaba {result.conversation.visitorName}, destek görüşmenizin tamamı destek
                  panelinde açık. Buradan yanıt yazmaya devam edebilirsiniz.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResumeChatOpener conversationToken={result.conversation.publicToken} />
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>
                  {result.status === "expired"
                    ? "Bu bağlantının süresi doldu"
                    : "Bağlantı geçerli değil"}
                </CardTitle>
                <CardDescription>
                  {result.status === "expired"
                    ? "Güvenlik için destek bağlantıları 7 gün sonra kapanır. Size gönderilen daha yeni bir e-posta varsa oradaki bağlantıyı deneyin."
                    : "Bağlantı eksik ya da hatalı görünüyor. E-postadaki adresin tamamını kopyaladığınızdan emin olun."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Sorunuz devam ediyorsa yeni bir görüşme başlatabilirsiniz — sağ alttaki destek
                  panelinden bize yazın.
                </p>
                <Button nativeButton={false} render={<Link href="/" />}>
                  Ana sayfaya dön
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </main>
      <Footer />
    </>
  )
}
