/**
 * Prisma hatalarının HANGİ alanda olduğunu güvenilir biçimde okur.
 *
 * `P2002` (unique ihlali) yakalayıp "bu kullanıcı adı alınmış" / "kodu yeniden
 * dene" gibi kararlar veren her yer bu bilgiye bakıyor — ama Prisma onu tek bir
 * yerde tutmuyor. Sürücü adaptörü (driver adapter) kullanan istemcide
 * `meta.target` BOŞ gelir, kısıt bilgisi
 * `meta.driverAdapterError.cause.constraint` altına iner:
 *
 *   { code: "P2002",
 *     meta: { modelName: "User",
 *             driverAdapterError: { cause: {
 *               originalMessage: 'duplicate key ... "User_workshopId_username_key"',
 *               constraint: { fields: ['"workshopId"', "username"] } } } } }
 *
 * Yalnız `meta.target`'a bakan bir kontrol bu istemcide SESSİZCE hep `false`
 * döner: çakışma yakalanmaz, kullanıcı ham Prisma metnini görür ve iş yeri kodu
 * yeniden deneme döngüsü hiç çalışmaz. Bu yüzden kontrol tek yerde durur ve her
 * iki şekli de (artı son çare olarak hata metnini) tarar.
 *
 * Saf modül — prisma import etmez, testlerden de çağrılabilir.
 */

type UniqueErrorShape = {
  code?: string
  meta?: {
    target?: string[] | string
    driverAdapterError?: {
      cause?: {
        originalMessage?: string
        constraint?: { fields?: string[]; index?: string } | string
      }
    }
  }
}

/** Kısıt bilgisini taşıyabilecek tüm alanları tek bir aranabilir metne indirger. */
function constraintHaystack(error: unknown): string {
  const e = error as UniqueErrorShape
  const parts: string[] = []

  const target = e?.meta?.target
  if (Array.isArray(target)) parts.push(target.join(","))
  else if (target) parts.push(String(target))

  const cause = e?.meta?.driverAdapterError?.cause
  if (cause) {
    const constraint = cause.constraint
    if (typeof constraint === "string") parts.push(constraint)
    else if (constraint) {
      if (Array.isArray(constraint.fields)) parts.push(constraint.fields.join(","))
      if (constraint.index) parts.push(constraint.index)
    }
    if (cause.originalMessage) parts.push(cause.originalMessage)
  }

  return parts.join("|").toLowerCase()
}

/**
 * Hata, `field` alanındaki bir benzersizlik ihlali mi?
 *
 * `field` karşılaştırması küçük harf üzerinden yapılır; hem alan adı
 * (`username`) hem de kısıt adı (`User_workshopId_username_key`) eşleşir.
 */
export function isUniqueConstraintError(error: unknown, field: string): boolean {
  if ((error as UniqueErrorShape)?.code !== "P2002") return false
  return constraintHaystack(error).includes(field.toLowerCase())
}
