"use client"

import { useState } from "react"
import Link from "next/link"
import { Users, Search, Phone, Mail, UserPlus } from "lucide-react"
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
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Ad, soyad veya telefon ile arayın..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 text-base"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="size-14 mx-auto mb-4 opacity-20" />
          <p className="text-base font-medium">
            {search ? "Aramanızla eşleşen müşteri bulunamadı" : "Henüz müşteri kaydı yok"}
          </p>
          <p className="text-sm mt-1">
            {search ? "Farklı bir arama deneyin" : ""}
          </p>
          <Link href="/app/customers/new" className="inline-flex items-center gap-1.5 text-primary hover:underline text-sm mt-3">
            <UserPlus className="size-4" />
            İlk müşterinizi ekleyin
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {search && (
            <p className="text-xs text-muted-foreground px-1">
              {filtered.length} müşteri bulundu
            </p>
          )}
          {filtered.map((customer) => (
            <Link
              key={customer.id}
              href={`/app/customers/${customer.id}`}
              className="flex items-center justify-between p-4 bg-card border rounded-xl hover:bg-muted/50 transition-colors active:bg-muted/70 touch-manipulation"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">
                  {customer.firstName} {customer.lastName}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
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
              {customer._count != null && customer._count.vehicles > 0 && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full shrink-0 ml-2">
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
