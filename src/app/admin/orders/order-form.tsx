"use client"

import { useEffect, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button as UIButton } from "@/components/ui/button"
import { Trash2, Plus } from "lucide-react"
import { createBakimxOrderSchema } from "@/lib/validations/bakimx-order"
import { z } from "zod"
import { formatKurus } from "@/lib/currency"
import { useToast } from "@/hooks/use-toast"

interface Product {
  id: string
  name: string
  sku: string
  workshopPriceKurus: number
}

interface Workshop {
  id: string
  name: string
}

interface OrderFormProps {
  products: Product[]
  workshops: Workshop[]
  onSubmit: (data: any) => Promise<any>
  defaultValues?: any
}

type FormData = z.infer<typeof createBakimxOrderSchema>

export default function OrderForm({
  products,
  workshops,
  onSubmit,
  defaultValues
}: OrderFormProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [total, setTotal] = useState(0)

  const form = useForm<FormData>({
    resolver: zodResolver(createBakimxOrderSchema),
    defaultValues: defaultValues || {
      workshopId: "",
      items: [{ productId: "", quantity: 1 }],
      notes: ""
    }
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  })

  const items = form.watch("items")

  useEffect(() => {
    let sum = 0
    items.forEach((item) => {
      const product = products.find((p) => p.id === item.productId)
      const price = item.unit_price_kurus || product?.workshopPriceKurus || 0
      sum += price * (item.quantity || 0)
    })
    setTotal(sum)
  }, [items, products])

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
    } catch (error) {
      toast({
        title: "Hata",
        description: error instanceof Error ? error.message : "Sipariş oluşturulamadı",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="workshopId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Atölye *</FormLabel>
              <Select value={field.value || ""} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Atölye seçin" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {workshops.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Ürünler</h3>
            <UIButton
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => append({ productId: "", quantity: 1 })}
            >
              <Plus className="h-4 w-4" />
              Ürün Ekle
            </UIButton>
          </div>

          {fields.map((field, index) => (
            <Card key={field.id}>
              <CardContent className="pt-6 space-y-4">
                <FormField
                  control={form.control}
                  name={`items.${index}.productId`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ürün</FormLabel>
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Ürün seçin" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} ({p.sku})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name={`items.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Miktar</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`items.${index}.unit_price_kurus`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fiyat (isteğe bağlı)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="Otomatik"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          {(() => {
                            const product = products.find(
                              (p) => p.id === form.watch(`items.${index}.productId`)
                            )
                            return product
                              ? `Varsayılan: ${formatKurus(product.workshopPriceKurus)}`
                              : ""
                          })()}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-end">
                    <UIButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      className="w-full gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </UIButton>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="bg-muted p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Toplam:</span>
            <span className="text-2xl font-bold">{formatKurus(total)}</span>
          </div>
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notlar</FormLabel>
              <FormControl>
                <Textarea placeholder="İç notlar ekleyin..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : "Sipariş Oluştur"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
