# Yerel-first `dev` + gün sonu batch Actions

Actions dakikasını korumak için gündüz GitHub CI koşmaz; `localhost:3000` yine
her zaman güncel yerel `dev` üzerinden doğrulanır. Gün sonunda açık PR'lara `ci`
label'ı eklenir, `quality` bir tur koşar, merge sonrası yerel `dev` `origin/dev`
ile eşitlenir.

Tam issue teslimatı için [issue-delivery.md](./issue-delivery.md); kota ve
koruma bağlamı için [repo-guardrails.md](./repo-guardrails.md).

## İki ray

| Ray | Ne | Ne zaman |
|---|---|---|
| Yerel entegrasyon | Feature worktree → kapılar → merge → **yerel `dev`** | Her feature bitince |
| GitHub batch | Push + draft PR (**`ci` yok**) → akşam `ci` → merge → sync | Gün sonu |

Primary checkout (`~/www/bakimx`) **hep `dev` üzerinde kalır**. Issue branch'e
geçip localhost'u oradan çalıştırmayın.

Deploy zaten opt-in (`[deploy-dev]`); bu doküman yalnız PR `quality` işini
batch'ler. `[skip ci]` commit mesajına güvenmeyin — `pull_request` tetiklerinde
güvenilir değildir; kapı `ci` label'ıdır
([`.github/workflows/quality.yml`](../../.github/workflows/quality.yml)).

## Gündüz

```text
origin/dev ──────────────── (gündüz durağan)
local/dev  ──●──●──●─────── (her feature merge'iyle ilerler)
             │  │  │
        issue/1  2  3
```

1. Worktree: `origin/dev`'den (yerel `dev` öndeyse ondan) `issue/<n>-<slug>`.
2. Worktree'de dört kapı: `bun test`, `bun run lint`, `bun run typecheck`,
   `bun run build`.
3. Primary'de feature'ı yerel `dev`'e alın (primary `dev`'de kalsın):

   ```sh
   git checkout dev
   git merge --ff-only issue/<n>-<slug>   # olmazsa normal merge
   # bun.lock değiştiyse: bun install && dev server restart
   ```

4. QA: `http://localhost:3000` = birikmiş yerel `dev`.
5. Feature branch'i push + `dev`'e **draft PR**. Body'de tracker satırları
   (`Closes #…`, gerekirse `Closes BAK-…`) PR **açılışında**.
6. PR'a **`ci` label koyma**. Actions bu PR için koşmaz.
7. Kullanıcı yalnız "commit + PR" dediyse burada dur — merge / Actions bekleme.

Sonraki bağımlı feature'ı güncel **yerel `dev`** tipinden dallandır.

## Akşam batch

1. Yerel `dev`'deki merge sırasına göre PR'ları sırala (A sonra B).
2. Her PR'ı `origin/dev` ile güncelle; CI öncesi birleşmiş hali lokal kapılardan
   geçir (bayat dal tuzağı — repo-guardrails §2.1).
3. CI'yi aç:

   ```sh
   gh label create ci --description "Run quality on this PR" --force   # bir kez
   gh pr edit <n> --add-label ci
   ```

4. Yeşil squash merge. Migration varsa squash mesajında `[deploy-dev]`
   (repo-guardrails §6).
5. Yerel eşitlenme — GitHub squash, yerel merge commit'lerinden farklı history
   üretir; tree aynıysa ve gündüz yerel `dev`'e giren her şey PR'larla çıktıysa:

   ```sh
   git checkout dev
   git fetch origin
   git reset --hard origin/dev
   ```

   Çıkmamış commit varsa önce PR'la veya yedekle; kirli tree'de reset yok.

`dev`'de zorunlu status check yoktur; akşam merge teknik olarak açıktır. Kalite
gündüz yerel kapılara + akşam tek `quality` turuna bağlıdır.

## `quality` ne zaman koşar?

| Olay | Koşar mı? |
|---|---|
| PR → `dev`, `ci` label yok | Hayır (job skipped, 0 dk) |
| PR → `dev`, `ci` label var / eklendi | Evet |
| PR → `main` | Her zaman (branch protection) |
| `workflow_call` (deploy kapısı) / `workflow_dispatch` | Her zaman |

## Kurallar

- Gündüz `ALLOW_DIRECT_PUSH` ile `origin/dev`'e yazma — PR / `pr-origin` disiplinini bozar.
- Bağımlı PR'larda önce taban merge; üst PR'ı retarget veya rebase et.
- `main` / release akışına batch modeli uygulanmaz.
- `git reset --hard` yalnız bu akşam sync adımında ve bilinçli kullanılır; genel
  cleanup için değil (issue-delivery §9).
