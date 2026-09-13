import { z } from "zod";

export const demoRequestSchema = z.object({
  name: z.string().trim().min(2, "Ad Soyad en az 2 karakter olmalıdır"),
  businessName: z
    .string()
    .trim()
    .min(2, "İşletme adı en az 2 karakter olmalıdır"),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,15}$/, "Geçerli bir telefon numarası girin"),
  city: z.string().min(1, "Şehir seçimi gerekli"),
  monthlyVehicles: z.string().min(1, "Aylık araç adedi gerekli"),
  notes: z.string(),
});
