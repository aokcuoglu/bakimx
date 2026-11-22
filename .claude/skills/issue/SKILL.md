---
name: issue
description: Turn a short description into a well-formed BakımX GitHub issue (type, goal, where, acceptance criteria, operations, label) after a quick code survey. Use for "/issue <description>" or when a new development or bug needs an issue before work starts.
argument-hint: <what should change and why>
---

Open a single GitHub Issue for: `$ARGUMENTS`

0. Search first: `gh issue list --state open --search "<keywords>"`. If an open Issue already covers it, comment there instead of opening a new one.
1. Classify: type ∈ feat|fix|perf|refactor|docs|copy|test|chore → label `enhancement` (feat/perf/refactor/copy/chore), `bug` (fix) or `documentation` (docs). These are the only type labels the repository has; do not create new ones.
2. Survey the code for 1–3 minutes (grep: feature, copy, route) so **Nerede** points at real files and **Kabul kriterleri** are testable. Note tenant/RBAC impact and whether a Prisma migration is likely.
3. Keep it one PR in size; if bigger, open the first slice and list the rest under "Takip".
4. Create it (title `<type>(<area>): <Turkish summary>` like recent issues, body Turkish):
```
gh issue create --title "<type>(<area>): <özet>" --label <label> --body "$(cat <<'MD'
### Amaç
<Problem / ne değişmeli ve neden; önce kullanıcıya görünen davranış. 3–8 satır.>

### Nerede
- `src/...` — bugün ne var

### Kabul kriterleri
- [ ] test edilebilir kriter
- [ ] UI için: mobil (390) + masaüstü (1440), Türkçe metin
- [ ] tenant izolasyonu / yetki kapısı korunuyor (ilgiliyse)
- [ ] ilgili test eklendi/güncellendi

### Operasyon
- prod/veri/konsol adımı (migration, SSM parametresi, backfill) veya "yok"

### Köken
- Found in #N / Part of #N (varsa)

### Takip
- (isteğe bağlı)
MD
)"
```
5. Add it to the `Factory - BakimX` project as Todo if it is not added automatically. Give the Issue URL and title. Do not start work unless asked (then `/ship <N>`).
