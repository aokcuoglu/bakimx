# AWS dev CI/CD — CDK backfill spec

**Amaç.** `app-dev.bakimx.com` (AWS dev ortamı, Contabo `staging.app.bakimx.com`'un yerini alır) için CI/CD, `dev` push'unda GitHub Actions → ECR → ECS ile deploy eder (workflow: [`.github/workflows/deploy-dev-aws.yml`](../.github/workflows/deploy-dev-aws.yml)). Aşağıdaki AWS kaynakları 2026-07-20'de **AWS CLI ile** (hibrit yaklaşım) elle oluşturuldu; bu doküman onların **CDK'ya taşınması (backfill)** içindir; taşındıktan sonra CLI kaynakları ve CI'daki geçici env-enjeksiyonu kaldırılır.

Account `292398627626`, region `eu-central-1`. Repo `aokcuoglu/bakimx`.

Akış: OIDC ile rol üstlen → arm64 image build (ECR) → yeni task-def revizyonu (image swap + runtime env inject) → migrate gate (bir kerelik `ecs run-task`) → `update-service` → PRIMARY task-def==yeni assert.

---

## 1. Elle oluşturulan kaynaklar (CDK'ya taşınacak)

### 1a. GitHub OIDC provider (hesap-global tekil)
```
URL:          https://token.actions.githubusercontent.com
Audience:     sts.amazonaws.com
Thumbprint:   6938fd4d98bab03faadb97b34396831e3780aea1
ARN:          arn:aws:iam::292398627626:oidc-provider/token.actions.githubusercontent.com
```
> Not: Modern IAM, GitHub OIDC için thumbprint'i fiilen doğrulama dışı bırakır ama API bir değer ister. Bu provider **hesapta tekildir** — CDK'da ya var olanı referansla ya da tek yerde oluştur (birden çok stack oluşturmaya çalışmasın).

### 1b. IAM rolü `bakimx-dev-gha-deploy`
- ARN: `arn:aws:iam::292398627626:role/bakimx-dev-gha-deploy`
- MaxSessionDuration: `3600`
- Trust policy (yalnız `dev` dalındaki push/dispatch üstlenebilir):
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::292398627626:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike":   { "token.actions.githubusercontent.com:sub": "repo:aokcuoglu/bakimx:ref:refs/heads/dev" }
    }
  }]
}
```

### 1c. İzin politikası `bakimx-dev-gha-deploy-policy` (inline, dar kapsam)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "EcrAuth", "Effect": "Allow", "Action": "ecr:GetAuthorizationToken", "Resource": "*" },
    { "Sid": "EcrPush", "Effect": "Allow",
      "Action": ["ecr:BatchCheckLayerAvailability","ecr:InitiateLayerUpload","ecr:UploadLayerPart",
                 "ecr:CompleteLayerUpload","ecr:PutImage","ecr:BatchGetImage","ecr:GetDownloadUrlForLayer"],
      "Resource": "arn:aws:ecr:eu-central-1:292398627626:repository/bakimx/app" },
    { "Sid": "EcsReadRegister", "Effect": "Allow",
      "Action": ["ecs:DescribeTaskDefinition","ecs:RegisterTaskDefinition","ecs:DescribeTasks",
                 "ecs:ListTasks","ecs:DescribeServices"],
      "Resource": "*" },
    { "Sid": "EcsUpdateService", "Effect": "Allow", "Action": "ecs:UpdateService",
      "Resource": "arn:aws:ecs:eu-central-1:292398627626:service/bakimx-dev-cluster/bakimx-dev-app-svc" },
    { "Sid": "EcsRunMigrate", "Effect": "Allow", "Action": "ecs:RunTask",
      "Resource": "arn:aws:ecs:eu-central-1:292398627626:task-definition/bakimx-dev-app:*",
      "Condition": { "ArnEquals": { "ecs:cluster": "arn:aws:ecs:eu-central-1:292398627626:cluster/bakimx-dev-cluster" } } },
    { "Sid": "PassTaskRoles", "Effect": "Allow", "Action": "iam:PassRole",
      "Resource": [
        "arn:aws:iam::292398627626:role/bakimx-dev-compute-AppTaskTaskRole6D8E3660-uz9MnoGLKfEg",
        "arn:aws:iam::292398627626:role/bakimx-dev-compute-AppTaskExecutionRoleE2BC84DF-sOezpBBioYHw"
      ] }
  ]
}
```
> `DescribeTaskDefinition`/`RegisterTaskDefinition`/`DescribeTasks`/`ListTasks` resource-level ARN desteklemez → `*`. `UpdateService` service ARN'ine, `RunTask` task-def family'sine + cluster koşuluna daraltıldı. `PassRole` yalnız iki compute rolüne.

### 1d. Task-def runtime env (şu an CI enjekte ediyor → CDK task-def'ine taşınacak)
`bakimx-dev-app` task-def, `app` container'ının `environment`'ına şunları eklemeli:
```
DB_SSL_NO_VERIFY     = true                    # app pg sürücüsü RDS CA'sını doğrulamaz (src/lib/db.ts); yoksa login TLS hatası
SESSION_COOKIE_NAME  = bakimx_session_dev      # cookie'yi prod'un bakimx_session'ından izole et
SESSION_COOKIE_DOMAIN = app-dev.bakimx.com     # cookie'yi prod'un .bakimx.com'undan izole et
```
> `SESSION_COOKIE_*`, workflow'da **ayrıca build-arg** olarak da geçilir (Edge middleware bunları build-time inline eder). **Build-arg'lar CI'da kalır** (image derleme derdi); yalnızca **runtime env** CDK task-def'ine taşınır (Node route'ları runtime'da okur). İkisi de aynı değer olmalı. `DB_SSL_NO_VERIFY` sadece runtime.

---

## 2. CDK örnek (aws-cdk-lib v2, TypeScript)

```ts
import * as iam from "aws-cdk-lib/aws-iam";

// Var olan OIDC provider'ı referansla (hesapta tekil; CLI ile oluşturuldu).
const gh = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
  this, "GithubOidc",
  "arn:aws:iam::292398627626:oidc-provider/token.actions.githubusercontent.com",
);

const deployRole = new iam.Role(this, "GhaDeployRole", {
  roleName: "bakimx-dev-gha-deploy",
  maxSessionDuration: Duration.hours(1),
  assumedBy: new iam.OpenIdConnectPrincipal(gh, {
    StringEquals: { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
    StringLike:   { "token.actions.githubusercontent.com:sub": "repo:aokcuoglu/bakimx:ref:refs/heads/dev" },
  }),
});

// İzinler için 1c'deki JSON'u iam.PolicyStatement.fromJson ile ekleyebilir
// ya da grant helper'larıyla (repo.grantPullPush(deployRole), service.grant... vb.) yazabilirsin.
// PassRole'da appTaskRole + appExecRole'ü kaynak ver; RunTask'a cluster koşulu koy.
```
Task-def env (1d) CDK'daki container tanımına eklenir:
```ts
container.addEnvironment("DB_SSL_NO_VERIFY", "true");
container.addEnvironment("SESSION_COOKIE_NAME", "bakimx_session_dev");
container.addEnvironment("SESSION_COOKIE_DOMAIN", "app-dev.bakimx.com");
```

### İsim çakışması uyarısı
Kaynaklar CLI ile **aynı isimlerle** zaten var. CDK aynı isimle **oluşturmaya çalışırsa çakışır**. Seçenekler:
1. **Sil-yeniden-oluştur (en temiz):** CDK deploy'dan önce CLI kaynaklarını sil — rol yalnız CI tarafından kullanılıyor, iki deploy arası silinip aynı ARN/isimle yeniden oluşması sorunsuz. OIDC provider'ı **silme** (tekil, referanslanıyor).
   ```
   aws iam delete-role-policy --role-name bakimx-dev-gha-deploy --policy-name bakimx-dev-gha-deploy-policy --profile bakimx-dev
   aws iam delete-role --role-name bakimx-dev-gha-deploy --profile bakimx-dev
   ```
2. **`cdk import`** ile var olanları CDK yönetimine al.

---

## 3. Backfill sonrası temizlik
1d ve build-arg'lar CDK/CI'da yerine oturunca:
- **CI'daki jq env-enjeksiyonunu kaldır** — `.github/workflows/deploy-dev-aws.yml` "Register new task definition" adımındaki `DB_SSL_NO_VERIFY`/`SESSION_COOKIE_*` enjeksiyonu (yanındaki `TODO(cdk-backfill)`). Enjeksiyon idempotent, CDK env'i ezmiyor; yine de tek kaynak (CDK) kalması için çıkarılmalı. **Build-arg'ları çıkarma.**
- OIDC/rol/policy CDK'ya geçtiyse yukarıdaki CLI kaynakları silinmeli (isim çakışmasını önlemek için CDK deploy öncesi).

---

## 4. Doğrulama (backfill sonrası)
- `dev`'e küçük bir commit push et → workflow yeşil (build → ECR → migrate gate → deploy, PRIMARY==yeni assert geçer).
- `aws ecs describe-task-definition --task-definition bakimx-dev-app` → `app` env'inde 3 değişken var.
- `curl -I https://app-dev.bakimx.com/api/health` → 200.
- Login → Set-Cookie `bakimx_session_dev; Domain=app-dev.bakimx.com` (prod'dan izole).

## İlgili
- Workflow: [`.github/workflows/deploy-dev-aws.yml`](../.github/workflows/deploy-dev-aws.yml)
- DB TLS fix: [`src/lib/db.ts`](../src/lib/db.ts) (`DB_SSL_NO_VERIFY`)
- Health endpoint: [`src/app/api/health/route.ts`](../src/app/api/health/route.ts)
- DNS: `app-dev.bakimx.com` CNAME → `bakimx-dev-alb-2002771168.eu-central-1.elb.amazonaws.com` (registrar/Cloudflare, DNS-only)
- Contabo staging emekliliği (Faz 5): repo tarafı TAMAM (staging.yml + artefaktlar + middleware temizlendi). VPS/DNS sökümü kullanıcıda: `/opt/bakimx-staging` stack, getirbakim-nginx `staging.app.bakimx.com` bloğu, LE cert, DNS kaydı.
