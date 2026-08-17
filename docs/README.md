# BakımX dokümantasyonu

Başlangıç için kök [`README.md`](../README.md)'ye bakın.

## Rehberler

| Konu | Doküman |
|---|---|
| Yapılandırma & ortam değişkenleri | [configuration.md](./configuration.md) |
| Veritabanı, migration & yedekleme | [database.md](./database.md) |
| Dallanma, deploy & sürüm çıkarma | [releasing.md](./releasing.md) |
| UI kontrol boyutları | [ui-control-sizing.md](./ui-control-sizing.md) |

## Operasyon

| Konu | Doküman |
|---|---|
| Platform yönetim modeli — ekip erişimi, roller, konsol | [operations/platform-admin-model.md](./operations/platform-admin-model.md) |
| Destek runbook — şikayet triyajı & test yöntemleri | [operations/support-runbook.md](./operations/support-runbook.md) |

## Ajan akışları

| Konu | Doküman |
|---|---|
| GitHub issue teslimat sözleşmesi | [agent-workflows/issue-delivery.md](./agent-workflows/issue-delivery.md) |
| Repo tuzakları — birikimden çıkan kurallar | [agent-workflows/repo-guardrails.md](./agent-workflows/repo-guardrails.md) |

## Altyapı

| Ortam | Doküman |
|---|---|
| AWS prod (`bakimx.com`, `app.bakimx.com`) | [deployment/aws-prod.md](./deployment/aws-prod.md) |
| AWS dev (`app-dev.bakimx.com`) | [deployment/aws-dev.md](./deployment/aws-dev.md) |

## Mimari

| Konu | Doküman |
|---|---|
| Genel bakış (EN) | [architecture/overview.md](./architecture/overview.md) |
| Mimari analiz (TR) | [architecture/mimari-analiz.md](./architecture/mimari-analiz.md) |
| Teknik analiz raporu | [architecture/analysis.md](./architecture/analysis.md) |
| Diyagramlar | [architecture/](./architecture/) — `.mmd` kaynak + `.png`/`.svg` çıktı |

## Kayıtlar

| Konu | Klasör |
|---|---|
| Sürüm notları | [releases/](./releases/) · özet: [../CHANGELOG.md](../CHANGELOG.md) |
| Manuel QA senaryoları | [qa/](./qa/) |
| Marka kimliği | [brand/](./brand/) |
| Plan & tasarım arşivi | [superpowers/](./superpowers/) |

## Süreç

- Katkı rehberi: [../CONTRIBUTING.md](../CONTRIBUTING.md)
- Güvenlik bildirimi: [../SECURITY.md](../SECURITY.md)
- Ajan/otomasyon kuralları: [../CLAUDE.md](../CLAUDE.md) · [../AGENTS.md](../AGENTS.md)
- Dallanma & release: `feature/*` → `dev` → **app-dev.bakimx.com** → `main` → **app.bakimx.com** (ikisi de AWS ECS)
