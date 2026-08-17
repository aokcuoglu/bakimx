# Dallanma, deploy ve sürüm çıkarma

İki uzun ömürlü dal, iki ortam, tamamen otomatik deploy. Ortamlar **ayrı AWS
hesaplarında**, veritabanları izole — dev asla prod verisine dokunmaz.

```
feature/* ──PR──► dev ──[deploy-dev]──► 🚀 app-dev.bakimx.com   (AWS ECS, İSTEĞE BAĞLI)
                   │
                   └──PR──► main ──(merge)──► 🚀 app.bakimx.com  (AWS ECS, main'e her push)
```

| Dal | Amaç | Deploy hedefi | Tetik |
|---|---|---|---|
| `dev` | Entegrasyon / QA | app-dev.bakimx.com | commit mesajında `[deploy-dev]` **veya** elle dispatch → [`deploy-dev-aws.yml`](../.github/workflows/deploy-dev-aws.yml) |
| `main` | Production (korumalı, yalnız PR) | app.bakimx.com | push → [`deploy-prod-aws.yml`](../.github/workflows/deploy-prod-aws.yml) |
| `feature/*` | Tek bir devam eden değişiklik | — | `dev`'e PR aç |

> **`dev`'e merge artık kendiliğinden deploy ETMEZ** (2026-08-17, BAK-90). app-dev'e
> çıkması gereken merge'lerde squash mesajına `[deploy-dev]` yaz; işaretçi yoksa tüm
> job'lar `skipped` olur ve **0 dakika** faturalanır. Elle çalıştırma her zaman deploy
> eder: Actions → *Deploy to AWS dev* → Run workflow.
>
> **Migration içeren merge'de işaretçi ZORUNLU** — dev DB'sine `migrate deploy` yalnız
> bu deploy'un içinde koşar ([database.md](./database.md)). İşaretçisiz merge edilirse
> app-dev şema olarak geride kalır.

`sync-main-to-dev.yml` her `main` merge'ünü `dev`'e geri oynatır, böylece dev
"main'in N commit gerisinde" görünmez (normal durumda içerik-nötr).

> **`main`'e merge = prod'a ship.** 2026-07-26'dan beri `deploy-prod-aws.yml`
> `main`'e her push'ta çalışıyor, yani dev→main PR merge'ü **sürüm düğmesidir**.
> Merge sonrası ayrıca dispatch atmayın — çift deploy olur.
>
> **Tag deploy ETMEZ.** `vX.Y.Z` tag push'u yalnız `release.yml`'i tetikler; o da
> GitHub Release'i `docs/releases/<tag>.md`'den oluşturur.

> **Branch protection VAR** (2026-08-17, BAK-89 — GitHub Pro alındıktan sonra
> açıldı; öncesinde API `403` dönüyordu):
>
> | | `main` | `dev` |
> |---|---|---|
> | Silme | ❌ engelli (admin dahil) | ❌ engelli (admin dahil) |
> | Force push | ❌ engelli (admin dahil) | ❌ engelli (admin dahil) |
> | PR zorunlu | ✅ (0 onay) | — açık bırakıldı |
> | `quality` check zorunlu | ✅ | — |
> | Dalın güncel olması (`strict`) | ✅ açık | — |
> | Admin bypass (`enforce_admins`) | ❌ kapalı | ❌ kapalı |
>
> **`main`'e doğrudan push artık mümkün değil** — admin dahil. Hotfix akışı
> değişmedi: aşağıdaki §Hotfix zaten `main`'e **PR** açmayı tarif ediyor.
> `strict` açık olduğu için release PR'ı `main`'i tam içermeden merge edilemez.
>
> `dev`'de PR ve check **bilinçli olarak zorunlu değil**: `sync-main-to-dev.yml`
> `dev`'e doğrudan push ediyor, zorunlu kılınırsa her release sonrası o workflow
> kırılır. `dev`'e giren PR'sız bir commit'in **ship edilmesini** zaten
> `deploy-dev-aws.yml`'deki `pr-origin` kapısı engelliyor. Gerekçelerin tamamı ve
> kuralların fiilî testi:
> [agent-workflows/repo-guardrails.md](./agent-workflows/repo-guardrails.md) §2.

---

## Günlük akış

1. `dev`'den dallan: `git switch dev && git pull && git switch -c feature/x`
2. Geliştir, commit'le, **`dev`'e PR** aç.
3. `dev`'e merge. Değişikliğin **paylaşımlı ortamda** görülmesi gerekiyorsa squash
   mesajına `[deploy-dev]` ekle → app-dev deploy olur, **app-dev.bakimx.com'da
   doğrula**. Gerekmiyorsa işaretçi yazma; QA'yı izole worktree'de yap (~16 dk ve
   ~$0,09 tasarruf).
4. İyi görünüyorsa **`dev` → `main` PR**'ı aç.
5. `main`'e merge → prod otomatik deploy olur.

---

## Sürüm çıkarma

1. Biten `feature/*` PR'larını `dev`'e merge et.
2. **app-dev'i elle deploy et** (Actions → *Deploy to AWS dev* → Run workflow,
   `dev` dalı) — sürüm öncesi paylaşımlı doğrulama app-dev'in asıl işidir ve
   işaretçisiz merge'lerden sonra ortam bayat olabilir. Yeşile dönünce
   https://app-dev.bakimx.com'u duman testinden geçir — DB'ye dokunan her şey
   dahil (migration'lar uygulama yeniden başlamadan önce dev DB'sine uygulanır).
3. `package.json`'daki sürümü **`dev` üzerinde** yükselt, `docs/releases/vX.Y.Z.md`
   yaz (`release.yml` bu dosyayı Release gövdesi olarak birebir kullanır) ve
   `CHANGELOG.md`'ye ekle.
4. `dev → main` PR'ı aç, tam sürüm diff'ini gözden geçir.
5. `main`'e merge et. **Prod deploy'u burada başlar** (~11–12 dk): build → yeni
   task-def → **migration kapısı** → araç katalogu seed'i (bloklamayan) → ECS
   servis güncellemesi → yeni task-def'e yakınsadığının doğrulanması.
   Env kontrolü **her sürümde gerekmiyor**: `APP_URL`, `ADMIN_EMAILS`,
   `EMAIL_PROVIDER` ve `RESEND_*` prod task-def'inde kalıcı olarak tanımlı
   (SSM Parameter Store + Secrets Manager, `bakimx/prod/*`) ve deploy bunları
   yeniden yazmıyor. Yalnız **yeni bir env değişkeni ekleyen** sürümlerde kontrol
   et — o zaman da doğru yer task-def'in kendisi:
   `aws ecs describe-task-definition --task-definition bakimx-prod-app`.
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

`/admin` üyeliği `PlatformAdmin` tablosundadır ve konsoldan yönetilir
(`/admin/admins`) — yönetici eklemek/çıkarmak **deploy gerektirmez** (BAK-93).

`ADMIN_EMAILS` yalnız iki işi kaldı:

1. **Bootstrap** — tablo boşken (yeni ortam, prod kiracı sıfırlaması sonrası) bu
   listedeki adresler konsola girebilir ve ilk girişte tabloya `founder` olarak
   yazılır. Tablo dolduktan sonra env'in bir hükmü yoktur.
2. **Bildirim alıcısı** — yeni başvuru / canlı destek e-postaları bu adreslere
   gider. Bu kullanım değişmedi.

Ne tablo ne env doluysa `/admin` herkese 404 döner. Genel demo hesabını **asla**
`ADMIN_EMAILS`'e koymayın.
