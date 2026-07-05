# VIN→TecDoc çözümleme: InlineCreateModal'a taşıma — Tasarım

**Tarih:** 2026-07-05
**Durum:** Onaylandı, implementasyona hazır

## Amaç

`/orders/new` sihirbazının "Yeni araç" modalı (`InlineCreateModal`) Şase No (VIN) alanını tutuyor ama TecDoc katalog eşlemesi hiç yapmıyor — bu özellik şu an yalnızca `/vehicles/new` ve `/vehicles/[id]/edit` formunda (`vehicle-create-form.tsx`) var. Backend (`createVehicleAction`) `catalogBrandId`/`catalogModelId`/`catalogVehicleTypeId` alanlarını zaten kabul edip `Vehicle` satırına yazıyor; `InlineCreateModal` bunları hiç göndermediği için sipariş akışından oluşturulan araçlar hiçbir zaman parça kataloğuna (TecDoc) bağlanmıyor.

Hedef: aynı VIN→katalog çözümleme deneyimini (`/api/vin/resolve` çağrısı, otomatik/aday listeli eşleme, marka-model geri doldurma) `InlineCreateModal`'a da getirmek — kod kopyalamadan.

## Mimari

### Ortak `useVinResolve` hook'u

`runVinResolve`/`applyCandidate` mantığı şu an yalnızca `vehicle-create-form.tsx` içinde, react-hook-form'a bağlı olarak yaşıyor. Bu mantık `src/components/app/vin-resolve.tsx` içine (zaten `VinResolveButton`/`VinCandidateList`'in evi) `useVinResolve()` hook'u olarak taşınıyor:

```ts
export type VinResolveState = { loading: boolean; error: string; notice: string; candidates: VinCandidate[] }
export const VIN_RESOLVE_IDLE: VinResolveState = { loading: false, error: "", notice: "", candidates: [] }

export function useVinResolve(opts: {
  getVin: () => string
  onBrand?: (brand: { id: number; name: string }) => void
  onModel?: (model: { id: number; name: string }) => void
  onCandidate: (candidate: VinCandidate) => void
}): VinResolveState & { resolve: (hints: RuhsatHints) => Promise<void>; applyCandidate: (c: VinCandidate) => void; reset: () => void }
```

Hook, "`/api/vin/resolve`'i çağır, `found`/`resolved`/`ambiguous`/`not_found` durumunu yorumla, bildirim/hata metnini üret" sorumluluğunu taşır — davranış bugünkü `runVinResolve`ile birebir aynı (aynı mesajlar, aynı dallanma). "Sonucu hangi alana nasıl yaz" sorumluluğu her tüketicide kalır (`onBrand`/`onModel`/`onCandidate` callback'leri üzerinden), çünkü `vehicle-create-form.tsx` react-hook-form kullanırken `InlineCreateModal` düz `useState` kullanıyor — state şekillerini ortaklaştırmaya çalışmak gereksiz soyutlama olurdu.

`VinCandidateList`'in `onSelect` callback'i artık doğrudan `vinResolve.applyCandidate(c)`'ye bağlanır (bildirim metni hook içinde üretilir); `onDismiss` → `vinResolve.reset()`.

### `tecdocFuelToFormValue` taşınması

Şu an `vehicle-create-form.tsx` içinde private bir fonksiyon (TecDoc İngilizce yakıt adı → form select slug'ı). `src/lib/constants.ts`'e taşınıp export edilir (yanındaki `ocrFuelToSlug`/`ocrVehicleTypeToSlug` ile aynı kategori: dış sözlük → iç slug eşleyici), iki dosya da oradan import eder.

### `vehicle-create-form.tsx` refactor

`runVinResolve`/`applyCandidate`/`vinResolve` state'i kaldırılıp yerine:

```ts
const vinResolve = useVinResolve({
  getVin: () => form.getValues("vin") || "",
  onBrand: (b) => { form.setValue("brand", b.name, { shouldValidate: true, shouldDirty: true }); form.setValue("catalogBrandId", b.id, { shouldDirty: true }) },
  onModel: (m) => { form.setValue("model", m.name, { shouldValidate: true, shouldDirty: true }); form.setValue("catalogModelId", m.id, { shouldDirty: true }) },
  onCandidate: (c) => {
    form.setValue("brand", c.brandName, { shouldValidate: true, shouldDirty: true })
    form.setValue("model", c.modelName, { shouldValidate: true, shouldDirty: true })
    form.setValue("catalogBrandId", c.brandId, { shouldDirty: true })
    form.setValue("catalogModelId", c.modelId, { shouldDirty: true })
    form.setValue("catalogVehicleTypeId", c.vehicleTypeId, { shouldDirty: true })
    if (c.cc != null) setIfEmpty("engineDisplacement", String(c.cc))
    if (c.kwt != null) setIfEmpty("enginePower", `${c.kwt} kW`)
    const fuel = tecdocFuelToFormValue(c.fuelType)
    if (fuel) setIfEmpty("fuelType", fuel)
    const year = c.yearFrom ? Number(c.yearFrom.slice(0, 4)) : NaN
    if (!Number.isNaN(year)) setIfEmpty("modelYear", year)
  },
})
```

Çağrı yerleri (`runVinResolve(hints)` → `vinResolve.resolve(hints)`) ve JSX (`vinResolve.loading/notice/error/candidates`) aynen kalır. **Davranış değişmez** — saf bir taşıma.

### `InlineCreateModal` değişiklikleri

1. **Yeni state:** `catalogIds: { brandId?: number; modelId?: number; vehicleTypeId?: number }`. Modal her açılışta (`justOpened` bloğunda) `{}`'e sıfırlanır; `vinResolve.reset()` de aynı yere eklenir.
2. **`useVinResolve` bağlanması:**
   ```ts
   const vinResolve = useVinResolve({
     getVin: () => fields.vin,
     onBrand: (b) => { setField("brand", b.name); setCatalogIds((p) => ({ ...p, brandId: b.id })) },
     onModel: (m) => { setField("model", m.name); setCatalogIds((p) => ({ ...p, modelId: m.id })) },
     onCandidate: (c) => {
       setCatalogIds({ brandId: c.brandId, modelId: c.modelId, vehicleTypeId: c.vehicleTypeId })
       setFields((prev) => ({
         ...prev,
         brand: c.brandName,
         model: c.modelName,
         engineDisplacement: prev.engineDisplacement || (c.cc != null ? String(c.cc) : prev.engineDisplacement),
         enginePower: prev.enginePower || (c.kwt != null ? `${c.kwt} kW` : prev.enginePower),
         fuelType: prev.fuelType || tecdocFuelToFormValue(c.fuelType) || prev.fuelType,
         modelYear: prev.modelYear || (c.yearFrom ? String(Number(c.yearFrom.slice(0, 4))) : prev.modelYear),
       }))
     },
   })
   ```
3. **Manuel tetik:** Şase No (VIN) `Input`'unun yanına `VinResolveButton` eklenir (Ruhsat/teknik bilgiler bölümü içinde, VIN alanının bulunduğu yer):
   ```tsx
   <VinResolveButton
     loading={vinResolve.loading}
     disabled={!isValidVin(fields.vin)}
     onClick={() => vinResolve.resolve({
       engineDisplacement: fields.engineDisplacement || undefined,
       enginePower: fields.enginePower || undefined,
       fuelType: fields.fuelType || undefined,
       firstRegistrationDate: fields.firstRegistrationDate || undefined,
       modelYear: fields.modelYear ? Number(fields.modelYear) || undefined : undefined,
     })}
   />
   ```
   Altında `vinResolve.loading` (spinner + "VIN sorgulanıyor…"), `vinResolve.notice` (`text-muted-foreground` paragraf), `vinResolve.error` (mevcut modal stiliyle `text-destructive` paragraf — yeni `Alert` import'u yok), ve `vinResolve.candidates.length > 0` ise `VinCandidateList` render edilir.
4. **Otomatik tetik (OCR sonrası):** `applyOcr()` içinde, `values.vin` geçerliyse:
   ```ts
   if (isValidVin(values.vin)) {
     void vinResolve.resolve({
       engineDisplacement: values.engineDisplacement || undefined,
       enginePower: values.enginePower || undefined,
       fuelType: values.fuelType || undefined,
       firstRegistrationDate: values.registrationDate || undefined,
       modelYear: values.modelYear ? Number(values.modelYear) || undefined : undefined,
     })
   }
   ```
   (`vehicle-create-form.tsx`'teki OCR-tetikli çağrıyla birebir aynı hint eşlemesi.)
5. **Manuel marka/model değişiminde katalog bağını temizle:** `VehicleBrandModelPicker`'ın `onBrandChange`/`onModelChange`'i güncellenir — marka değişince `catalogIds` tamamen, model değişince yalnız `modelId`/`vehicleTypeId` temizlenir (tam formdaki `clearCatalogIds("all"|"model")` mantığıyla aynı).
6. **`handleCreate()`:** `FormData`'ya, doluysa, `catalogBrandId`/`catalogModelId`/`catalogVehicleTypeId` eklenir.

Diğer davranışlar (mevcut plaka tespiti, ruhsat OCR akışı, müşteri seçimi) değişmez.

## Değişen dosyalar

- `src/components/app/vin-resolve.tsx` — `useVinResolve` hook'u, `VinResolveState`/`VIN_RESOLVE_IDLE` export'ları eklenir.
- `src/lib/constants.ts` — `tecdocFuelToFormValue` buraya taşınır ve export edilir.
- `src/components/app/vehicle-create-form.tsx` — `useVinResolve`'e refactor (davranış aynı), `tecdocFuelToFormValue` import'a çevrilir.
- `src/components/app/inline-create-modal.tsx` — `catalogIds` state'i, `useVinResolve` bağlanması, VIN alanının yanına buton + bildirim/hata/aday listesi UI'ı, OCR-sonrası otomatik tetik, marka/model değişiminde katalog temizleme, `handleCreate`'te FormData'ya katalog id'leri eklenmesi.
- `src/components/app/vin-resolve.test.tsx` (yeni) — `useVinResolve` için birim testleri (mock `fetch`): found/resolved-tek-aday/ambiguous-çoklu-aday/not_found/HTTP-hata/network-hata dalları.

**Backend değişikliği yok** — `createVehicleAction` katalog id'lerini zaten kabul edip kaydediyor.

## Risk alanları

- **Refactor regresyonu:** `vehicle-create-form.tsx`'in davranışı hook'a taşınırken bozulmamalı — mevcut manuel QA akışı (VIN gir → "VIN'den getir" → tekli/çoklu eşleşme/bulunamadı) bu formda da tekrar doğrulanır.
- **Kısmi eşleşme (marka/model var, motor varyantı yok) artık `resolved` sayılıyor** (önceki oturumda düzeltilen `rapidapi-provider.ts` fix'i sayesinde) — `InlineCreateModal`'da bu durumda `catalogVehicleTypeId` boş kalır, yalnızca `catalogBrandId`/`catalogModelId` dolar; parça kataloğu (TecDoc parça seçici) `catalogVehicleTypeId` gerektirdiği için bu araçlarda parça seçici çalışmaz ama en azından marka/model doğru gelir — mevcut formdaki davranışla birebir aynı, yeni bir kısıt değil.
- **Tenant izolasyonu:** `/api/vin/resolve` zaten `getCurrentUserWithWorkshop()` + `resolveFeature(..., "vinLookup")` ile korunuyor; bu değişiklik yeni bir uç nokta açmıyor, mevcut korumalı endpoint'i ikinci bir client'tan çağırıyor.
- **Rate limit paylaşımı:** `/api/vin/resolve`'daki `rateLimit(vin:${workshopId}, 10, 60_000)` iki form arasında paylaşılıyor (workshop bazlı, form bazlı değil) — beklenen davranış, değişiklik gerekmiyor.

## Manuel QA

1. `/orders/new` → "Yeni araç" → ruhsatı tara → VIN okunursa otomatik TecDoc sorgusu tetiklenmeli, marka/model (ve varsa motor varyantı) otomatik dolmalı.
2. Aynı modalda VIN alanına elle geçerli bir VIN yaz → "VIN'den getir" butonuna bas → aynı otomatik/aday-listeli/bulunamadı akışları çalışmalı.
3. Çoklu motor varyantı olan bir VIN dene → aday listesi görünmeli, bir aday seçilince marka/model/motor alanları dolmalı.
4. Marka veya modeli elle değiştir → önceki VIN eşleşmesinin katalog bağının temizlendiğini (arka planda) doğrula — oluşturulan aracın `catalogVehicleTypeId`'sinin DB'de `null` kaldığını kontrol et.
5. Aracı oluştur → DB'de `Vehicle.catalogBrandId`/`catalogModelId`/`catalogVehicleTypeId`'nin dolu geldiğini doğrula (Prisma studio veya `psql`).
6. `/vehicles/new` ve `/vehicles/[id]/edit` formunda VIN çözümlemenin refactor sonrası hâlâ aynı şekilde çalıştığını doğrula (regresyon kontrolü).
