"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { Loader2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { typedResolver } from "@/lib/validations/resolver"
import { ADMIN_ROLES, ADMIN_ROLE_DESCRIPTIONS, ADMIN_ROLE_LABELS } from "@/lib/admin-roles"
import {
  addPlatformAdminSchema,
  type AddPlatformAdminValues,
} from "@/lib/validations/platform-admin"
import { addPlatformAdmin } from "@/app/admin/admins/actions"

/**
 * Var olan bir kullanıcıyı platform yöneticisi yapar (BAK-93).
 *
 * Bilerek yeni HESAP açmaz: platform yöneticisi de normal bir `User` satırıdır ve
 * hesabın nasıl açıldığı (davet/kayıt) ayrı bir akıştır. Buradaki iş yalnız
 * "bu kişiye konsol erişimi ver".
 */
export function AddPlatformAdminForm() {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const form = useForm<AddPlatformAdminValues, unknown, AddPlatformAdminValues>({
    resolver: typedResolver(addPlatformAdminSchema),
    defaultValues: { email: "", role: "readonly" },
  })

  function onSubmit(values: AddPlatformAdminValues) {
    setServerError("")
    setSuccessMessage("")

    startTransition(async () => {
      const result = await addPlatformAdmin(values)
      if (!result.ok) {
        setServerError(result.error)
        toast.error(result.error)
        return
      }
      const message = `${values.email} yönetici olarak eklendi.`
      setSuccessMessage(message)
      toast.success(message)
      form.reset({ email: "", role: "readonly" })
    })
  }

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-3 sm:flex-row sm:items-start"
          noValidate
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Kullanıcı e-postası</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    placeholder="ad.soyad@bakimx.com"
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem className="sm:w-56">
                <FormLabel>Rol</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(v) => v && field.onChange(v)}
                  disabled={isPending}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ADMIN_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        <span className="flex flex-col items-start">
                          <span>{ADMIN_ROLE_LABELS[r]}</span>
                          <span className="text-xs text-muted-foreground">
                            {ADMIN_ROLE_DESCRIPTIONS[r]}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isPending} className="sm:mt-6">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Ekle
          </Button>
        </form>
      </Form>

      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      {successMessage && (
        <p className="text-sm text-success-strong">{successMessage}</p>
      )}
    </div>
  )
}
