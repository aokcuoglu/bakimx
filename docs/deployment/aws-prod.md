# AWS prod CI/CD — CDK backfill spec + cutover runbook

**Amaç.** `bakimx.com` (landing) + `app.bakimx.com` (uygulama) için AWS prod ortamı ve CI/CD. Prod, dev'den (`292398627626`) **ayrı bir AWS hesabında** (`075550799591`, multi-account izolasyon) yaşar ve altyapısı **CDK ile** kuruludur (`bakimx-prod-foundation/secrets/data/compute/cron/observability` stack'leri). Workflow: [`.github/workflows/deploy-prod-aws.yml`](../../.github/workflows/deploy-prod-aws.yml), `deploy-dev-aws.yml`'nin prod muadili.

Account `075550799591`, region `eu-central-1`. Repo `aokcuoglu/bakimx`.

Akış: OIDC ile rol üstlen → arm64 image build (ECR) → yeni task-def revizyonu (image swap + runtime env inject) → migrate gate (bir kerelik `ecs run-task`) → `update-service` → PRIMARY task-def==yeni assert.

> **Bağlam.** Prod altyapısı CDK ile hazır ve ECS servisi çalışır durumdaydı, ancak CI/CD deploy yolu (GitHub OIDC + deploy rolü) eksikti. Aşağıdaki OIDC provider + IAM rolü **AWS CLI ile** (dev'deki hibrit yaklaşımın aynısı) oluşturulur; bu doküman onların **CDK'ya taşınması (backfill)** içindir. CDK kaynağı bu repoda değil; backfill CDK reposunda yapılmalı.

---

## 1. CLI ile oluşturulan kaynaklar (CDK'ya taşınacak)

### 1a. GitHub OIDC provider (prod hesabında yok → oluşturulacak)
```
URL:          https://token.actions.githubusercontent.com
Audience:     sts.amazonaws.com
Thumbprint:   6938fd4d98bab03faadb97b34396831e3780aea1
```
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --profile bakimx-prod
```
> Not: Modern IAM GitHub OIDC için thumbprint'i fiilen doğrulama dışı bırakır ama API bir değer ister. Provider hesap-global tekildir — CDK'da var olanı referansla.

### 1b. IAM rolü `bakimx-prod-gha-deploy` (yalnız `main` dalı)
Trust policy (`trust.json`):
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::075550799591:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike":   { "token.actions.githubusercontent.com:sub": "repo:aokcuoglu/bakimx:ref:refs/heads/main" }
    }
  }]
}
```
```bash
aws iam create-role --role-name bakimx-prod-gha-deploy \
  --assume-role-policy-document file://trust.json \
  --max-session-duration 3600 --profile bakimx-prod
```

### 1c. İzin politikası `bakimx-prod-gha-deploy-policy` (inline, dar kapsam)
`policy.json` (dev politikasının prod ARN'leriyle kopyası):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "EcrAuth", "Effect": "Allow", "Action": "ecr:GetAuthorizationToken", "Resource": "*" },
    { "Sid": "EcrPush", "Effect": "Allow",
      "Action": ["ecr:BatchCheckLayerAvailability","ecr:InitiateLayerUpload","ecr:UploadLayerPart",
                 "ecr:CompleteLayerUpload","ecr:PutImage","ecr:BatchGetImage","ecr:GetDownloadUrlForLayer"],
      "Resource": "arn:aws:ecr:eu-central-1:075550799591:repository/bakimx/app" },
    { "Sid": "EcsReadRegister", "Effect": "Allow",
      "Action": ["ecs:DescribeTaskDefinition","ecs:RegisterTaskDefinition","ecs:DescribeTasks",
                 "ecs:ListTasks","ecs:DescribeServices"],
      "Resource": "*" },
    { "Sid": "EcsUpdateService", "Effect": "Allow", "Action": "ecs:UpdateService",
      "Resource": "arn:aws:ecs:eu-central-1:075550799591:service/bakimx-prod-cluster/bakimx-prod-app-svc" },
    { "Sid": "EcsRunMigrate", "Effect": "Allow", "Action": "ecs:RunTask",
      "Resource": "arn:aws:ecs:eu-central-1:075550799591:task-definition/bakimx-prod-app:*",
      "Condition": { "ArnEquals": { "ecs:cluster": "arn:aws:ecs:eu-central-1:075550799591:cluster/bakimx-prod-cluster" } } },
    { "Sid": "PassTaskRoles", "Effect": "Allow", "Action": "iam:PassRole",
      "Resource": [
        "arn:aws:iam::075550799591:role/bakimx-prod-compute-AppTaskTaskRole6D8E3660-HuQwgWDlnU35",
        "arn:aws:iam::075550799591:role/bakimx-prod-compute-AppTaskExecutionRoleE2BC84DF-hpDbWtEgU4Ku"
      ] }
  ]
}
```
```bash
aws iam put-role-policy --role-name bakimx-prod-gha-deploy \
  --policy-name bakimx-prod-gha-deploy-policy \
  --policy-document file://policy.json --profile bakimx-prod
```
> Migrate gate app task-def'ini command-override ile çalıştırır (dev deseni), bu yüzden `RunTask` yalnız `bakimx-prod-app:*` ve `PassRole` yalnız iki app rolüdür. Ayrı `bakimx-prod-migrate` family'yi CI kullanmıyor (manuel/CDK için durur); onu CI'a taşırsan `RunTask`'a `bakimx-prod-migrate:*` ve `PassRole`'a MigrateTask rollerini ekle.

### 1d. Task-def runtime env (CI enjekte ediyor → CDK task-def'ine taşınacak)
`bakimx-prod-app` task-def, `app` container'ının `environment`'ına şunları eklemeli:
```
DB_SSL_NO_VERIFY      = true            # ZORUNLU: prod RDS rds.force_ssl=1 + DATABASE_URL sslmode=require;
                                        # pg sürücüsü Amazon RDS CA'sını doğrulayamaz → login/DB TLS hatası.
                                        # db.ts sslmode'u soyup rejectUnauthorized:false yapar (src/lib/db.ts)
SESSION_COOKIE_NAME   = bakimx_session  # prod cookie kimliği (default'a eşit; açıkça)
SESSION_COOKIE_DOMAIN = .bakimx.com     # bakimx.com ↔ app.bakimx.com paylaşımlı oturum
```
> `DB_SSL_NO_VERIFY` **kritik** — task-def:4'te yoktu, o yüzden CI enjekte eder. `SESSION_COOKIE_*` prod'da zaten doğru default'a düşer ama parite için açıkça enjekte edilir; ayrıca **build-arg** olarak da geçilir (Edge middleware build-time inline eder). Build-arg'lar CI'da kalır; yalnız runtime env CDK'ya taşınır.

### 1e. `ADMIN_EMAILS` → SSM (2026-08-17, elle yapıldı → CDK'ya taşınacak)
`ADMIN_EMAILS`, `/bakimx/<env>/ADMIN_EMAILS` SSM parametresi var olmasına rağmen task-def'te **düz `environment` girdisiydi**; yani parametre hiç okunmuyordu ve "SSM'i güncelledim" demek hiçbir şeyi değiştirmiyordu. Elle düzeltildi (dev `:198`, prod `:28`): değişken `secrets[]`e taşındı ve diğer sağlayıcı env'leriyle aynı deseni izliyor. Parametre okuma izni, CDK'nın kendi `...DefaultPolicy` politikasına dokunmamak için task execution rolüne **ayrı** bir satır içi politikayla verildi (`AdminEmailsSsmRead`). CDK'ya taşırken ikisi birden gerekir: `secrets[]` girdisi **ve** `grantRead`. Aksi hâlde task `ResourceInitializationError` ile hiç başlamaz. Operasyonel kullanım: [platform-admin-model.md](../operations/platform-admin-model.md).

---

## 2. Backfill sonrası temizlik
1d ve build-arg'lar CDK'ya oturunca:
- CI'daki jq env-enjeksiyonunu (`DB_SSL_NO_VERIFY`/`SESSION_COOKIE_*`, `TODO(cdk-backfill)` yanında) kaldır. **Build-arg'ları çıkarma.**
- OIDC/rol/policy CDK'ya geçtiyse CLI kaynakları CDK deploy öncesi silinmeli (isim çakışması). OIDC provider'ı **silme** (tekil, referanslanıyor).

---

## 3. Cutover runbook (Contabo → AWS)

Prod AWS ayakta ve CI/CD bağlandıktan sonra canlıya geçiş sırası:

1. **Güncel kodu deploy et (DNS'ten önce).** `deploy-prod-aws.yml`'i `workflow_dispatch` ile çalıştır → build → ECR → migrate gate → deploy, PRIMARY==yeni assert geçer. `curl -I https://<ALB-DNS>/api/health` (Host: app.bakimx.com) → 200.
2. **Medya göçü.** `rclone sync` R2 `bakimx-media` → S3 `bakimx-media-prod`. Obje sayısı eşleşmesini doğrula.
3. **Cutover öncesi doğrulama.** Geçici `/etc/hosts` veya Host-header ile: login → `Set-Cookie: bakimx_session; Domain=.bakimx.com`; DB read/write; foto upload → S3; host split (`bakimx.com` landing, `app.bakimx.com` app, `www`→apex 301). **TAMI gerçek merchant — canlı ödeme testi yapma.**
4. **DNS cutover (Cloudflare).** `bakimx.com`/`www`/`app` → CNAME/ALIAS `bakimx-prod-alb-891302269.eu-central-1.elb.amazonaws.com`, **DNS-only (gri bulut)**. Sorun olursa eski VPS IP'sine geri al (Contabo rollback için ayakta).
5. **Trigger'ı çevir + Contabo emekli.** `deploy-prod-aws.yml`'de `on: push: branches: [main]` aç (yorumu kaldır), `deploy.yml`'i (Contabo) sil/dispatch-only yap — **aynı commit'te** (çift-deploy önlenir). Stabilizasyon sonrası `/opt/bakimx` stack indir, edge-nginx `bakimx.conf` blokları + LE cert + backup cron temizle.

---

## 4. Doğrulama
- `deploy-prod-aws.yml` yeşil (build → ECR → migrate gate → deploy, PRIMARY assert).
- `aws ecs describe-task-definition --task-definition bakimx-prod-app` → `app` env'inde 3 değişken.
- `curl -I https://app.bakimx.com/api/health` → 200; `https://bakimx.com` landing.
- Login → `Set-Cookie bakimx_session; Domain=.bakimx.com`.

## İlgili
- Workflow: [`.github/workflows/deploy-prod-aws.yml`](../../.github/workflows/deploy-prod-aws.yml)
- Dev muadili: [`docs/aws-dev-cicd.md`](./aws-dev-cicd.md)
- DB TLS: [`src/lib/db.ts`](../../src/lib/db.ts) (`DB_SSL_NO_VERIFY`)
- Health: [`src/app/api/health/route.ts`](../../src/app/api/health/route.ts)
- DNS: `bakimx.com`/`www`/`app.bakimx.com` → `bakimx-prod-alb-891302269.eu-central-1.elb.amazonaws.com` (Cloudflare, DNS-only); ACM `bakimx.com` + `*.bakimx.com` ISSUED.
