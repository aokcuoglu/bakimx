"use client"

import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Check, Copy, MailPlus, RefreshCw, ShieldOff, ShieldCheck } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import {
  inviteSalesAdvisor,
  resendSalesAdvisorInvite,
  setSalesAdvisorActive,
} from "@/app/admin/sales/advisors/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  salesAdvisorInviteSchema,
  type SalesAdvisorInviteValues,
} from "@/lib/validations/sales-advisor"

type AdvisorRow = {
  id: string
  name: string
  email: string
  disabledAt: string | null
  createdAt: string
}

type InviteRow = {
  id: string
  name: string
  email: string
  status: "pending" | "accepted" | "revoked"
  expiresAt: string
  createdAt: string
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  })
}

export function SalesAdvisorManagement({
  advisors,
  invites,
}: {
  advisors: AdvisorRow[]
  invites: InviteRow[]
}) {
  const [pending, startTransition] = useTransition()
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const form = useForm<SalesAdvisorInviteValues>({
    resolver: zodResolver(salesAdvisorInviteSchema),
    defaultValues: { email: "", firstName: "", lastName: "" },
  })

  function submit(values: SalesAdvisorInviteValues) {
    startTransition(async () => {
      const result = await inviteSalesAdvisor(values)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      form.reset()
      setInviteUrl(result.inviteUrl ?? null)
      setCopied(false)
      if (result.warning) toast.warning(result.warning)
      else toast.success("Satış danışmanı daveti oluşturuldu.")
    })
  }

  function resend(inviteId: string) {
    startTransition(async () => {
      const result = await resendSalesAdvisorInvite(inviteId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setInviteUrl(result.inviteUrl ?? null)
      setCopied(false)
      if (result.warning) toast.warning(result.warning)
      else toast.success("Yeni davet bağlantısı gönderildi; eski bağlantı geçersiz.")
    })
  }

  function toggleAdvisor(advisor: AdvisorRow) {
    const active = Boolean(advisor.disabledAt)
    startTransition(async () => {
      const result = await setSalesAdvisorActive(advisor.id, active)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(active ? "Danışman erişimi açıldı." : "Danışman erişimi kapatıldı.")
    })
  }

  async function copyInvite() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    toast.success("Davet bağlantısı kopyalandı.")
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-4 sm:p-6">
        <div className="mb-4">
          <h2 className="font-semibold text-foreground">Yeni danışman daveti</h2>
          <p className="text-sm text-muted-foreground">Bağlantı 72 saat geçerli ve tek kullanımlıktır.</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="grid gap-4 md:grid-cols-3">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ad</FormLabel>
                  <FormControl><Input autoComplete="given-name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Soyad</FormLabel>
                  <FormControl><Input autoComplete="family-name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-posta</FormLabel>
                  <FormControl><Input type="email" autoComplete="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="md:col-span-3">
              <Button type="submit" disabled={pending}>
                <MailPlus className="size-4" /> Davet gönder
              </Button>
            </div>
          </form>
        </Form>

        {inviteUrl && (
          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-success/20 bg-success/10 p-3 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 truncate text-sm text-success-strong">{inviteUrl}</p>
            <Button type="button" variant="outline" size="sm" onClick={copyInvite}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Kopyalandı" : "Bağlantıyı kopyala"}
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-foreground">Danışmanlar</h2>
          <p className="text-sm text-muted-foreground">Erişim kapatıldığında açık oturum bir sonraki istekte reddedilir.</p>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Danışman</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Oluşturma</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {advisors.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Henüz danışman hesabı yok.</TableCell></TableRow>
              ) : advisors.map((advisor) => (
                <TableRow key={advisor.id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{advisor.name}</p>
                    <p className="text-xs text-muted-foreground">{advisor.email}</p>
                  </TableCell>
                  <TableCell>
                    {advisor.disabledAt
                      ? <Badge variant="outline">Erişim kapalı</Badge>
                      : <Badge variant="outline" className="bg-success/10 text-success-strong">Etkin</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(advisor.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => toggleAdvisor(advisor)}
                    >
                      {advisor.disabledAt ? <ShieldCheck className="size-4" /> : <ShieldOff className="size-4" />}
                      {advisor.disabledAt ? "Erişimi aç" : "Erişimi kapat"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-foreground">Davet geçmişi</h2>
          <p className="text-sm text-muted-foreground">Yeniden gönderim eski tokenı anında geçersiz kılar.</p>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Davetli</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Son geçerlilik</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Henüz davet yok.</TableCell></TableRow>
              ) : invites.map((invite) => {
                const expired = invite.status === "pending" && new Date(invite.expiresAt) <= new Date()
                const label = invite.status === "accepted" ? "Kabul edildi" : invite.status === "revoked" ? "İptal" : expired ? "Süresi doldu" : "Bekliyor"
                return (
                  <TableRow key={invite.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{invite.name}</p>
                      <p className="text-xs text-muted-foreground">{invite.email}</p>
                    </TableCell>
                    <TableCell><Badge variant="outline">{label}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(invite.expiresAt)}</TableCell>
                    <TableCell className="text-right">
                      {invite.status !== "accepted" && (
                        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => resend(invite.id)}>
                          <RefreshCw className="size-4" /> Yeniden gönder
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
