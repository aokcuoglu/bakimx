# Katkı Rehberi

BakımX özel (private) bir üründür. Bu rehber, tutarlı ve gözden geçirilebilir bir geliştirme akışı için iç kuralları tanımlar.

## Dallanma modeli
- `feature/*` — tüm geliştirme burada başlar, `dev`'e PR açılır.
- `dev` — entegrasyon dalı. Her push otomatik **app-dev.bakimx.com**'a (AWS) deploy olur.
- `main` — üretim aynası. Yalnızca app-dev'de doğrulanmış sürümler. `main`'e merge edildiğinde **prod**'a (app.bakimx.com, AWS ECS) deploy olur.

Tam akış için [docs/releasing.md](./docs/releasing.md).

## Commit mesajları
Conventional Commits kullanılır: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`, `build:`, `ci:`, `security:`. Kapsam ekleyin: `feat(billing): ...`.

## Kod kuralları
- TypeScript strict; gereksiz `any` yok.
- Her veri sorgusunda tenant/workshop izolasyonu zorunlu.
- Sunucu tarafında girdi doğrulaması (Zod).
- Mobil-öncelikli UX.
- Şema değişikliği migration etkisi açıklanmadan yapılmaz.
- Uygulama yerelde Docker'da çalışmaz (`bun run dev`); yalnız Postgres/MinIO `docker-compose.local.yml` ile ayağa kalkar. Docker imajı üretim içindir (CI'da build, AWS ECS'te çalışır).
Detay: [CLAUDE.md](./CLAUDE.md), [AGENTS.md](./AGENTS.md) ve [docs/agent-workflows/repo-guardrails.md](./docs/agent-workflows/repo-guardrails.md).

## PR'dan önce
CI'ın koştuğu kapının aynısı ([`quality.yml`](./.github/workflows/quality.yml)):
```bash
bun test
bun run lint       # sıfır hata
bun run typecheck
bun run build      # önemli değişikliklerde
bunx prisma validate
```
PR'daki yeşil tik yalnız head commit'i kanıtlar; merge öncesi `origin/dev`'i dalına alıp kapıyı tekrar koştur.

## Sürüm kesme
1. `feature/*` → `dev` merge, app-dev yeşil + smoke test.
2. `dev → main` PR, diff incele, merge.
3. `package.json` sürümünü yükselt, **`docs/releases/vX.Y.Z.md` notunu ekle**.
4. `git tag vX.Y.Z && git push origin vX.Y.Z`.
