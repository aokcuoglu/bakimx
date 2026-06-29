# Katkı Rehberi

BakımX özel (private) bir üründür. Bu rehber, tutarlı ve gözden geçirilebilir bir geliştirme akışı için iç kuralları tanımlar.

## Dallanma modeli
- `feature/*` — tüm geliştirme burada başlar, `dev`'e PR açılır.
- `dev` — entegrasyon dalı. Her push otomatik **staging**'e deploy olur.
- `main` — üretim aynası. Yalnızca staging'de doğrulanmış sürümler. Tag (`vX.Y.Z`) atıldığında **prod**'a deploy olur.

Tam akış için [RELEASE.md](./RELEASE.md).

## Commit mesajları
Conventional Commits kullanılır: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`, `build:`, `ci:`, `security:`. Kapsam ekleyin: `feat(billing): ...`.

## Kod kuralları
- TypeScript strict; gereksiz `any` yok.
- Her veri sorgusunda tenant/workshop izolasyonu zorunlu.
- Sunucu tarafında girdi doğrulaması (Zod).
- Mobil-öncelikli UX.
- Şema değişikliği migration etkisi açıklanmadan yapılmaz.
- Yerel geliştirmede Docker kullanılmaz (Docker yalnızca VPS/prod).
Detay: [CLAUDE.md](./CLAUDE.md) ve [AGENTS.md](./AGENTS.md).

## PR'dan önce
```bash
bun run lint
bun run typecheck
bun run build      # önemli değişikliklerde
bunx prisma validate
```

## Sürüm kesme
1. `feature/*` → `dev` merge, staging yeşil + smoke test.
2. `dev → main` PR, diff incele, merge.
3. `package.json` sürümünü yükselt, **`docs/releases/vX.Y.Z.md` notunu ekle**.
4. `git tag vX.Y.Z && git push origin vX.Y.Z`.
