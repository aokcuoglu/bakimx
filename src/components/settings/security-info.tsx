"use client"

import { Shield, Lock, Users, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type WorkshopData = {
  id: string
  name: string
  createdAt: string
}

type UserData = {
  id: string
  email: string
  workshopId: string
  firstName: string | null
  lastName: string | null
}

export function SecurityInfo({ workshop, user }: { workshop: WorkshopData; user: UserData }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5 text-foreground" />
            İş Yeri Güvenliği
          </CardTitle>
          <CardDescription>İş yeri erişim ve veri güvenliği hakkında bilgi</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted border border-border space-y-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">İş Yeri ID</div>
              <div className="text-sm font-mono text-foreground">{workshop.id}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted border border-border space-y-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">İş Yeri Adı</div>
              <div className="text-sm text-foreground">{workshop.name}</div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="size-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-foreground">Veri İzolasyonu Aktif</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Tüm verileriniz iş yerinize özel olarak izole edilmiştir. Diğer iş yerleri verilerinize erişemez.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-foreground" />
            Hesap Bilgileri
          </CardTitle>
          <CardDescription>Mevcut oturum bilgileriniz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted border border-border space-y-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ad Soyad</div>
              <div className="text-sm text-foreground">{[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted border border-border space-y-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">E-posta</div>
              <div className="text-sm text-foreground">{user.email}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted border border-border space-y-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Kullanıcı ID</div>
              <div className="text-sm font-mono text-foreground">{user.id}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted border border-border space-y-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">İş Yeri Üyeliği</div>
              <div className="text-sm text-foreground">{workshop.name}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-5 text-foreground" />
            Güvenlik Özellikleri
          </CardTitle>
          <CardDescription>Verilerinizin korunma yöntemleri</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { label: "İş yeri bazlı veri izolasyonu (workshopId)", active: true },
              { label: "Oturum tabanlı kimlik doğrulama", active: true },
              { label: "Tüm API endpoint&apos;lerinde yetkilendirme kontrolü", active: true },
              { label: "İş yeri sahipliği doğrulama (assertWorkshopAccess)", active: true },
              { label: "Denetim günlüğü kaydı", active: true },
            ].map((feature) => (
              <div key={feature.label} className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
                <CheckCircle2 className="size-4 text-primary shrink-0" />
                <span className="text-sm text-foreground">{feature.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}