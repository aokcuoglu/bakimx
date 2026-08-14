/**
 * `getCurrentUser()` iki farklı olayı ayırt etmek zorundadır:
 *
 *   "kimlik çözülemedi"  → oturum yok say (çıkışa yolla)
 *   "altyapı çökük"      → hatayı yukarı bırak (hata sınırı 503 gösterir)
 *
 * Eskiden ikisi de `catch { return null }` ile "oturum yok"a düşüyordu. Sonucu:
 * saniyelik bir DB kesintisi, o an sitede olan HERKESİ çıkışa yolluyordu.
 *
 * Bu dosya prisma/session modüllerini izole eder; bu yüzden ayrı bir test
 * dosyasındadır (mock'lar dosya kapsamında kalsın).
 */
import { test, expect, mock } from "bun:test"

mock.module("@/lib/session", () => ({
  getSession: async () => ({ userId: "user-1" }),
  getActiveImpersonation: async () => null,
}))

test("DB erişilemezse hata yutulmaz, yukarı fırlar", async () => {
  mock.module("@/lib/db", () => ({
    prisma: {
      user: {
        findUnique: async () => {
          throw new Error("Can't reach database server at localhost:5432")
        },
      },
    },
  }))

  const { getCurrentUser } = await import("./auth")
  await expect(getCurrentUser()).rejects.toThrow(/reach database server/)
})

test("kullanıcı gerçekten yoksa null döner (çıkış akışı)", async () => {
  mock.module("@/lib/db", () => ({
    prisma: { user: { findUnique: async () => null } },
  }))

  const { getCurrentUser } = await import("./auth")
  expect(await getCurrentUser()).toBeNull()
})
