"use client"

import { useState } from "react"
import Link from "next/link"
import { Users, Search, Phone, Mail } from "lucide-react"
import { Input } from "@/components/ui/input"

type Customer = {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string | null
  createdAt: Date
  _count?: { vehicles: number }
}

export function CustomerList({ customers: initialCustomers }: { customers: Customer[] }) {
  const [search, setSearch] = useState("")

  const filtered = search
    ? initialCustomers.filter(
        (c) =>
          c.firstName.toLowerCase().includes(search.toLowerCase()) ||
          c.lastName.toLowerCase().includes(search.toLowerCase()) ||
          c.phone.includes(search)
      )
    : initialCustomers

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Müşteri ara (ad, soyad, telefon)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="size-12 mx-auto mb-3 opacity-30" />
          <p>Müşteri bulunamadı</p>
          <Link href="/app/customers/new" className="text-primary hover:underline text-sm mt-1 block">
            İlk müşterinizi ekleyin
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((customer) => (
            <Link
              key={customer.id}
              href={`/app/customers/${customer.id}`}
              className="flex items-center justify-between p-3 bg-card border rounded-xl hover:bg-muted/50 transition-colors"
            >
              <div>
                <p className="font-medium">
                  {customer.firstName} {customer.lastName}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="size-3" />
                    {customer.phone}
                  </span>
                  {customer.email && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="size-3" />
                      {customer.email}
                    </span>
                  )}
                </div>
              </div>
              {customer._count && (
                <span className="text-xs text-muted-foreground">
                  {customer._count.vehicles} araç
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}