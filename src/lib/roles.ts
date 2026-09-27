import type { UserRole } from "@prisma/client"

/**
 * Pure role constants — safe to import from client components (no prisma/server
 * deps). The server-only RBAC guards live in `@/lib/rbac` and re-export these.
 *
 * #183 — roller atölye hiyerarşisine göre genişletildi. İzinler TEK eksende,
 * `User.role` üzerinde durur: `Technician.role` personel kaydının unvanıdır ve
 * giriş hesabı olmayabilir, yetki kaynağı olamaz.
 */

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Yönetici",
  manager: "Servis Danışmanı",
  usta: "Usta",
  cirak: "Çırak",
  staff: "Personel (eski)",
}

/** Rol seçiminde gösterilen tek cümlelik özet. */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: "Her şeyi yapabilir; kapalı iş emrini yeniden açabilir.",
  manager: "Tüm operasyonlar ve ekip yönetimi.",
  usta: "İş emrini düzenler ve ilerletir.",
  cirak: "İş emri, teklif, randevu ve hatırlatma oluşturur; parça alır, maliyet girer.",
  staff: "Eski kayıt — Usta ile aynı yetkilere sahiptir.",
}

/**
 * Sıralama YALNIZ rol atamada kullanılır ("kendinden yükseğini atayamazsın").
 * İzin kararı için KULLANILMAZ — onun için `ROLE_PERMISSIONS` var. İkisini
 * karıştırmak, sırada yüksek görünen bir role istenmeyen izin verir.
 *
 * `staff` bilerek `usta` ile aynı seviyede: #183 öncesi kayıtlar yetki
 * kaybetmesin.
 */
export const ROLE_RANK: Record<UserRole, number> = {
  owner: 4,
  manager: 3,
  usta: 2,
  staff: 2,
  cirak: 1,
}

/**
 * İzin adları. Kapı koyarken eylem değil YETENEK adı kullanılır — aynı yetenek
 * birden çok action'da geçebilir ve matris tek yerde okunabilir kalır.
 */
export const PERMISSIONS = [
  "team.manage",
  "billing.manage",
  /** Atölye profili, bildirim ve takvim ayarları. */
  "settings.manage",
  /** Müşteri, araç, randevu, teklif, hatırlatma kayıtları. */
  "records.manage",
  /** Yalnız oluşturma: iş emri/kabul, teklif, randevu, hatırlatma, müşteri/araç. */
  "records.create",
  /** İş emri / kabul metinlerini ve kalemlerini düzenleme. */
  "order.edit",
  /** Durum ilerletme (tamire başla, tamamla, teslim et…). */
  "order.status",
  /** Teslim edilmiş iş emrini yeniden açma. */
  "order.reopen",
  /** Dış alım, parça talebi, maliyet girme. */
  "parts.purchase",
  /** Stok/işçilik kataloğu ve tedarikçi yönetimi. */
  "catalog.manage",
  /** Tahsilat ve kasa işlemleri. */
  "cashbox.manage",
] as const

export type Permission = (typeof PERMISSIONS)[number]

export const PERMISSION_LABELS: Record<Permission, { label: string; hint: string }> = {
  "team.manage": { label: "Ekip yönetimi", hint: "Üye, davet ve ekip izinlerini düzenler." },
  "billing.manage": { label: "Faturalandırma", hint: "Paket ve ödeme ayarlarını görür." },
  "settings.manage": { label: "Atölye ayarları", hint: "Profil, bildirim ve takvim ayarları." },
  "records.manage": { label: "Kayıt düzenleme", hint: "Müşteri, araç, randevu, teklif ve hatırlatma." },
  "records.create": { label: "Kayıt oluşturma", hint: "İş emri, kabul, teklif, randevu ve hatırlatma açar." },
  "order.edit": { label: "İş emri düzenleme", hint: "İş emri metni ve kalemleri." },
  "order.status": { label: "İş emri ilerletme", hint: "Tamire başlama, tamamlama, teslim." },
  "order.reopen": { label: "Kapalı iş emrini açma", hint: "Teslim edilmiş iş emrini yeniden açar." },
  "parts.purchase": { label: "Dış parça alma", hint: "Parça talebi, dış alım ve maliyet girişi." },
  "catalog.manage": { label: "Katalog ve tedarikçi", hint: "Stok, işçilik kataloğu, tedarikçiler." },
  "cashbox.manage": { label: "Kasa", hint: "Tahsilat ve kasa hareketleri." },
}

export const PERMISSION_GROUPS: { title: string; permissions: readonly Permission[] }[] = [
  { title: "Ekip ve ayarlar", permissions: ["team.manage", "settings.manage", "billing.manage"] },
  { title: "Kayıtlar", permissions: ["records.manage", "records.create"] },
  { title: "İş emri", permissions: ["order.edit", "order.status", "order.reopen"] },
  { title: "Parça ve stok", permissions: ["parts.purchase", "catalog.manage"] },
  { title: "Kasa", permissions: ["cashbox.manage"] },
]

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value)
}

export function parsePermissions(values: readonly string[]): Permission[] {
  return values.filter(isPermission)
}

/**
 * Etkin yetki. Sahip her zaman tam yetkilidir. Ekip atanmışsa listedeki kutular
 * geçerlidir; ekip yoksa statik rol matrisi (mevcut atölyeler) geçerlidir.
 */
export function actorCan(
  actor: { role: UserRole; teamPermissions?: readonly string[] | null },
  permission: Permission,
): boolean {
  if (actor.role === "owner") return true
  if (actor.teamPermissions) return actor.teamPermissions.includes(permission)
  return roleCan(actor.role, permission)
}

/**
 * Rol → izin matrisi. Tek doğruluk kaynağı; hem sunucu kapıları hem UI bunu okur.
 *
 * Çırak `records.create` + `parts.purchase` taşır: kayıt oluşturabilir ve
 * "araca göre parça alır, maliyetini girer". İş emrini düzenlemesi ya da durum
 * ilerletmesi beklenmez — o kapılar `order.edit`/`order.status`'ta kalır.
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  owner: [...PERMISSIONS],
  manager: [
    "team.manage",
    "settings.manage",
    "records.manage",
    "records.create",
    "order.edit",
    "order.status",
    "parts.purchase",
    "catalog.manage",
    "cashbox.manage",
  ],
  usta: ["records.manage", "records.create", "order.edit", "order.status", "parts.purchase"],
  staff: ["records.manage", "records.create", "order.edit", "order.status", "parts.purchase"],
  cirak: ["records.create", "parts.purchase"],
}

export function roleCan(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

/**
 * Atanabilir roller (düşük → yüksek). `staff` LİSTEDE YOKTUR: yeni kimseye eski
 * rol verilmesin, ama mevcut kayıtlar olduğu gibi çalışmaya devam etsin.
 */
export const ASSIGNABLE_ROLES: UserRole[] = ["cirak", "usta", "manager", "owner"]

/** Roles an actor of `role` may assign (never above their own rank). */
export function rolesUpTo(role: UserRole): UserRole[] {
  return ASSIGNABLE_ROLES.filter((r) => ROLE_RANK[r] <= ROLE_RANK[role])
}

/**
 * E-posta zorunlu roller (BAK-40). Fatura, şifre sıfırlama ve sistem bildirimleri
 * bu kişilere gider; kullanıcı adıyla açılmış bir hesabın e-posta eklenmeden
 * buraya terfi etmesi, atölyeyi kurtarılamaz bir yönetici hesabıyla bırakır.
 *
 * Aynı kural migration'da DB CHECK kısıtı olarak da duruyor — bu liste onun
 * uygulama tarafındaki, kullanıcıya anlamlı hata verebilen ikizi.
 */
export const ROLES_REQUIRING_EMAIL: readonly UserRole[] = ["owner", "manager"]

export function roleRequiresEmail(role: UserRole): boolean {
  return ROLES_REQUIRING_EMAIL.includes(role)
}
