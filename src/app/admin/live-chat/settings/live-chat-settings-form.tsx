"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"
import { useForm } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { typedResolver } from "@/lib/validations/resolver"
import { liveChatSettingsSchema, type LiveChatSettingsValues } from "@/lib/validations/live-chat"
import { DAY_LABELS, DISPLAY_ORDER } from "@/lib/live-chat/schedule"
import { saveLiveChatSettingsAction } from "../actions"

const TIMEZONES: Record<string, string> = {
  "Europe/Istanbul": "İstanbul (TRT, UTC+3)",
  "Europe/Berlin": "Berlin (CET/CEST)",
  UTC: "UTC",
}

export function LiveChatSettingsForm({ defaultValues }: { defaultValues: LiveChatSettingsValues }) {
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  const form = useForm<LiveChatSettingsValues, unknown, LiveChatSettingsValues>({
    resolver: typedResolver(liveChatSettingsSchema),
    defaultValues,
  })

  // React Compiler react-hook-form'un watch()'ını memoize edemiyor; repo deseni
  // gereği dosya bazında bastırılır (docs/agent-workflows/repo-guardrails.md §1).
  const enabled = form.watch("enabled") // eslint-disable-line react-hooks/incompatible-library

  function onSubmit(values: LiveChatSettingsValues) {
    setError("")
    startTransition(async () => {
      const result = await saveLiveChatSettingsAction({
        enabled: values.enabled,
        timezone: values.timezone,
        greeting: values.greeting,
        offlineMessage: values.offlineMessage,
        responseNote: values.responseNote,
        holidays: values.holidays ?? "",
        schedule: values.schedule,
      })
      if (result.ok) toast.success("Canlı destek ayarları kaydedildi")
      else setError(result.error)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Widget Durumu</CardTitle>
            <CardDescription>
              Kapatıldığında canlı destek satırı www.bakimx.com&apos;da hiç görünmez; ziyaretçiler destek
              formunu kullanmaya devam eder.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={(c) => field.onChange(c)} />
                    </FormControl>
                    <FormLabel className="cursor-pointer">Canlı destek açık</FormLabel>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Saat Dilimi</FormLabel>
                  <Select items={TIMEZONES} value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <FormControl>
                      <SelectTrigger className="w-full sm:w-72">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(TIMEZONES).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Aşağıdaki saatler bu saat dilimine göre değerlendirilir. Sunucu UTC&apos;de çalışır.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Çalışma Saatleri</CardTitle>
            <CardDescription>
              Ekip yalnız bu aralıklarda &quot;Çevrimiçi&quot; görünür. Kapalı saatlerde ziyaretçi mesajını
              bırakabilir; mesaj gelen kutusuna düşer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {DISPLAY_ORDER.map((day) => (
              <div key={day} className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr_1fr] sm:items-end">
                <FormField
                  control={form.control}
                  name={`schedule.${day}.enabled`}
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={(c) => field.onChange(c)} />
                        </FormControl>
                        <FormLabel className="cursor-pointer">{DAY_LABELS[day]}</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`schedule.${day}.start`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Başlangıç</FormLabel>
                      <FormControl>
                        <Input {...field} type="time" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`schedule.${day}.end`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Bitiş</FormLabel>
                      <FormControl>
                        <Input {...field} type="time" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ))}

            <FormField
              control={form.control}
              name="holidays"
              render={({ field }) => (
                <FormItem className="pt-2">
                  <FormLabel>Kapalı Günler</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="2026-01-01, 2026-04-23, 2026-05-19" />
                  </FormControl>
                  <FormDescription>
                    Virgülle ayrılmış YYYY-MM-DD listesi. Bu günlerde çalışma saati ne olursa olsun kapalıyız.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Otomatik Mesajlar</CardTitle>
            <CardDescription>Ziyaretçi sohbeti başlattığında ilk gördüğü metinler.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="greeting"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Çevrimiçi Karşılama</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="offlineMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Çevrimdışı Mesajı</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="responseNote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dönüş Süresi Notu</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Genelde birkaç dakika içinde yanıtlıyoruz" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Ayarları Kaydet
          </Button>
          {!enabled && (
            <p className="text-xs text-muted-foreground">Widget kapalı — kaydettiğinizde de kapalı kalır.</p>
          )}
        </div>
      </form>
    </Form>
  )
}
