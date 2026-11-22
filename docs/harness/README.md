# BakımX ajan altyapısı (Claude Code)

> Claude Code'un BakımX'i nasıl geliştirdiği: bir orkestratör, altı uzman alt ajan,
> deterministik kontroller ve sabit bir hat. Yapı getirbakim'deki altyapıdan
> birebir uyarlandı (#789, 2026-11-22). Araçtan bağımsız teslimat sözleşmesi:
> [`docs/agent-workflows/issue-delivery.md`](../agent-workflows/issue-delivery.md);
> kurallar: [`AGENTS.md`](../../AGENTS.md), [`CLAUDE.md`](../../CLAUDE.md),
> [`DESIGN.md`](../../DESIGN.md); birikmiş tuzaklar:
> [`repo-guardrails.md`](../agent-workflows/repo-guardrails.md).

## Neden

22-11'e kadar entegrasyon noktası **push edilmemiş yerel `dev`** idi: her oturum
işini birincil checkout'a elle "terfi" ettirmeyi hatırlamak zorundaydı, CI akşam
toplu koşuyordu ve squash merge'lerden sonra yerel `dev` `reset --hard` ile
eşitleniyordu. Oturumlar birbirini görmüyordu. Ölçüm (22-11): bir dalın 19, diğerinin
10 commit'i yerel `dev`'de yoktu; yerel `dev` `origin/dev`'in 6 commit önündeydi
ve hiç açık PR yoktu. Sonuç: geliştirmeler localhost:3001'de görünmüyordu.

Şimdi **tek entegrasyon noktası `origin/dev`**:

- Her iş PR ile `dev`'e girer. Yeni her worktree `origin/dev`'den açıldığı için
  diğer oturumların merge edilmiş işini otomatik olarak içerir.
- Merge'den sonra birincil checkout yalnız `git merge --ff-only origin/dev` ile
  ilerler, yani localhost:3001 her zaman `origin/dev`'i gösterir.
- Oturum açılış özeti, o an açık olan her worktree'yi ve yerel `dev`'deki PR'sız
  commit'leri listeler; Bash koruması akış dışı komutları durdurur.

## Hat

```
/ship <issue>                 (ana oturum = orkestratör, Atlas)
   │
   ├─ 1 worktree               ../bakimx-<N>  (dal issue/<N>-<konu>, origin/dev'den; bun install)
   ├─ 2 bakimx-planner         salt okur → plan (dosyalar, yeniden kullanım, Prisma/tenant/RBAC etkisi, testler, QA rotaları)
   ├─ 3 bakimx-developer       worktree'de uygular, test ekler, dört kapı + harness:gates, commit (SHA ile raporlar)
   ├─ 4 bakimx-reviewer      ┐ paralel, salt okur → bulgular → geliştiriciye (≤2 döngü); kontrolleri yeniden koşmaz
   │    bakimx-ui-ux         ┘ (yalnız .tsx/.css değiştiyse; küçük salt-UI değişiklikte tek başına)
   ├─ 5 bakimx-qa              kısa ömürlü worktree sunucusunda (32NN) Chrome turu, mobil + masaüstü
   ├─ 6 PR → dev               origin/dev merge, push, gh pr create (Closes #N [+ Closes BAK-x]), quality'yi bekle;
   │                           merge öncesi statusCheckRollup kontrolü (pipe'sız)
   └─ 7 squash merge → dev     izin sormadan (kalıcı merge yetkisi); issue'yu kapat (dev merge kapatmaz),
                               project:sync, birincil checkout ff (3001), kendi worktree/dalını temizle
                               main'e yalnız /release-check ile, kullanıcının açık onayıyla (main = prod deploy)
```

Orkestratör ürün kodu yazmaz; ajanlara brief verir, bulguları taşır, kapsamı
Issue'da tutar. Altyapı akışın önüne yapı ekler, onu atlatmaz: `dev`'e her şey
yine PR + yeşil `quality` ile girer; `main` ve prod ayrı onaydır.

## Ajanlar (`.claude/agents/`)

| Ajan | Rol | Model | Kod yazar mı? | Brief |
|------|-----|-------|---------------|-------|
| `bakimx-planner` | Mimar (Atlas): kodu tarar, uygulanabilir plan döner | fable | hayır | Issue no, worktree |
| `bakimx-developer` | Mühendis (Forge/Pixel): uygular, Prisma şema + migration, test, commit | sonnet | evet | worktree, Issue, plan |
| `bakimx-reviewer` | Kod incelemesi: tenant izolasyonu, RBAC, migration, Next 16, performans, testler | fable | hayır | worktree veya PR no |
| `bakimx-ui-ux` | DESIGN.md (e-santral) + ui-control-sizing + AGENTS.md UI kuralları | sonnet | hayır | worktree, rotalar, sunucu adresi |
| `bakimx-qa` | Kapılar + tarayıcı turu (mobil/masaüstü, sahip/teknisyen/public) | sonnet | hayır | worktree, rotalar, roller, kabul kriterleri |
| `bakimx-triage` | Backlog: her açık Issue'yu kanıtla sınıflar, paralel dalga önerir | sonnet | hayır | — (`/backlog`) |

**Model seçimi:** yargısı sonraki her adımı belirleyen planlayıcı ve kiracılar arası
sızıntı/veri kaybının tek kapısı olan inceleyici fable (orkestratörden farklı model
→ bağımsız ikinci göz); mekanik ağırlıklı geliştirme, UI denetimi, QA ve triage
sonnet. Orkestratör `bakimx-developer`'a `model: "opus"` geçer: Prisma şema/migration,
auth/oturum/RBAC, faturalama/ödeme (TAMI), tenant izolasyonuna duyarlı sorgular,
alanlar arası refactor ya da iki inceleme döngüsünde kalan sonnet çalışması.

## Skill'ler (`.claude/skills/`)

| Skill | Ne yapar |
|-------|----------|
| `/ship <N veya açıklama>` | Hattın tamamı; `dev`'e merge, issue kapanışı, pano, 3001 güncellemesi ve temizlik dahil |
| `/issue <açıklama>` | Kısa kod taramasıyla etiketli, kabul kriterli Issue |
| `/qa [worktree\|N] [rotalar]` | Yalnız QA aşaması |
| `/design-check [yollar]` | `harness:gates` + `bakimx-ui-ux` incelemesi |
| `/backlog` | `bakimx-triage` + kanıtlı düzenlemeler (checklist, kapatma, mükerrer) + `project:sync` |
| `/release-check` | dev→main kapsamı, hazırlık kontrolü ve SemVer önerisi; **onaydan sonra** sürüm PR'ı, main merge (= prod deploy), izleme, tag |

Eski `bakimx-issue-delivery`, `bakimx-release-check`, `bakimx-code-review` ve
`bakimx-ui-qa` skill'leri bunlara katlandı (sırasıyla `/ship`, `/release-check`,
`bakimx-reviewer`, `bakimx-ui-ux`/`/qa`). Codex kendi skill'ini
(`.codex/skills/bakimx-issue-delivery`) kullanır; aynı sözleşmeye
(`issue-delivery.md`) bağlıdır.

## Hook'lar ve deterministik kontroller

| Script | Ne zaman | Ne yapar |
|--------|----------|----------|
| `scripts/flow/claude-brief.ts` | SessionStart | Akış kuralları + son sürüm, `origin/dev`'in `main`'den farkı, birincil checkout durumu (yerel `dev` ↔ `origin/dev`, kaydedilmemiş dosyalar), açık PR'lar, **diğer her worktree** (dal, `origin/dev`'in önündeki commit, kaydedilmemiş dosya, PR durumu, "tamamen merge edilmiş artık"). Hiç başarısız olmaz; hata yalnız özeti kısaltır. Elle: `bun run harness:brief`. |
| `scripts/flow/claude-guard.ts` | PreToolUse (Bash) | **Engel:** `dev`/`main` üzerinde commit, `--no-verify`, leasesiz force push, yerel `dev`/`main`'e ff olmayan merge/pull, `gh pr merge --admin`, `docker compose down -v`, `docker volume/system prune`. **Onay sorar:** `main`'e push, base≠dev `gh pr merge` (main = prod deploy), sürüm tag'i, `gh release create`, workflow dispatch / `gh run rerun`, `dev`'e doğrudan push, birincil checkout'ta `reset --hard`/`stash`/`checkout -- .`, `git clean -f`, `worktree remove --force`, repo ayarı, paylaşımlı DB'ye `migrate deploy`/`db push`/`migrate reset`, `docker volume rm`, prod veri sıfırlama. Testler: `scripts/flow/claude-guard.test.ts`. |
| `scripts/harness/post-edit-check.ts` | PostToolUse (Edit/Write) | `src/` altındaki bir `.ts/.tsx/.css` değişince, dosyanın ait olduğu checkout'ta (worktree dahil) `bun run harness:gates` koşar (~1,7 sn) ve başarısızlığı ajana bağlam olarak verir. Engellemez. |
| `bun run harness:gates` | elle / hook / ajanlar | Kaynak tarayan kapılar (repo-guardrails §5): UI sözleşmesi, tema token'ları + kontrast, kontrol ölçüsü, sekme taşması, RBAC kapsamı, fotoğraf görünürlüğü, `mock.module` izolasyonu. CI bunları `bun test` içinde zaten koşar. |

CI son kapıdır: `quality` artık her PR'da koşar (`ci` etiketi gerekmez). Repo public
olduğu için GitHub-hosted dakikalar ücretsiz. Public repoya self-hosted runner
kaydedilmez ve `CI_RUNS_ON` tanımlanmaz (fork PR'ı o makinede kod çalıştırabilir).

## Yerel ortam notları

- Birincil checkout `/Users/void/www/bakimx` dalı `dev`'de durur ve
  `localhost:3001`'i sunar (`bun run dev`; 3000 getirbakim'in). Orada kod
  düzenlenmez, commit atılmaz, `bun run build` koşulmaz, sunucu öldürülmez.
- Worktree'ler kardeş klasördedir: `../bakimx-<N>` (eski `.worktrees/` içindekiler
  sahipleri bitirene kadar kalır). Kardeş klasör, worktree kaynaklarını birincil
  checkout'un tsc/eslint/Turbopack kapsamının dışında tutar.
- `bun run worktree:env -- <yol>` birincil checkout'un `.env.local` dosyasını
  worktree'ye **symlink** eder — worktree'de `.env.local` düzenlenmez (birincil
  checkout'un dosyasını değiştirir). `bun install` (~3 sn) gerçek `node_modules` kurar; Turbopack symlink'li
  `node_modules` ile çalışmaz.
- `.env.local` AWS dev DB'sine SSM tüneliyle (5433) bağlanır — app-dev ve tüm
  oturumlar ortaktır. Bir dalın migration'ı oraya `migrate deploy` edilmez; QA
  izole bir Postgres konteynerinde (`docker run … -p 127.0.0.1::5432`) ortam
  değişkeni ezmesiyle yapılır. Migration yazımı `bun run db:migrate` ile yerel
  atölye DB'sindedir. Migration içeren PR'ın squash mesajına `[deploy-dev]` yazılır.
- Worktree QA sunucusu: port `3200 + (Issue no mod 100)`, giriş
  `/api/auth/dev-login?email=admin@bakimx.com&redirect=<yol>`. QA bitince sunucu ve
  konteyner kapatılır.
- Herdr içinde worktree `herdr worktree create … --path ../bakimx-<N>` ile açılır.

## Geçiş (22-11)

Altyapı merge edildiğinde birincil checkout'ta PR'ı olmayan yerel commit'ler ve
eski `.worktrees/` altında süren işler vardı. Bunlara dokunulmadı: açılış özeti
hepsini her oturumda listeler, sahibi olan oturum işini yeni akışla (PR → merge)
bitirir. Yerel `dev`'deki işlerin tamamı `origin/dev`'e ulaştığında birincil
checkout kullanıcının onayıyla `origin/dev`'e eşitlenir; o andan sonra yalnız
fast-forward ile ilerler.

## Ajan eklemek/değiştirmek

1. `.claude/agents/<ad>.md` dosyasını düzenle (frontmatter: `name`, `description`,
   `tools`, `model`). `tools` her ajanda yazılır: yoksa ajan oturumdaki tüm MCP
   araçlarını devralır ve her çağrıda gereksiz bağlam yükler. Brief kendi kendine
   yetmeli: alt ajanlar sohbeti görmez.
2. Ajan/skill talimatları **İngilizce** yazılır (her oturumda ve her alt ajanda
   yüklendikleri için daha az token). Kullanıcıya dönüş, Issue gövdesi ve UI
   metinleri Türkçe kalır; bu, talimatta kural olarak yazılır. İnsanlara yönelik
   belgeler (`docs/**`) Türkçe kalır.
3. Proje `.claude/settings.json` içinde ilgisiz eklentileri kapatır (Vercel —
   proje AWS'de); yeni bir eklenti her oturuma skill/araç listesi ekler.
4. `AGENTS.md`/`DESIGN.md`/akış kuralı değişirse onu uygulayan ajanı ve kural
   mekanikse guard'ı veya kapı testini (testleriyle) güncelle.
5. Değişikliği her iş gibi gönder: Issue → worktree → PR (`chore(harness): …`).
