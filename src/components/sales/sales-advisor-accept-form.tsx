"use client"

import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, Lock } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { acceptSalesAdvisorInvite } from "@/app/invite/sales/[token]/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  salesAdvisorAcceptSchema,
  type SalesAdvisorAcceptValues,
} from "@/lib/validations/sales-advisor"

export function SalesAdvisorAcceptForm({
  token,
  name,
  email,
}: {
  token: string
  name: string
  email: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const form = useForm<SalesAdvisorAcceptValues>({
    resolver: zodResolver(salesAdvisorAcceptSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  function submit(values: SalesAdvisorAcceptValues) {
    setError("")
    startTransition(async () => {
      const result = await acceptSalesAdvisorInvite(token, values)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push("/login?advisorInvited=1")
    })
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Satış hesabınızı oluşturun</h1>
        <p className="mt-2 text-sm text-muted-foreground">Merhaba {name}. BakımX Satış Paneli için şifrenizi belirleyin.</p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <FormItem>
            <FormLabel>E-posta</FormLabel>
            <FormControl><Input value={email} readOnly disabled /></FormControl>
          </FormItem>
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Şifre</FormLabel>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <FormControl><Input type={showPassword ? "text" : "password"} autoComplete="new-password" className="pl-9 pr-10" {...field} /></FormControl>
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-1/2 -translate-y-1/2" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}>
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Şifre (tekrar)</FormLabel>
                <FormControl><Input type={showPassword ? "text" : "password"} autoComplete="new-password" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="xl" className="w-full" disabled={pending}>
            {pending ? "Hesap oluşturuluyor…" : "Hesabımı oluştur"}
          </Button>
        </form>
      </Form>
    </div>
  )
}
