/**
 * BakımX service worker — BAK-129 (Faz B, Web Push).
 *
 * KAPSAM BİLİNÇLİ OLARAK DAR: burada `fetch` dinleyicisi YOKTUR. Bir offline
 * cache katmanı eklemek uygulamanın tüm ağ trafiğini bu dosyadan geçirir ve
 * dağıtım sonrası bayat chunk sorunlarını (bkz. docs deploy notları) geri
 * getirir. Bu worker yalnız iki şey yapar: push mesajını göstermek ve
 * tıklandığında ilgili iş emrini açmak.
 */

self.addEventListener("install", () => {
  // Yeni sürüm beklemesin: worker'ın davranışı sürümler arası uyumlu (yalnız
  // bildirim), bekleyen bir istemciyi bozacak bir durum yok.
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }

  const title = payload.title || "BakımX"
  const options = {
    body: payload.body || "",
    // Marka ikonu; kök PNG'ler middleware'den muaf (bkz. middleware matcher).
    icon: "/03-bakimx-icon-light.png",
    badge: "/03-bakimx-icon-light.png",
    tag: payload.tag || "bakimx",
    // Aynı tag ile gelen bildirim öncekinin yerini alır; kullanıcı yine uyarılsın.
    renotify: Boolean(payload.tag),
    data: { url: payload.url || "/technician" },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || "/technician", self.location.origin)

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Açık bir sekme varsa yenisini açma — teknisyenin elindeki oturuma dön.
      for (const client of clientList) {
        if (new URL(client.url).origin === target.origin && "focus" in client) {
          return client.focus().then(() => ("navigate" in client ? client.navigate(target.href) : undefined))
        }
      }
      return self.clients.openWindow(target.href)
    }),
  )
})
