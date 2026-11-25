"use client"

import { useState } from "react"
import {
  CheckList,
  FaqAccordion,
  FeatureTile,
  FloatingField,
  NumberedSteps,
  PhotoCard,
  PillButton,
  PriceBlock,
  RoundIconButton,
  SuccessState,
  TextLink,
  Wordmark,
} from "@/components/marketing/kit"
import landing from "@/components/marketing/landing/landing.module.css"

/** `globals.css` --mk-* token'ları (docs/design-pattern-esantral.md §7). */
const TOKENS = [
  ["--mk-ink", "#1d1d1f", "Birincil metin"],
  ["--mk-gray", "#6e6e73", "İkincil metin"],
  ["--mk-gray-hero", "#646469", "Hero alt metni (AA)"],
  ["--mk-gray-3", "#86868b", "Maket metni, alan çerçevesi"],
  ["--mk-surface", "#ffffff", "Sayfa / kart"],
  ["--mk-soft", "#f5f5f7", "Gri kutular, alt bant"],
  ["--mk-hero", "#e7e9ed", "Hero zemini"],
  ["--mk-line", "#d2d2d7", "Ayırıcı çizgi"],
  ["--mk-link", "#0066cc", "Metin bağlantısı"],
  ["--mk-blue", "#0071e3", "Birincil eylem"],
  ["--mk-blue-hover", "#0066cc", "Birincil hover (AA)"],
  ["--mk-neutral", "#e8e8ed", "Nötr yuvarlak düğme"],
  ["--mk-error-text", "#d70015", "Hata metni"],
  ["--mk-success", "#1b7a3d", "Başarı ikonu"],
] as const

const box = "rounded-lg border border-border p-6"

export function MarketingKitShowcase() {
  const [done, setDone] = useState(false)

  return (
    // Vitrin çerçeveleri pazarlama ölçeğinde kalır: uygulama --radius'u 12px'e indi (#878).
    <div className={`${landing.page} space-y-8 rounded-lg [--radius:1rem]`}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TOKENS.map(([token, value, role]) => (
          <div key={token} className="overflow-hidden rounded-lg border border-border">
            <div className="h-14" style={{ background: `var(${token})` }} />
            <div className="space-y-0.5 p-3 text-[13px] leading-snug">
              <p className="font-mono">{token}</p>
              <p className="font-mono text-muted-foreground">{value}</p>
              <p className="text-muted-foreground">{role}</p>
            </div>
          </div>
        ))}
      </div>

      <div className={`${box} flex flex-wrap items-center gap-6`}>
        <PillButton>Ücretsiz deneyin</PillButton>
        <PillButton size="lg">Ücretsiz deneyin</PillButton>
        <PillButton size="nav">Ücretsiz deneyin</PillButton>
        <TextLink>Sizi arayalım</TextLink>
        <RoundIconButton label="Önceki kart">‹</RoundIconButton>
        <RoundIconButton label="Kapat" size={32}>
          ×
        </RoundIconButton>
        <Wordmark variant="header" />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <FeatureTile
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M12 7v5l4 2" />
            </svg>
          }
          title="Araç geçmişi"
        >
          Plakayı yazın, aracın önceki kayıtlarını ve takılan parçaları görün.
        </FeatureTile>
        <PhotoCard src="/landing/esantral/kabul.webp" alt="Usta aracın fotoğrafını çekiyor" label="Araç Kabul">
          Ruhsat okuması ve aracın fotoğrafları.
        </PhotoCard>
      </div>

      {/* Numaralı adımlar kaynakta gri kutunun içinde durur; beyaz daireler o zeminde görünür. */}
      <div className={box} style={{ background: "var(--mk-soft)" }}>
        <NumberedSteps
          steps={[
            { title: "Servisinizi konuşalım.", text: "İş akışınızı birlikte inceleyelim." },
            { title: "Kayıtlarınızı taşıyalım.", text: "Eski kayıtlarınız aktarılsın." },
          ]}
        />
        <CheckList items={["Sınırsız müşteri ve araç kabul", "Kasa, tahsilat ve randevu"]} />
      </div>

      <PriceBlock
        titleId="kit-price"
        title="Tek paket, her zaman."
        subtitle="Fiyat bloğu örneği."
        amount="₺1.499"
        unit="/ ay, KDV dahil"
        items={["Madde bir", "Madde iki"]}
        note="Kart bilgisi istenmez."
        cta={<PillButton size="lg">Ücretsiz deneyin</PillButton>}
      />

      <div className={box}>
        <FaqAccordion
          items={[
            { question: "Hangi cihazlarda çalışır?", answer: "Telefon, tablet ve bilgisayarda tarayıcıdan çalışır." },
            { question: "Ekibim de kullanabilir mi?", answer: "Evet, herkes kendi yetkisiyle giriş yapar." },
          ]}
        />
      </div>

      <div className={`${box} grid gap-3 md:grid-cols-3`}>
        <FloatingField label="Ad soyad" name="kit-empty" />
        <FloatingField label="Cep telefonu" name="kit-filled" defaultValue="0532 123 45 67" />
        <FloatingField label="E-posta" name="kit-invalid" aria-invalid defaultValue="ali@" />
      </div>

      <div className={`${box} text-center`}>
        {done ? (
          <PillButton onClick={() => setDone(false)}>Başarı durumunu gizle</PillButton>
        ) : (
          <SuccessState
            titleId="kit-done"
            title="Teşekkürler."
            text="Arama talebiniz alındı. En kısa sürede sizi arayacağız."
            onDone={() => setDone(true)}
          />
        )}
      </div>
    </div>
  )
}
