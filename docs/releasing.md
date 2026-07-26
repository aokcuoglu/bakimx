# Dallanma, deploy ve sürüm çıkarma

İki uzun ömürlü dal, iki ortam, tamamen otomatik deploy. Ortamlar **ayrı AWS
hesaplarında**, veritabanları izole — dev asla prod verisine dokunmaz.

```
feature/* ──PR──► dev ──(push)──► 🚀 app-dev.bakimx.com   (AWS ECS, dev'e her push)
                   │
                   └──PR──► main ──(merge)──► 🚀 app.bakimx.com  (AWS ECS, main'e her push)
```

| Dal | Amaç | Deploy hedefi | Tetik |
|---|---|---|---|
| `dev` | Entegrasyon / QA | app-dev.bakimx.com | push → [`deploy-dev-aws.yml`](../.github/workflows/deploy-dev-aws.yml) |
| `main` | Production (korumalı, yalnız PR) | app.bakimx.com | push → [`deploy-prod-aws.yml`](../.github/workflows/deploy-prod-aws.yml) |
| `feature/*` | Tek bir devam eden değişiklik | — | `dev`'e PR aç |

`sync-main-to-dev.yml` her `main` merge'ünü `dev`'e geri oynatır, böylece dev
"main'in N commit gerisinde" görünmez (normal durumda içerik-nötr).

> **`main`'e merge = prod'a ship.** 2026-07-26'dan beri `deploy-prod-aws.yml`
> `main`'e her push'ta çalışıyor, yani dev→main PR merge'ü **sürüm düğmesidir**.
> Merge sonrası ayrıca dispatch atmayın — çift deploy olur.
>
> **Tag deploy ETMEZ.** `vX.Y.Z` tag push'u yalnız `release.yml`'i tetikler; o da
> GitHub Release'i `docs/releases/<tag>.md`'den oluşturur.

`main` branch-protected: doğrudan push yok. "main'e merge = prod'a ship"i güvenli
kılan şey bu — dev ondan önceki kapı.

---

## Günlük akış

1. `dev`'den dallan: `git switch dev && git pull && git switch -c feature/x`
2. Geliştir, commit'le, **`dev`'e PR** aç.
3. `dev`'e merge → app-dev otomatik deploy olur. **app-dev.bakimx.com'da doğrula.**
4. İyi görünüyorsa **`dev` → `main` PR**'ı aç.
5. `main`'e merge → prod otomatik deploy olur.

---

## Sürüm çıkarma

1. Biten `feature/*` PR'larını `dev`'e merge et.
2. **app-dev** deploy'unun yeşile dönmesini bekle, sonra
   https://app-dev.bakimx.com'u duman testinden geçir — DB'ye dokunan her şey
   dahil (migration'lar uygulama yeniden başlamadan önce dev DB'sine uygulanır).
3. `package.json`'daki sürümü **`dev` üzerinde** yükselt, `docs/releases/vX.Y.Z.md`
   yaz (`release.yml` bu dosyayı Release gövdesi olarak birebir kullanır) ve
   `CHANGELOG.md`'ye ekle.
4. `dev → main` PR'ı aç, tam sürüm diff'ini gözden geçir.
5. `main`'e merge et. **Prod deploy'u burada başlar** (~11–12 dk): build → yeni
   task-def → **migration kapısı** → araç katalogu seed'i (bloklamayan) → ECS
   servis güncellemesi → yeni task-def'e yakınsadığının doğrulanması.
   Merge'den önce prod runtime env'inde `APP_URL`, `RESEND_*` ve `ADMIN_EMAILS`
   dolu mu kontrol et.
6. İzle: GitHub Actions → **"Deploy to AWS prod"** veya
   `gh run watch <id> --exit-status`. Yeşile dönünce https://app.bakimx.com'u
   duman testinden geçir.
7. `main`'deki merge commit'ini tag'le ve push'la:
   `git tag vX.Y.Z && git push origin vX.Y.Z`. Bu yalnız GitHub Release oluşturur,
   deploy etmez.

### Hotfix

Acil prod düzeltmesi için: `main`'den dallan, `main`'e PR aç, merge et — merge
deploy eder. Sonra tag'le. Mümkün olan her durumda yine de önce app-dev görsün.

---

## Her deploy ne yapıyor

**dev → AWS** (`deploy-dev-aws.yml`) ve **main → AWS prod** (`deploy-prod-aws.yml`)
aynı akışı izler:

GitHub OIDC → arm64 image build → ECR'ye push → yeni ECS task-def revizyonu
(image swap) → **DB migration kapısı** (tek seferlik `ecs run-task` içinde
`prisma migrate deploy`; başarısızlıkta deploy iptal) → `update-service` →
rollout'un yeni task-def'e yakınsadığının assert'i (circuit-breaker rollback'inde
fail).

Prod, ayrı bir AWS hesabında (`075550799591`) `bakimx-prod-cluster` /
`bakimx-prod-app-svc` üzerinde çalışır. Salt-doküman commit'leri `paths-ignore`
ile atlanır; `workflow_dispatch` elle yeniden çalıştırma için durur.

Ayrıntı: [deployment/aws-dev.md](./deployment/aws-dev.md) ·
[deployment/aws-prod.md](./deployment/aws-prod.md)

---

## Migration'lar

Her iki workflow da servisi güncellemeden **önce** `prisma migrate deploy`
(idempotent) çalıştırır. Elle migration çalıştırmanız **gerekmez**. Ayrıntı:
[database.md](./database.md).

Boş bir app-dev'de geçen yıkıcı bir migration prod verisinde yine de patlayabilir
— yıkıcı migration'ları elle review edin, yüksek riskli olanlar için app-dev'i
temizlenmiş bir prod anlık görüntüsüyle beslemeyi düşünün.

---

## Image'lar & rollback

- **dev:** ECR `bakimx/app`, tag'ler `dev` + `sha-<commit>`.
- **prod:** ECR `bakimx/app` (hesap `075550799591`), aynı etiketleme.
- **Rollback (her iki ortam):** ECS servisini son-iyi task-def revizyonuna
  yönelt — her revizyon sabitlenmiş bir `sha-…` image taşır:
  `aws ecs update-service --task-definition …`
- Sürüm tag'leri (`vX.Y.Z`) yalnız kayıt amaçlıdır; deploy tetiklemez.

---

## Admin konsolu erişimi

`/admin`, ortam başına `ADMIN_EMAILS` env değişkeniyle (virgülle ayrılmış)
kapılıdır — AWS'te task-def env / Secrets üzerinden. Ayarlı değilse `/admin`
herkese 404 döner. Genel demo hesabını **asla** `ADMIN_EMAILS`'e koymayın.
