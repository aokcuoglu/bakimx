import { prisma } from "@/lib/db"

/**
 * Destek talebini kiracıya bağlama kuralı (BAK-98).
 *
 * Tek aday varsa bağla, yoksa NULL bırak. Birden çok aday çıktığında BİLİNÇLİ
 * olarak bağlamıyoruz: yanlış kiracıya bağlanmış bir şikayet, destek personelini
 * yanlış hesapta arattırır ve hatayı fark etmesi zordur; bağsız kayıt ise
 * konsolda zaten "bağla" düğmesiyle karşılar.
 */
export function pickUniqueWorkshopId(candidates: Array<string | null | undefined>): string | null {
  const unique = [...new Set(candidates.filter((id): id is string => Boolean(id)))]
  return unique.length === 1 ? unique[0] : null
}

/** Aday sayısını ayırt etmek için yeterli; tam listeye ihtiyaç yok. */
const CANDIDATE_TAKE = 5

/**
 * Public destek formundaki e-postayı bir atölyeye çözer. İki kaynağa bakar:
 * iş yerinin iletişim e-postası ve kullanıcı hesapları. İkisi de AYNI atölyeyi
 * gösteriyorsa bu tek adaydır (Set ile tekilleştirilir).
 */
export async function resolveWorkshopIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null

  const [workshops, users] = await Promise.all([
    prisma.workshop.findMany({
      where: { email: { equals: normalized, mode: "insensitive" } },
      select: { id: true },
      take: CANDIDATE_TAKE,
    }),
    prisma.user.findMany({
      where: { email: { equals: normalized, mode: "insensitive" } },
      select: { workshopId: true },
      take: CANDIDATE_TAKE,
    }),
  ])

  return pickUniqueWorkshopId([...workshops.map((w) => w.id), ...users.map((u) => u.workshopId)])
}
