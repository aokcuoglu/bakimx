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
            <Shield className="size-5 text-slate-700" />
            İş Yeri Güvenliği
          </CardTitle>
          <CardDescription>İş yeri erişim ve veri güvenliği hakkında bilgi</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">İş Yeri ID</div>
              <div className="text-sm font-mono text-slate-900">{workshop.id}</div>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">İş Yeri Adı</div>
              <div className="text-sm text-slate-900">{workshop.name}</div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-emerald-800">Veri İzolasyonu Aktif</h4>
                <p className="text-xs text-emerald-700 mt-1">
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
            <Users className="size-5 text-slate-700" />
            Hesap Bilgileri
          </CardTitle>
          <CardDescription>Mevcut oturum bilgileriniz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ad Soyad</div>
              <div className="text-sm text-slate-900">{[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}</div>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">E-posta</div>
              <div className="text-sm text-slate-900">{user.email}</div>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Kullanıcı ID</div>
              <div className="text-sm font-mono text-slate-900">{user.id}</div>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">İş Yeri Üyeliği</div>
              <div className="text-sm text-slate-900">{workshop.name}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-5 text-slate-700" />
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
              <div key={feature.label} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                <span className="text-sm text-slate-700">{feature.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}