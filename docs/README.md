# BakımX Dokümantasyon

Bu klasör projenin tüm teknik dokümantasyonunu barındırır. Başlangıç için kök `README.md`'ye bakın.

## İçindekiler

| Konu | Doküman |
|---|---|
| Yapılandırma & ortam değişkenleri | [CONFIGURATION.md](./CONFIGURATION.md) |
| Veritabanı şeması & modeller | [../DB.md](../DB.md) |
| Üretim dağıtımı (VPS) | [../DEPLOY.md](../DEPLOY.md) · [DEPLOYMENT.md](./DEPLOYMENT.md) |
| AWS dev CI/CD (app-dev.bakimx.com) | [aws-dev-cicd.md](./aws-dev-cicd.md) |
| Sürüm/release süreci | [../RELEASE.md](../RELEASE.md) · [RELEASE-FLOW.md](./RELEASE-FLOW.md) |
| Mimari genel bakış | [architecture/BAKIMX-ARCHITECTURE.md](./architecture/BAKIMX-ARCHITECTURE.md) |
| Mimari analiz (TR) | [MIMARI-ANALIZ.md](./MIMARI-ANALIZ.md) |
| Teknik analiz raporu | [ANALYSIS.md](./ANALYSIS.md) |
| Sürüm notları (changelog) | [releases/](./releases/) · [../CHANGELOG.md](../CHANGELOG.md) |
| QA senaryoları | [QA/](./QA/) |
| Ajan/otomasyon kuralları | [../AGENTS.md](../AGENTS.md) · [../CLAUDE.md](../CLAUDE.md) |

## Katkı ve süreç
- Katkı rehberi: [../CONTRIBUTING.md](../CONTRIBUTING.md)
- Güvenlik bildirimi: [../SECURITY.md](../SECURITY.md)
- Dallanma & release: `feature/*` → `dev` → **app-dev.bakimx.com (AWS)** → `main` → **app.bakimx.com (prod, Contabo)**
