/**
 * Soft-delete edilmiş fotoğrafları gizleyen ortak Prisma filtresi.
 *
 * Fotoğraf OKUYAN her sorgu bunu kullanmak zorunda: aksi halde kullanıcının
 * sildiği kare galeride, PDF'te, araç pasaportunda ya da müşteriyle paylaşılan
 * public sayfada geri görünür ve TypeScript bunu yakalayamaz. `deletedAt` alanı
 * opsiyonel olduğu için filtrenin unutulması sessiz bir sızıntıdır — bu yüzden
 * `photo-visibility.test.ts` kaynak taramasıyla filtreyi zorunlu kılar.
 *
 * Kullanım:
 *   photos: { where: VISIBLE_PHOTO, ... }
 *   photos: { where: { serviceOrderItemId: null, ...VISIBLE_PHOTO }, ... }
 */
export const VISIBLE_PHOTO = { deletedAt: null } as const
