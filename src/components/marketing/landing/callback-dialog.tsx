"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Image from "next/image"
import Link from "next/link"
import { createContext, useCallback, useContext, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form"
import { captureDemoAttribution, getDemoAttribution, hasDemoAdvertisingConsent, trackDemoAdvertisingConversion } from "@/lib/demo-attribution"
import { formatPhoneTR } from "@/lib/format"
import { trackMarketingEvent } from "@/lib/marketing-analytics"
import { callbackRequestSchema, type CallbackRequest } from "@/lib/validations/callback-request"
import type { CtaTrack } from "../kit/cta-track"
import { DialogHeading, DialogLead, MarketingDialog } from "../kit/marketing-dialog"
import { FloatingField } from "../kit/floating-field"
import { PillButton } from "../kit/pill-button"
import { SuccessState } from "../kit/success-state"
import { TextLink } from "../kit/text-link"
import styles from "./callback-dialog.module.css"

const GENERIC_ERROR = "Talebiniz gönderilemedi. Lütfen tekrar deneyin."
const ERROR_ID = "call-err"

type CallbackContextValue = { open: (opener: HTMLElement | null) => void }

const CallbackContext = createContext<CallbackContextValue | null>(null)

/** Sayfadaki tüm "Sizi arayalım" tetikleyicilerinin açtığı tek pencere. */
export function CallbackDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false)
  // Her açılışta form yeniden kurulur: değerler, hatalar ve başarı görünümü sıfırlanır.
  const [session, setSession] = useState(0)
  // Pencereyi açan tetikleyici: kapanınca odak ona döner.
  const opener = useRef<HTMLElement | null>(null)
  const open = useCallback((element: HTMLElement | null) => {
    opener.current = element
    setSession((value) => value + 1)
    setOpen(true)
  }, [])
  const value = useMemo(() => ({ open }), [open])

  return (
    <CallbackContext.Provider value={value}>
      {children}
      <MarketingDialog
        open={isOpen}
        onOpenChange={setOpen}
        title="Sizi arayalım"
        size="sm"
        onOpenAutoFocus={(event) => {
          // Radix varsayılanı ilk odaklanabilir öğeye (Kapat) gider; kaynak gibi ilk alana odaklan.
          const first = (event.target as HTMLElement | null)?.querySelector<HTMLInputElement>("input[name='name']")
          if (!first) return
          event.preventDefault()
          first.focus()
        }}
        onCloseAutoFocus={(event) => {
          if (!opener.current?.isConnected) return
          event.preventDefault()
          opener.current.focus()
        }}
      >
        <CallbackForm key={session} onDone={() => setOpen(false)} />
      </MarketingDialog>
    </CallbackContext.Provider>
  )
}

export type CallbackTriggerProps = {
  variant: "text" | "pill" | "pill-lg"
  /** Ölçümdeki `cta_location`. */
  location: string
  children: string
}

/**
 * "Sizi arayalım" tetikleyicisi. JS yüklenmeden ya da sağlayıcı yokken /demo'ya
 * giden gerçek bir bağlantıdır; JS ile pencereyi açar (yeni sekme kısayolları hariç).
 */
export function CallbackTrigger({ variant, location, children }: CallbackTriggerProps) {
  const context = useContext(CallbackContext)
  const track: CtaTrack = { name: "demo_cta_click", location, destination: context ? "callback_modal" : "form" }
  const onClick = (event: MouseEvent<HTMLElement>) => {
    if (!context || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    context.open(event.currentTarget)
  }

  if (variant === "text") {
    return (
      <TextLink href="/demo" track={track} onClick={onClick}>
        {children}
      </TextLink>
    )
  }
  return (
    <PillButton href="/demo" size={variant === "pill-lg" ? "lg" : "md"} track={track} onClick={onClick}>
      {children}
    </PillButton>
  )
}

function CallbackForm({ onDone }: { onDone: () => void }) {
  const form = useForm<CallbackRequest>({
    resolver: zodResolver(callbackRequestSchema),
    defaultValues: { name: "", phone: "", consent: false },
  })
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const { errors, isSubmitting } = form.formState
  const message = errors.name?.message ?? errors.phone?.message ?? errors.consent?.message ?? serverError
  const describedBy = message ? ERROR_ID : undefined

  // Eşzamanlı kilit: isSubmitting bir render geç gelir; çift dokunuş iki talep açmasın.
  const submitRef = useRef(false)

  const onSubmit = async (values: CallbackRequest) => {
    if (submitRef.current) return
    submitRef.current = true
    setServerError(null)
    try {
      // /demo formu (HeroLeadForm) ile aynı: kampanya bilgisi yalnız reklam onayı varsa sunucuda saklanır.
      captureDemoAttribution()
      const response = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "landing_callback",
          name: values.name,
          phone: values.phone,
          attribution: getDemoAttribution(),
          targetingConsent: hasDemoAdvertisingConsent(),
        }),
      })
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { errors?: Record<string, string> } | null
        setServerError(result?.errors?._general ?? GENERIC_ERROR)
        return
      }
      const result = (await response.json().catch(() => ({}))) as { eventId?: string }
      trackMarketingEvent("demo_submitted", { form_location: "home", event_id: result.eventId })
      if (result.eventId) trackDemoAdvertisingConversion(result.eventId)
      setDone(true)
    } catch {
      setServerError(GENERIC_ERROR)
    } finally {
      submitRef.current = false
    }
  }

  if (done) {
    return (
      <SuccessState
        titleId="call-done-t"
        title="Teşekkürler."
        text="Arama talebiniz alındı. En kısa sürede sizi arayacağız."
        onDone={onDone}
      />
    )
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={(event) => {
          // handleSubmit olay anında kurulur: render sırasında ref okuyan bir fonksiyon geçmeyelim (react-hooks/refs).
          void form.handleSubmit(onSubmit)(event)
        }}
      >
        <Image className={styles.logo} src="/landing/esantral/bakimx-icon.svg" alt="" width={44} height={40} unoptimized />
        <DialogHeading id="call-t">Sizi arayalım</DialogHeading>
        <DialogLead>
          Servisinizi birlikte inceleyelim, geçişi planlayalım.
          <br className={styles.leadBreak} /> En kısa sürede sizi arayalım.
        </DialogLead>
        <div className={styles.grid}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <FloatingField {...field} label="Ad soyad" autoComplete="name" aria-describedby={describedBy} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <FloatingField
                    {...field}
                    onChange={(event) => field.onChange(formatPhoneTR(event.target.value))}
                    label="Cep telefonu"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    aria-describedby={describedBy}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="consent"
          render={({ field }) => (
            <FormItem className={styles.consent}>
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  aria-describedby={describedBy}
                />
              </FormControl>
              <FormLabel className={styles.consentLabel}>
                <span>
                  Bu numaradan aranmayı ve <Link href="/kvkk">KVKK aydınlatma metnini</Link> kabul ediyorum.
                </span>
              </FormLabel>
            </FormItem>
          )}
        />
        {message ? (
          <Alert id={ERROR_ID} variant="destructive" className={styles.error}>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        <PillButton type="submit" size="lg" fullWidth disabled={isSubmitting} className={styles.submit}>
          Beni arayın
        </PillButton>
      </form>
    </Form>
  )
}
