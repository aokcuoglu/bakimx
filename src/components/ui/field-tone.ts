/**
 * Alan tonu (#953). OCR'ın düşük güvenle okuduğu alan `tone="warning"` alır;
 * `Input`, `SelectTrigger`, `DatePicker` (Button `field`) ton niteliğini
 * `data-tone` olarak öğeye yazar, görünüm buradaki sınıflardan gelir. Çağrı
 * yerinde `border-warning/*` ya da `bg-warning/*` yazılmaz. `aria-invalid`
 * doğrulama hatasıdır, ton ile karıştırılmaz: ikisi birlikte olursa hata
 * çerçevesi (`aria-invalid:border-destructive`) tonun çerçevesini ezer.
 *
 * Metin renkleri tonlu zeminde `-strong`: placeholder `muted-foreground-strong`,
 * girilen metin `foreground`.
 */
export type FieldTone = "default" | "warning"

export const fieldToneClasses =
  "data-[tone=warning]:border-warning/40 data-[tone=warning]:bg-warning/10 data-[tone=warning]:placeholder:text-muted-foreground-strong data-[tone=warning]:focus-visible:border-warning aria-invalid:data-[tone=warning]:border-destructive"
