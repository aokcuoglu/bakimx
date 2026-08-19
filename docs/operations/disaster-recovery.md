# Felaket kurtarma — yedekten geri dönüş prosedürü

Veri kaybı ya da bozulması olduğunda ne yapılacağı, ne kadar sürede ve ne kadar
geriye dönülebileceği. Şema/migration günlük işleyişi için
[database.md](../database.md), altyapı için
[deployment/aws-prod.md](../deployment/aws-prod.md).

**Bu dosyanın varlık sebebi:** 2026-08-19'a kadar RDS snapshot'ı alınıyordu ama
**hiç geri dönülmemişti**. Denenmemiş yedek yedek değildir: RTO bilinmiyordu,
prosedür yazılı değildi ve geri yüklemenin çalıştığına dair tek kanıt AWS'in
"snapshot available" demesiydi. §5'teki tatbikat bunu kapattı (BAK-120).

---

## 1. Bugün elimizde ne var — ölçülmüş durum

Aşağıdaki tablo varsayım değil, 2026-08-19'da AWS API'sinden okundu.

| Katman | Yedek | Saklama | Ölçülen durum |
|---|---|---|---|
| Prod DB (`bakimx-prod-db`, `db.t4g.small`, 20 GB, PG 16.13) | RDS otomatik snapshot + PITR | **7 gün** | 9 otomatik snapshot mevcut; en yeni PITR noktası ~5 dk gerisi. Şifreli (KMS CMK), `DeletionProtection: true` |
| Prod DB — elle snapshot | `bakimx-prod-pre-reset-20260729`, `bakimx-prod-pre-release-20260807` | süresiz | Riskli işlem öncesi elle alınıyor (`prod-reset.ts` kullanım notu adım 1) |
| Dev DB (`bakimx-dev-db`) | RDS otomatik snapshot + PITR | 3 gün | Kurtarma hedefi yok; kaybı kabul edilebilir |
| Fotoğraflar (`bakimx-media-prod`, 61 nesne / 157 MB) | S3 **versiyonlama açık** | eski sürüm: 30 gün sonra Glacier IR, **365 günde silinir** | Yanlışlıkla silme/üzerine yazma geri alınabilir |
| Loglar (`bakimx-logs-prod`) | versiyonlama **yok** | 90 gün IA → 180 gün Glacier → 1095 günde silinir | Kurtarma hedefi yok |
| Sırlar (Secrets Manager / SSM) | AWS tarafında sürümlenir | — | Altyapı CDK'da tanımlı, bu repoda değil |

**Yedeği OLMAYAN / kapsam dışı olan:**

- **Başka bölgeye ya da başka hesaba kopya yok.** Ne RDS snapshot'ı başka bölgeye
  kopyalanıyor, ne de S3 replikasyonu var (`GetBucketReplication` →
  `ReplicationConfigurationNotFoundError`). Bölge kaybı ve **AWS hesabının ele
  geçirilmesi** bu prosedürün dışındadır — §6'da açık boşluk olarak duruyor.
- **`bakimx-logs-prod` versiyonsuz** — silinen log dönmez. Bilinçli: log kanıt
  değil teşhis malzemesi.
- **Uygulama kodu** yedek konusu değil (GitHub + ECR image'ları).

---

## 2. RTO / RPO hedefleri

Hedefler tek kişilik bir operasyon ekibine ve MVP evresindeki bir SaaS'a göre
seçildi — "dakikalar içinde otomatik failover" gibi bir vaat verilmiyor çünkü
onu karşılayacak yapı (Multi-AZ, hazır bekleyen replika) bilinçli olarak yok.

| Senaryo | RPO hedefi | RTO hedefi | Dayanağı |
|---|---|---|---|
| DB bozulması / yanlışlıkla toplu silme | **≤ 15 dk** (PITR) | **≤ 4 saat** (mesai içi) | PITR penceresi ölçüldü: en yeni geri dönülebilir an ~5 dk gerisi |
| PITR kullanılamıyor, snapshot'a dönülüyor | ≤ 24 saat | ≤ 4 saat | Otomatik snapshot günde bir, 02:00–03:00 UTC |
| Tek instance / AZ kaybı | ≤ 15 dk | ≤ 4 saat | Multi-AZ kapalı; kurtarma = yeni instance'a restore |
| Fotoğraf silinmesi (S3) | 0 (versiyon duruyor) | ≤ 1 saat | Versiyonlama açık, eski sürüm 365 gün yaşıyor |
| Bölge kaybı | — | — | **Kapsam dışı** (§6) |

**RTO'nun ölçülen bileşeni:** snapshot'tan yeni instance **6 dk 58 sn**'de hazır
oldu (§5). Geri kalan bütçe insan kararı, sır güncelleme ve ECS deploy'u içindir;
4 saat bunun cömert bir üst sınırı, tipik değeri değil.

**Snapshot sıklığı bu hedeflere göre yeterli** ve artırılmadı: PITR zaten 5
dakikalık granülerlik veriyor, günlük snapshot'ı sıklaştırmak RPO'yu
iyileştirmiyor — yalnız fatura yazıyordu.

---

## 3. Karar ağacı — hangi senaryoda ne yapılır

Hepsinde ortak ilk kural: **kaynak instance'a dokunma.** Geri yükleme her zaman
YENİ bir instance'a yapılır; canlıyı yerinde "düzeltme" denemesi, elindeki tek
sağlam kopyayı da harcamanın yoludur.

1. **Tek kiracının verisi yanlışlıkla silindi (en olası senaryo).**
   Tüm veritabanını geri almak diğer kiracıları geriye atar. Doğrusu: PITR ile
   yan bir instance'a dön (§4), oradan yalnız ilgili satırları kopyala. Kopyalama
   sırasında canlı yazmaya devam ediyor — hangi tabloların taşınacağını
   `scripts/prod-reset.ts` içindeki `TENANT_TABLES` listesi FK sırasıyla verir.

2. **Şema/veri toptan bozuldu (kötü migration, hatalı script).**
   PITR ile bozulma anından hemen öncesine dön → doğrula (§4.4) → uygulamayı yeni
   endpoint'e çevir (§4.5). Bozan migration geri alınmaz, **ileri yönde** yeni bir
   migration ile düzeltilir (uygulanmış migration düzenlenmez —
   [database.md](../database.md) §3).

3. **Instance kayboldu / açılmıyor.**
   En yeni otomatik snapshot ya da PITR ile yeni instance (§4) → §4.5.

4. **Fotoğraf silindi.**
   S3 versiyonlama açık: `aws s3api list-object-versions --bucket bakimx-media-prod
   --prefix workshops/<workshopId>/` ile silme işaretini (`DeleteMarker`) bul ve
   kaldır (`delete-object --version-id <delete-marker-id>`). 365 günden eski
   sürümler lifecycle ile silinmiştir, dönmez.

5. **Bölge ya da hesap kaybı.** Prosedür yok — §6.

---

## 4. Geri yükleme prosedürü

Komutlar prod içindir; dev için `prod` → `dev` ve profil `bakimx-dev`.
Tatbikat için bu adımların tamamı `scripts/dr-drill.sh` ile otomatiktir (§5);
aşağısı gerçek bir olayda elle yürütülecek hâlidir.

### 4.1 Karar ve iletişim (önce bu)

| Ne | Kim | Nasıl |
|---|---|---|
| Kurtarma kararı, hedef zaman noktası | alpkaan (tek yetkili) | — |
| Etkilenen kiracılara bildirim | alpkaan | Atölye iletişim bilgileri `/admin` → İş Yerleri; kamuya açık anons [x.com/bakimxcom](https://x.com/bakimxcom), şablonlar [incident-communication.md](./incident-communication.md) (BAK-119) |
| Kayıt | kurtarmayı yürüten | Olay sonrası bu dosyanın §5 tablosuna satır + issue |

Kurtarmaya başlamadan **kaybın kapsamını yazıya dök**: hangi tablolar, hangi
kiracılar, hangi zaman aralığı. Bu cümle yazılmadan restore başlatılırsa hangi
zaman noktasına dönüleceği de belirsizdir.

### 4.2 Kaynağı seç

```sh
# Zaman noktası (PITR) — en hassas seçenek
aws rds describe-db-instances --db-instance-identifier bakimx-prod-db \
  --query 'DBInstances[0].LatestRestorableTime' \
  --profile bakimx-prod --region eu-central-1

# ya da snapshot listesi
aws rds describe-db-snapshots --db-instance-identifier bakimx-prod-db \
  --query 'sort_by(DBSnapshots,&SnapshotCreateTime)[].[DBSnapshotIdentifier,SnapshotCreateTime]' \
  --output table --profile bakimx-prod --region eu-central-1
```

### 4.3 Yeni instance'a geri yükle

Ağ ve sınıf kaynağın **aynısı** olmalı: farklı subnet grubu ya da güvenlik grubu
ile yapılan geri yükleme, uygulamanın bağlanamadığı bir veritabanı üretir.

```sh
# PITR
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier bakimx-prod-db \
  --target-db-instance-identifier bakimx-prod-restore-<tarih> \
  --restore-time 2026-08-19T11:45:00Z \
  --db-instance-class db.t4g.small \
  --db-subnet-group-name bakimx-prod-rds-sng \
  --vpc-security-group-ids sg-05fc3387bf41c7eb0 \
  --no-publicly-accessible --no-multi-az \
  --profile bakimx-prod --region eu-central-1

# ya da snapshot'tan
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier bakimx-prod-restore-<tarih> \
  --db-snapshot-identifier <snapshot-id> \
  --db-instance-class db.t4g.small \
  --db-subnet-group-name bakimx-prod-rds-sng \
  --vpc-security-group-ids sg-05fc3387bf41c7eb0 \
  --no-publicly-accessible --no-multi-az \
  --profile bakimx-prod --region eu-central-1

aws rds wait db-instance-available --db-instance-identifier bakimx-prod-restore-<tarih> \
  --profile bakimx-prod --region eu-central-1
```

Geri yüklenen instance **kaynağın master parolasını taşır** —
`bakimx/prod/db-url` sırrındaki kullanıcı/parola aynen çalışır, yalnız host değişir.

### 4.4 Doğrula — uygulamaya çevirmeden ÖNCE

Instance private subnet'te ve güvenlik grubu yalnız Fargate'ten 5432 kabul
ediyor; bu yüzden doğrulama çalışan ECS görevinin üstünden SSM port-forward ile
yapılır (günlük tünelin aynısı, farklı port).

```sh
TASK=$(aws ecs list-tasks --cluster bakimx-prod-cluster --service-name bakimx-prod-app-svc \
  --desired-status RUNNING --query 'taskArns[0]' --output text --profile bakimx-prod --region eu-central-1)
RID=$(aws ecs describe-tasks --cluster bakimx-prod-cluster --tasks "$TASK" \
  --query 'tasks[0].containers[0].runtimeId' --output text --profile bakimx-prod --region eu-central-1)
HOST=$(aws rds describe-db-instances --db-instance-identifier bakimx-prod-restore-<tarih> \
  --query 'DBInstances[0].Endpoint.Address' --output text --profile bakimx-prod --region eu-central-1)

aws ssm start-session --target "ecs:bakimx-prod-cluster_$(basename "$TASK")_${RID}" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "{\"host\":[\"$HOST\"],\"portNumber\":[\"5432\"],\"localPortNumber\":[\"5436\"]}" \
  --profile bakimx-prod --region eu-central-1 &

aws secretsmanager get-secret-value --secret-id bakimx/prod/db-url \
  --query SecretString --output text --profile bakimx-prod --region eu-central-1 \
  | sed -E 's#@[^/]+/#@localhost:5436/#' > /tmp/.dr-db-url

DR_DB_URL_FILE=/tmp/.dr-db-url DB_SSL_NO_VERIFY=true bunx tsx scripts/dr-verify.ts
rm -f /tmp/.dr-db-url
```

`scripts/dr-verify.ts` salt-okunurdur ve dört şeyi kanıtlar: bağlantı kuruluyor,
migration geçmişi kesintisiz ve yarım kalmış kaydı yok, veri gerçekten geldi
(boş bir restore yeşil geçmez), en taze satırın zamanı — yani **gerçekleşen RPO**.

> Script "koddaki son N migration snapshot'ta yok" derse bu arıza değildir: prod
> `dev` dalının gerisindedir. Arıza olan ikisi ayrı ayrı kapı: kodun tanımadığı
> bir migration ve sıra ortasında eksik migration.

### 4.5 Uygulamayı yeni veritabanına çevir

```sh
# 1) Yeni endpoint'i sırra yaz (kullanıcı/parola/veritabanı adı aynı kalır)
aws secretsmanager put-secret-value --secret-id bakimx/prod/db-url \
  --secret-string 'postgresql://bakimx:<parola>@<yeni-endpoint>:5432/bakimx?schema=public&sslmode=require' \
  --profile bakimx-prod --region eu-central-1

# 2) Görevleri yenile (sır container başlangıcında okunur)
aws ecs update-service --cluster bakimx-prod-cluster --service bakimx-prod-app-svc \
  --force-new-deployment --profile bakimx-prod --region eu-central-1
```

Şema kod seviyesinin gerisindeyse (§4.4 notu) eksik migration'lar
`prisma migrate deploy` ile ileri alınır — deploy hattındaki migrate gate bunu
zaten koşar ([aws-prod.md](../deployment/aws-prod.md)).

Sonra: `/api/health` 200, `/admin/health` derin kontroller, bir atölyeyle giriş
ve bir iş emri açma. Eski instance **hemen silinmez** — en az 24 saat, elle
snapshot'ı alınmış hâlde bekletilir.

### 4.6 Kapanış

- Eski/geçici instance'ları sil (`--skip-final-snapshot` yalnız geçici olanlar için).
- §5 tablosuna satır ekle.
- Kalıcı bir ders çıktıysa bu dosyaya ya da
  [repo-guardrails.md](../agent-workflows/repo-guardrails.md)'e yaz.

---

## 5. Tatbikat kaydı

Tatbikat `scripts/dr-drill.sh` ile tek komutta koşar: en yeni **otomatik**
snapshot'ı bulur, kaynağın sınıf/subnet/SG'siyle geçici bir instance açar,
`dr-verify.ts` ile doğrular ve **her çıkış yolunda** (hata ve Ctrl-C dahil)
instance'ı siler.

```sh
bash scripts/dr-drill.sh            # tam tur, sonunda siler
bash scripts/dr-drill.sh --keep     # elle incelemek için ayakta bırak
bash scripts/dr-drill.sh teardown <instance-id>   # yarıda kalanı temizle
```

Bilinçli olarak elle alınmış özel bir yedek değil, **günlük otomatik snapshot**
denenir — gerçek bir olayda elimizde olacak olan odur.

| Tarih | Ortam | Kaynak | Geri yükleme süresi | Sonuç |
|---|---|---|---|---|
| 2026-08-19 | prod | `rds:bakimx-prod-db-2026-08-19-02-10` (02:10 UTC otomatik) | **6 dk 58 sn** (12:07:08 → 12:14:06 UTC) | ✅ Başarılı |

**2026-08-19 tatbikatının bulguları (ilk tatbikat, BAK-120):**

- Geçici instance `bakimx-dr-drill-20260819`, prod hesabında, prod VPC'sinde,
  kaynakla aynı sınıf/subnet/SG ile açıldı. **Kaynak instance'a hiç dokunulmadı**
  (tatbikat sonrası `bakimx-prod-db`: `available`, `DeletionProtection: true`).
- `dr-verify.ts` tüm kontrollerden geçti: bağlantı 668 ms, 48 migration kesintisiz,
  yarım/geri alınmış migration yok. Satır sayıları: 3 atölye, 8 kullanıcı,
  12 müşteri, 15 araç, 19 iş emri, 47 fotoğraf kaydı, 514 denetim kaydı,
  37 937 araç kataloğu satırı.
- **Ölçülen RPO:** en taze satır `AuditLog` 2026-08-18T15:05:35Z, snapshot
  2026-08-19T02:10Z — yani snapshot bir önceki günün tüm yazmalarını taşıyor,
  veri kaybı yok. (Bu ölçüm snapshot'ın tazeliğini gösterir; gerçek olayda
  RPO'yu PITR belirler.)
- **Uygulama katmanı da doğrulandı:** uygulamanın kendi Prisma istemcisiyle
  (`src/lib/db.ts` → `@prisma/adapter-pg`) `getHealthSummary()` ve ilişki sayımlı
  `workshop.findMany()` geri yüklenen veritabanı üzerinde çalıştı; üç atölye
  isim/abonelik/kullanıcı-müşteri sayılarıyla döndü. Yani kurtarma yalnız
  "Postgres ayağa kalktı" değil, "uygulama bu veriyle çalışır" seviyesinde.
- Tam uçtan uca uygulama açılışı (`next start` + giriş) yapılmadı: tatbikatı koşan
  dal prod'un 4 migration önündeydi, hata alsa bile sebebi yedek olmazdı. Gerçek
  kurtarmada bu adım §4.5'te zaten var.
- **Maliyet:** geçici instance ~10 dk yaşadı; `db.t4g.small` + 20 GB için birkaç
  sentlik mertebe (tahmin, faturaya bakılmadı).

---

## 6. Periyodik tekrar

[`dr-drill-reminder.yml`](../../.github/workflows/dr-drill-reminder.yml) **üç ayda
bir** (Şubat/Mayıs/Ağustos/Kasım'ın 1'i, 06:00 UTC) tatbikat issue'su açar.
Sonraki planlanan tatbikat: **2026-11-01**.

Dürüstlük notu — bu hatırlatıcının üç sınırı var:

1. `schedule` yalnız **varsayılan daldaki** (`main`) workflow sürümünden koşar;
   yani ilk tetiklenmesi bu dosyanın bir release ile `main`'e girmesinden sonradır.
2. GitHub, 60 gün hiç aktivite görmeyen depoda zamanlanmış workflow'ları
   kendiliğinden durdurur.
3. Hatırlatıcı **hatırlatır, tatbikat yapmaz** — issue'yu kapatan insan koşmuş
   olmalı. Kapanan issue'nun altında §5 tablosuna eklenen satır bulunmalı.

Yıllık maliyeti 4 çalıştırma × ~1 dk; [Actions dakika bütçesi](./../agent-workflows/repo-guardrails.md) §6
açısından ölçülemeyecek kadar küçük.

---

## 7. Bilinen boşluklar

Kapatılmadı, gizlenmiyor:

- **Bölge/hesap kaybı kapsam dışı.** RDS snapshot'ı başka bölgeye kopyalanmıyor,
  S3 replikasyonu yok. `eu-central-1` bütünüyle giderse ya da AWS hesabı ele
  geçirilirse bu prosedür işlemez. Kapatmanın yolu: günlük snapshot kopyası +
  S3 CRR (aylık birkaç dolar); MVP evresinde bilinçli olarak alınmadı.
- **Dahili statü sayfası yok.** Kesinti iletişiminin interim kanalı BAK-119 ile
  kondu (X hesabı + anons şablonları,
  [incident-communication.md](./incident-communication.md)); geçmiş olay arşivi
  tutan ve konsoldan güncellenen `/status` sayfası hâlâ yok (BAK-128, backlog).
- **Multi-AZ kapalı.** AZ kaybında otomatik failover yok, kurtarma elle restore.
  RTO hedefi (4 saat) buna göre kondu.
- **Kısmi (tek kiracı) geri yükleme script'i yok.** §3/1 elle SQL ile yapılır;
  gerçekten yaşanırsa script'i o zaman yaz.
- **Sırların/altyapının kendisi bu repoda değil** (CDK ayrı depo). Altyapı kaybının
  kurtarması bu dosyanın kapsamı dışında.
