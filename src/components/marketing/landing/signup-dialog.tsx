"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { createContext, useContext, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form"
import { formatPhoneTR } from "@/lib/format"
import { getStoredMarketingAttribution, trackMarketingEvent } from "@/lib/marketing-analytics"
import { quickSignupSchema, splitFullName, type QuickSignup } from "@/lib/validations/quick-signup"
import type { CtaTrack } from "../kit/cta-track"
import { FloatingField } from "../kit/floating-field"
import { DialogHeading, MarketingDialog } from "../kit/marketing-dialog"
import { PillButton, type PillSize } from "../kit/pill-button"
import { SuccessState } from "../kit/success-state"
import { TextLink } from "../kit/text-link"
import { focusFieldOnOpen, useDialogOpener } from "../kit/use-dialog-opener"
import { Wordmark } from "../kit/wordmark"
import styles from "./dialog-form.module.css"

const GENERIC_ERROR = "Bir hata oluştu. Lütfen tekrar deneyin."
const ERROR_ID = "signup-err"

type SignupContextValue = { open: (opener: HTMLElement | null) => void }

const SignupContext = createContext<SignupContextValue | null>(null)

/**
 * Ana sayfadaki tüm "Ücretsiz deneyin" düğmelerinin açtığı kayıt penceresi (#783,
 * e-santral #signup). Hesap /api/auth/register ile `signupFlow: "quick"` açılır;
 * deneme e-posta doğrulanınca başlar (bugünkü güvenlik kapısı korunur).
 */
export function SignupDialogProvider({ children }: { children: ReactNode }) {
  const { isOpen, setOpen, session, open, onCloseAutoFocus } = useDialogOpener()
  const value = useMemo(() => ({ open }), [open])

  return (
    <SignupContext.Provider value={value}>
      {children}
      <MarketingDialog
        open={isOpen}
        onOpenChange={setOpen}
        title="BakımX'i ücretsiz deneyin"
        onOpenAutoFocus={focusFieldOnOpen("workshopName")}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {/* Her açılışta form yeniden kurulur: değerler, hatalar ve başarı görünümü sıfırlanır. */}
        <SignupForm key={session} onDone={() => setOpen(false)} />
      </MarketingDialog>
    </SignupContext.Provider>
  )
}

export type SignupTriggerProps = {
  variant: "text" | "pill" | "pill-lg" | "nav"
  /** Ölçümdeki `cta_location`. */
  location: string
  children: string
}

const PILL_SIZE: Record<Exclude<SignupTriggerProps["variant"], "text">, PillSize> = {
  pill: "md",
  "pill-lg": "lg",
  nav: "nav",
}

/**
 * "Ücretsiz deneyin" tetikleyicisi. JS yüklenmeden ya da sağlayıcı yokken
 * /register'a giden gerçek bir bağlantıdır; JS ile pencereyi açar (yeni sekme
 * kısayolları hariç).
 */
export function SignupTrigger({ variant, location, children }: SignupTriggerProps) {
  const context = useContext(SignupContext)
  const track: CtaTrack = { name: "trial_cta_click", location }
  const onClick = (event: MouseEvent<HTMLElement>) => {
    if (!context || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    context.open(event.currentTarget)
  }

  if (variant === "text") {
    return (
      <TextLink href="/register" track={track} onClick={onClick}>
        {children}
      </TextLink>
    )
  }
  return (
    <PillButton href="/register" size={PILL_SIZE[variant]} track={track} onClick={onClick}>
      {children}
    </PillButton>
  )
}

function SignupForm({ onDone }: { onDone: () => void }) {
  const form = useForm<QuickSignup>({
    resolver: zodResolver(quickSignupSchema),
    defaultValues: { workshopName: "", fullName: "", phone: "", email: "", password: "", consent: false },
  })
  const [serverError, setServerError] = useState<string | null>(null)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  // Eşzamanlı kilit: isSubmitting bir render geç gelir; çift dokunuş iki kayıt denemesi yapmasın.
  const submitRef = useRef(false)
  const startedRef = useRef(false)
  const { errors, isSubmitting } = form.formState
  const message =
    errors.workshopName?.message ??
    errors.fullName?.message ??
    errors.phone?.message ??
    errors.email?.message ??
    errors.password?.message ??
    errors.consent?.message ??
    serverError
  const describedBy = message ? ERROR_ID : undefined

  const onSubmit = async (values: QuickSignup) => {
    if (submitRef.current) return
    submitRef.current = true
    setServerError(null)
    try {
      const { firstName, lastName } = splitFullName(values.fullName)
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupFlow: "quick",
          planTier: "pro",
          acquisitionSource: "website",
          marketingAttribution: getStoredMarketingAttribution(),
          workshopName: values.workshopName,
          invoiceTitle: values.workshopName,
          phone: values.phone,
          firstName,
          lastName,
          email: values.email,
          password: values.password,
          kvkkConsent: true,
        }),
      })
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; resumed?: boolean }
      if (!data.ok) {
        setServerError(data.error || GENERIC_ERROR)
        return
      }
      if (!data.resumed) trackMarketingEvent("register_submitted", { entry_step: "account" })
      setSubmittedEmail(values.email.trim())
    } catch {
      setServerError(GENERIC_ERROR)
    } finally {
      submitRef.current = false
    }
  }

  if (submittedEmail) {
    return (
      <SuccessState
        titleId="signup-done-t"
        title="E-postanızı kontrol edin."
        text={`${submittedEmail} adresine doğrulama bağlantısı gönderdik. Bağlantıya tıkladığınızda ücretsiz 7 iş günlük kullanımınız başlar.`}
        onDone={onDone}
      />
    )
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onFocus={() => {
          if (startedRef.current) return
          startedRef.current = true
          trackMarketingEvent("register_started", { entry_step: "account", plan_tier: "pro" })
        }}
        onSubmit={(event) => {
          // handleSubmit olay anında kurulur: render sırasında ref okuyan bir fonksiyon geçmeyelim (react-hooks/refs).
          void form.handleSubmit(onSubmit)(event)
        }}
      >
        <DialogHeading id="signup-t">
          <Wordmark variant="inline" />
          {"'i ücretsiz deneyin"}
        </DialogHeading>
        <div className={styles.grid}>
          <FormField
            control={form.control}
            name="workshopName"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <FloatingField {...field} label="Dükkân adı" autoComplete="organization" aria-describedby={describedBy} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fullName"
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
          <p className={styles.section}>Hesap giriş bilgileriniz</p>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <FloatingField {...field} label="E-posta" type="email" autoComplete="email" aria-describedby={describedBy} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <FloatingField
                    {...field}
                    label="Şifre"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    aria-describedby={describedBy ?? "signup-password-hint"}
                    trailing={
                      <Button
                        type="button"
                        variant="link"
                        className={styles.passwordToggle}
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((value) => !value)}
                      >
                        {showPassword ? "Gizle" : "Göster"}
                      </Button>
                    }
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <p id="signup-password-hint" className={styles.hint}>
            En az 8 karakter.
          </p>
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
                  <Link href="/terms">Kullanım koşullarını</Link> ve <Link href="/kvkk">KVKK aydınlatma metnini</Link> okudum,
                  kabul ediyorum.
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
          Hesabımı oluştur
        </PillButton>
      </form>
    </Form>
  )
}
