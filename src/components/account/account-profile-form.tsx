"use client"

import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { updateOwnProfileAction } from "@/app/(app)/account/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

const schema = z.object({
  firstName: z.string().min(1, "Ad gerekli").max(50),
  lastName: z.string().min(1, "Soyad gerekli").max(50),
})

type FormValues = z.infer<typeof schema>

export function AccountProfileForm({
  firstName,
  lastName,
}: {
  firstName: string
  lastName: string
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { firstName, lastName },
  })

  async function onSubmit(values: FormValues) {
    const fd = new FormData()
    fd.set("firstName", values.firstName)
    fd.set("lastName", values.lastName)
    const result = await updateOwnProfileAction(fd)
    if (result.ok) {
      toast.success("Profil güncellendi")
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ad</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
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
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button
          type="submit"
          disabled={form.formState.isSubmitting || !form.formState.isDirty}
        >
          {form.formState.isSubmitting ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </form>
    </Form>
  )
}
